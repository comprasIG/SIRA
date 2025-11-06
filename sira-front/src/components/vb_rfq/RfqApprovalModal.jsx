/**
 * =================================================================================================
 * COMPONENTE: RfqApprovalModal (Visualización Dual: OCs Pendientes y Generadas)
 * =================================================================================================
 * @file RfqApprovalModal.jsx
 * @description Este modal muestra los bloques de compras pendientes y también los ya generados
 * para cada proveedor, separando visualmente cada caso.
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

// ===============================================================================================
// --- COMPONENTE PRINCIPAL ---
// ===============================================================================================
export default function RfqApprovalModal({ open, onClose, rfqId, refreshList, setGlobalLoading }) {
  // --- Estado local ---
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false); // <-- Este 'loading' controla el botón

  // =============================================================================================
  // --- FUNCIONES DE CARGA Y UTILIDAD ---
  // =============================================================================================

  // Cargar detalles del RFQ
  const fetchDetails = useCallback(async () => {
    if (!rfqId) return;
    setLoading(true); // <-- Usamos el loading local para el spinner interno
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
      fetchDetails();
    } else {
      setDetails(null); // Limpia detalles al cerrar
    }
  }, [open, fetchDetails]);

  // Agrupar líneas: separa líneas pendientes vs. líneas ya con OC por proveedor
const proveedoresBloques = useMemo(() => {
  if (!details) return { pendientes: [], bloqueadas: [] };

  const opcionesBloqueadas = details.opciones_bloqueadas || [];

  // Estructura: { [proveedorId]: { nombre, opciones: [], bloqueada: bool, adjuntos: [] } }
  const agrupadosPendientes = {};
  const agrupadosBloqueados = {};

  details.materiales.forEach(material => {
    // --- OPCIONES PENDIENTES (no bloqueadas) ---
    material.opciones
      .filter(op =>
        op.seleccionado === true &&
        !opcionesBloqueadas.includes(op.id)
      )
      .forEach(op => {
        const provId = op.proveedor_id;
        if (!agrupadosPendientes[provId]) {
          agrupadosPendientes[provId] = {
            nombre: op.proveedor_razon_social || op.proveedor_nombre,
            opciones: [],
            adjuntos: details.adjuntos_cotizacion?.filter(a => a.proveedor_id === provId) || [],
            bloqueada: false
          };
        }
        agrupadosPendientes[provId].opciones.push({ ...op, materialNombre: material.material });
      });

    // --- OPCIONES BLOQUEADAS (YA OC) ---
    material.opciones
      .filter(op =>
        op.seleccionado === true &&
        opcionesBloqueadas.includes(op.id)
      )
      .forEach(op => {
        const provId = op.proveedor_id;
        if (!agrupadosBloqueados[provId]) {
          agrupadosBloqueados[provId] = {
            nombre: op.proveedor_razon_social || op.proveedor_nombre,
            opciones: [],
            adjuntos: details.adjuntos_cotizacion?.filter(a => a.proveedor_id === provId) || [],
            bloqueada: true
          };
        }
        agrupadosBloqueados[provId].opciones.push({ ...op, materialNombre: material.material });
      });
  });

  // Mapea a array, solo los proveedores con líneas correspondientes
  const pendientes = Object.values(agrupadosPendientes).map(grupo => ({
    ...grupo,
    resumenFinanciero: calcularResumenParaModal(grupo.opciones)
  }));

  const bloqueadas = Object.values(agrupadosBloqueados).map(grupo => ({
    ...grupo,
    resumenFinanciero: calcularResumenParaModal(grupo.opciones)
  }));

  return { pendientes, bloqueadas };
}, [details]);


  // Descargar PDF OC generada
  const handleDownloadPdf = async (ocId) => {
    try {
      toast.info("Preparando descarga del PDF...");
      const response = await api.get(`/api/ocs/${ocId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      let fileName = `OC-${ocId}.pdf`;
      const contentDisposition = response.headers['content-disposition'];
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
    // ==================================================================
    // --- INICIO DE LA CORRECCIÓN ---
    // ==================================================================
    setLoading(true); // <-- CORRECCIÓN 1: Deshabilita el botón local INMEDIATAMENTE
    setGlobalLoading(true); // Muestra el spinner global
    
    try {
      toast.info("Iniciando proceso de generación...");
      const response = await api.post(`/api/rfq/${rfqId}/generar-ocs`, { proveedorId });
      toast.success(response.mensaje);
      if (response.ocs && response.ocs.length > 0) {
        await handleDownloadPdf(response.ocs[0].id);
      }
      await fetchDetails(); // Espera a que los detalles se recarguen
      refreshList(); // Actualiza la lista principal
    } catch (err) {
      toast.error(err.error || "Ocurrió un error al generar la OC.");
    } finally {
      setGlobalLoading(false); // Oculta el spinner global
      setLoading(false); // <-- CORRECCIÓN 2: Rehabilita el botón local al finalizar
    }
    // ==================================================================
    // --- FIN DE LA CORRECCIÓN ---
    // ==================================================================
  };

  // =============================================================================================
  // --- UI: RENDERIZADO ---
  // =============================================================================================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Generar Órdenes de Compra para: <strong>{details?.rfq_code}</strong>
      </DialogTitle>
      <DialogContent dividers>
        {loading && !details ? ( // Muestra spinner solo si está cargando por primera vez
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
                {proveedoresBloques.pendientes.map((grupo, index) => {
                  const provId = grupo.opciones[0].proveedor_id;
                  return (
                    <Paper key={`pendiente-${provId}`} variant="outlined" sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {grupo.nombre}
                      </Typography>
                      <List dense>
                        {grupo.opciones.map(item => (
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
                            {grupo.adjuntos.map(file => (
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
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total ({grupo.resumenFinanciero.moneda}):</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${grupo.resumenFinanciero.total.toFixed(2)}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                          variant="contained"
                          color="success"
                          onClick={() => handleGenerateOC(provId)}
                          disabled={loading} // <-- El botón ahora se deshabilita con el 'loading' local
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
                    key={`bloqueada-${grupo.opciones[0].proveedor_id}-${index}`}
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
                    <Box sx={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%', height: '100%',
                      background: 'rgba(255,255,255,0.3)',
                      zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <LockIcon sx={{ fontSize: 32, mb: 1, color: '#757575' }} />
                      <Typography color="text.secondary" fontWeight={600}>OC Generada (Inhabilitado)</Typography>
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#757575' }}>
                      {grupo.nombre}
                    </Typography>
                    <List dense>
                      {grupo.opciones.map(item => (
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
                          {grupo.adjuntos.map(file => (
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
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total ({grupo.resumenFinanciero.moneda}):</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${grupo.resumenFinanciero.total.toFixed(2)}</Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </>
            )}

            {proveedoresBloques.pendientes.length === 0 && proveedoresBloques.bloqueadas.length === 0 && !loading && (
              <Alert severity="success">
                ¡Excelente! Todas las líneas de este RFQ ya tienen una Orden de Compra generada.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}> {/* Deshabilita Cerrar mientras se genera */}
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}