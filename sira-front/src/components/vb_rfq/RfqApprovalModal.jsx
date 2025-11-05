//C:\SIRA\sira-front\src\components\vb_rfq\RfqApprovalModal.jsx
/**
 * =================================================================================================
 * COMPONENTE: RfqApprovalModal (Visualización Dual: OCs Pendientes y Generadas)
 * Versión 2.1 — Fix:
 *  - Normalización estricta de IDs (Number) para el bloqueo por opciones_bloqueadas
 *  - Refetch de detalle al (re)abrir y tras acciones; refreshList también al cerrar
 *  - Sin cambios visuales
 * =================================================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress,
  Paper, Typography, Alert, List, ListItem, ListItemText, Divider, Link, ListItemIcon
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LockIcon from '@mui/icons-material/Lock';
import { calcularResumenParaModal } from './vbRfqUtils';

// Helpers de normalización
const toNum = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};
const toNumArray = (arr) => (Array.isArray(arr) ? arr.map((x) => toNum(x)).filter((x) => x !== undefined) : []);

export default function RfqApprovalModal({ open, onClose, rfqId, refreshList, setGlobalLoading }) {
  // --- Estado local ---
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  // =============================================================================================
  // --- CARGA / REFRESH DE DETALLES ---
  // =============================================================================================
  const fetchDetails = useCallback(async () => {
    if (!rfqId) return;
    setLoading(true);
    try {
      const data = await api.get(`/api/rfq/${rfqId}`);
      setDetails(data);
    } catch {
      toast.error("No se pudo recargar el detalle del RFQ.");
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    if (open) {
      // Al abrir, siempre refetch para no usar snapshots obsoletos
      fetchDetails();
    } else {
      setDetails(null);
    }
  }, [open, fetchDetails]);

  // Cierre que también refresca la lista general
  const handleClose = () => {
    try {
      if (typeof refreshList === 'function') refreshList();
    } finally {
      if (typeof onClose === 'function') onClose();
    }
  };

  // =============================================================================================
  // --- AGRUPACIÓN PENDIENTES vs BLOQUEADAS (con NORMALIZACIÓN DE IDs) ---
  // =============================================================================================
  const proveedoresBloques = useMemo(() => {
    if (!details) return { pendientes: [], bloqueadas: [] };

    // Normalizar lista de bloqueados a números
    const opcionesBloqueadasSet = new Set(toNumArray(details.opciones_bloqueadas));

    // Estructuras intermedias
    const agrupadosPendientes = {};
    const agrupadosBloqueados = {};

    (details.materiales || []).forEach((material) => {
      const opciones = Array.isArray(material.opciones) ? material.opciones : [];

      // --- OPCIONES PENDIENTES ---
      opciones
        .filter((op) => op?.seleccionado === true && !opcionesBloqueadasSet.has(toNum(op?.id)))
        .forEach((op) => {
          const provIdNum = toNum(op?.proveedor_id);
          if (!provIdNum) return;

          if (!agrupadosPendientes[provIdNum]) {
            agrupadosPendientes[provIdNum] = {
              nombre: op.proveedor_razon_social || op.proveedor_nombre,
              opciones: [],
              adjuntos: (details.adjuntos_cotizacion || []).filter((a) => toNum(a.proveedor_id) === provIdNum),
              bloqueada: false,
            };
          }
          agrupadosPendientes[provIdNum].opciones.push({ ...op, materialNombre: material.material });
        });

      // --- OPCIONES BLOQUEADAS (ya OC) ---
      opciones
        .filter((op) => op?.seleccionado === true && opcionesBloqueadasSet.has(toNum(op?.id)))
        .forEach((op) => {
          const provIdNum = toNum(op?.proveedor_id);
          if (!provIdNum) return;

          if (!agrupadosBloqueados[provIdNum]) {
            agrupadosBloqueados[provIdNum] = {
              nombre: op.proveedor_razon_social || op.proveedor_nombre,
              opciones: [],
              adjuntos: (details.adjuntos_cotizacion || []).filter((a) => toNum(a.proveedor_id) === provIdNum),
              bloqueada: true,
            };
          }
          agrupadosBloqueados[provIdNum].opciones.push({ ...op, materialNombre: material.material });
        });
    });

    // Mapear a arrays y calcular resúmenes
    const pendientes = Object.entries(agrupadosPendientes).map(([provIdStr, grupo]) => ({
      ...grupo,
      proveedorId: toNum(provIdStr),
      resumenFinanciero: calcularResumenParaModal(grupo.opciones),
    }));

    const bloqueadas = Object.entries(agrupadosBloqueados).map(([provIdStr, grupo]) => ({
      ...grupo,
      proveedorId: toNum(provIdStr),
      resumenFinanciero: calcularResumenParaModal(grupo.opciones),
    }));

    return { pendientes, bloqueadas };
  }, [details]);

  // =============================================================================================
  // --- ACCIONES ---
  // =============================================================================================

  // Descargar PDF OC generada
  const handleDownloadPdf = async (ocId) => {
    try {
      toast.info("Preparando descarga del PDF...");
      const response = await api.get(`/api/ocs/${ocId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      let fileName = `OC-${ocId}.pdf`;
      const contentDisposition = response.headers?.['content-disposition'];
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) fileName = match[1];
      }
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar el PDF.");
    }
  };

  // Generar OC (solo para bloque pendiente)
  const handleGenerateOC = async (proveedorId) => {
    if (!rfqId || !proveedorId) return;
    setGlobalLoading?.(true);
    try {
      toast.info("Iniciando proceso de generación...");
      const response = await api.post(`/api/rfq/${rfqId}/generar-ocs`, { proveedorId });
      toast.success(response.mensaje || "OC generada.");

      // Si el backend regresa OCs creadas, descargamos la primera
      if (Array.isArray(response.ocs) && response.ocs.length > 0) {
        const first = response.ocs[0];
        if (first?.id) await handleDownloadPdf(first.id);
      }

      // Refrescar detalle del modal y la lista general
      await fetchDetails();
      await refreshList?.();
    } catch (err) {
      toast.error(err?.error || "Ocurrió un error al generar la OC.");
    } finally {
      setGlobalLoading?.(false);
    }
  };

  // =============================================================================================
  // --- UI ---
  // =============================================================================================

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Generar Órdenes de Compra para: <strong>{details?.rfq_code}</strong>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <CircularProgress />
          </div>
        ) : (
          <Box>
            {/* =========================
                BLOQUES PENDIENTES DE OC
             ========================= */}
            {proveedoresBloques.pendientes.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  OCs Pendientes de Generar
                </Typography>
                {proveedoresBloques.pendientes.map((grupo) => {
                  const provId = toNum(grupo.proveedorId) || toNum(grupo.opciones?.[0]?.proveedor_id);
                  return (
                    <Paper key={`pendiente-${provId}`} variant="outlined" sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {grupo.nombre}
                      </Typography>
                      <List dense>
                        {grupo.opciones.map((item) => (
                          <ListItem key={item.id} disableGutters>
                            <ListItemText
                              primary={item.materialNombre}
                              secondary={`Cant: ${Number(item.cantidad_cotizada).toFixed(2)} @ $${Number(item.precio_unitario).toFixed(4)}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                      {grupo.adjuntos.length > 0 && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption">Archivos de Cotización:</Typography>
                          <List dense disablePadding>
                            {grupo.adjuntos.map((file) => (
                              <ListItem key={file.id} component={Link} href={file.ruta_archivo} target="_blank" button dense>
                                <ListItemIcon sx={{ minWidth: '32px' }}>
                                  <AttachFileIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={file.nombre_archivo} primaryTypographyProps={{ variant: 'body2' }} />
                              </ListItem>
                            ))}
                          </List>
                        </>
                      )}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Subtotal:</Typography>
                          <Typography variant="body2">${grupo.resumenFinanciero.subTotal.toFixed(2)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">IVA:</Typography>
                          <Typography variant="body2">${grupo.resumenFinanciero.iva.toFixed(2)}</Typography>
                        </Box>
                        {grupo.resumenFinanciero.retIsr > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="error">Ret. ISR:</Typography>
                            <Typography variant="body2" color="error">-${grupo.resumenFinanciero.retIsr.toFixed(2)}</Typography>
                          </Box>
                        )}
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            Total ({grupo.resumenFinanciero.moneda}):
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            ${grupo.resumenFinanciero.total.toFixed(2)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                          variant="contained"
                          color="success"
                          onClick={() => handleGenerateOC(provId)}
                          disabled={loading}
                        >
                          Generar OC
                        </Button>
                      </Box>
                    </Paper>
                  );
                })}
              </>
            )}

            {/* =========================
                BLOQUES YA CON OC (INHABILITADOS)
             ========================= */}
            {proveedoresBloques.bloqueadas.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Órdenes de Compra ya Generadas (Bloqueadas)
                </Typography>
                {proveedoresBloques.bloqueadas.map((grupo, index) => (
                  <Paper
                    key={`bloqueada-${grupo.proveedorId || index}`}
                    variant="outlined"
                    sx={{
                      p: 2,
                      mb: 2,
                      bgcolor: '#f5f5f5',
                      opacity: 0.65,
                      border: '1.5px solid #bdbdbd',
                      position: 'relative'
                    }}
                  >
                    {/* Overlay de bloqueo */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(255,255,255,0.3)',
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <LockIcon sx={{ fontSize: 32, mb: 1, color: '#757575' }} />
                      <Typography color="text.secondary" fontWeight={600}>OC Generada (Inhabilitado)</Typography>
                    </Box>

                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#757575' }}>
                      {grupo.nombre}
                    </Typography>
                    <List dense>
                      {grupo.opciones.map((item) => (
                        <ListItem key={item.id} disableGutters>
                          <ListItemText
                            primary={item.materialNombre}
                            secondary={`Cant: ${Number(item.cantidad_cotizada).toFixed(2)} @ $${Number(item.precio_unitario).toFixed(4)}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                    {grupo.adjuntos.length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption">Archivos de Cotización:</Typography>
                        <List dense disablePadding>
                          {grupo.adjuntos.map((file) => (
                            <ListItem key={file.id} component={Link} href={file.ruta_archivo} target="_blank" button dense>
                              <ListItemIcon sx={{ minWidth: '32px' }}>
                                <AttachFileIcon fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={file.nombre_archivo} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                          ))}
                        </List>
                      </>
                    )}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ p: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Subtotal:</Typography>
                        <Typography variant="body2">${grupo.resumenFinanciero.subTotal.toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">IVA:</Typography>
                        <Typography variant="body2">${grupo.resumenFinanciero.iva.toFixed(2)}</Typography>
                      </Box>
                      {grupo.resumenFinanciero.retIsr > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="error">Ret. ISR:</Typography>
                          <Typography variant="body2" color="error">-${grupo.resumenFinanciero.retIsr.toFixed(2)}</Typography>
                        </Box>
                      )}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          Total ({grupo.resumenFinanciero.moneda}):
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          ${grupo.resumenFinanciero.total.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </>
            )}

            {proveedoresBloques.pendientes.length === 0 && proveedoresBloques.bloqueadas.length === 0 && (
              <Alert severity="success">
                ¡Excelente! Todas las líneas de este RFQ ya tienen una Orden de Compra generada.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
