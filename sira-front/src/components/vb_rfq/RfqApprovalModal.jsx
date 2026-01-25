/**
 * =================================================================================================
 * COMPONENTE: RfqApprovalModal (Visualización Dual: OCs Pendientes y Generadas)
 * =================================================================================================
 * @file RfqApprovalModal.jsx
 * @description
 *  Modal para generar Órdenes de Compra desde VB_RFQ.
 *  - Agrupa por proveedor las líneas seleccionadas (ganadoras) pendientes por generar OC.
 *  - Muestra también las líneas seleccionadas que ya están bloqueadas (ya tienen OC).
 *  - IMPORTANTE: Soporta RFQ parcial: puede haber materiales sin asignación, pero si NO hay
 *    ninguna opción seleccionada, no se puede generar OC y se debe mostrar un mensaje claro.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Paper,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Link,
  ListItemIcon
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LockIcon from '@mui/icons-material/Lock';
import { calcularResumenParaModal } from './vbRfqUtils';

export default function RfqApprovalModal({ open, onClose, rfqId, refreshList, setGlobalLoading }) {
  // =============================================================================================
  // ESTADO LOCAL
  // =============================================================================================
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false); // controla spinner interno y deshabilitado del botón "Cerrar"

  // =============================================================================================
  // CARGA DE DETALLE RFQ
  // =============================================================================================
  const fetchDetails = useCallback(async () => {
    if (!rfqId) return;
    setLoading(true);
    try {
      const data = await api.get(`/api/rfq/${rfqId}`);
      setDetails(data);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo recargar el detalle del RFQ.');
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    if (open) {
      fetchDetails();
    } else {
      setDetails(null);
    }
  }, [open, fetchDetails]);

  // =============================================================================================
  // DERIVADOS: selección / bloqueos
  // =============================================================================================
  const selectedCount = useMemo(() => {
    if (!details?.materiales) return 0;
    let count = 0;
    details.materiales.forEach((m) => {
      (m?.opciones || []).forEach((op) => {
        if (op?.seleccionado === true) count += 1;
      });
    });
    return count;
  }, [details]);

  const opcionesBloqueadasSet = useMemo(() => {
    // Normalización para evitar bugs por tipos (string vs number)
    const raw = details?.opciones_bloqueadas || [];
    return new Set(raw.map((x) => Number(x)));
  }, [details]);

  // =============================================================================================
  // AGRUPACIÓN POR PROVEEDOR (pendientes vs bloqueadas)
  // =============================================================================================
  const proveedoresBloques = useMemo(() => {
    if (!details?.materiales) return { pendientes: [], bloqueadas: [] };

    // Estructura: { [proveedorId]: { nombre, opciones: [], bloqueada: bool, adjuntos: [] } }
    const agrupadosPendientes = {};
    const agrupadosBloqueados = {};

    details.materiales.forEach((material) => {
      const opciones = material?.opciones || [];

      // --- OPCIONES PENDIENTES (seleccionadas y NO bloqueadas) ---
      opciones
        .filter((op) => op?.seleccionado === true && !opcionesBloqueadasSet.has(Number(op?.id)))
        .forEach((op) => {
          const provId = op.proveedor_id;
          if (!provId) return;

          if (!agrupadosPendientes[provId]) {
            agrupadosPendientes[provId] = {
              nombre: op.proveedor_razon_social || op.proveedor_nombre || `Proveedor ${provId}`,
              opciones: [],
              adjuntos: details.adjuntos_cotizacion?.filter((a) => Number(a.proveedor_id) === Number(provId)) || [],
              bloqueada: false
            };
          }
          agrupadosPendientes[provId].opciones.push({ ...op, materialNombre: material.material });
        });

      // --- OPCIONES BLOQUEADAS (seleccionadas y YA tienen OC) ---
      opciones
        .filter((op) => op?.seleccionado === true && opcionesBloqueadasSet.has(Number(op?.id)))
        .forEach((op) => {
          const provId = op.proveedor_id;
          if (!provId) return;

          if (!agrupadosBloqueados[provId]) {
            agrupadosBloqueados[provId] = {
              nombre: op.proveedor_razon_social || op.proveedor_nombre || `Proveedor ${provId}`,
              opciones: [],
              adjuntos: details.adjuntos_cotizacion?.filter((a) => Number(a.proveedor_id) === Number(provId)) || [],
              bloqueada: true
            };
          }
          agrupadosBloqueados[provId].opciones.push({ ...op, materialNombre: material.material });
        });
    });

    const pendientes = Object.values(agrupadosPendientes).map((grupo) => ({
      ...grupo,
      resumenFinanciero: calcularResumenParaModal(grupo.opciones)
    }));

    const bloqueadas = Object.values(agrupadosBloqueados).map((grupo) => ({
      ...grupo,
      resumenFinanciero: calcularResumenParaModal(grupo.opciones)
    }));

    return { pendientes, bloqueadas };
  }, [details, opcionesBloqueadasSet]);

  // =============================================================================================
  // ACCIONES: Descargar PDF
  // =============================================================================================
  const handleDownloadPdf = async (ocId) => {
    try {
      toast.info('Preparando descarga del PDF...');
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
    } catch (err) {
      console.error(err);
      toast.error('No se pudo descargar el PDF.');
    }
  };

  // =============================================================================================
  // ACCIONES: Generar OC por proveedor (solo pendientes)
  // =============================================================================================
  const handleGenerateOC = async (proveedorId) => {
    setLoading(true);
    setGlobalLoading(true);

    try {
      toast.info('Iniciando proceso de generación...');
      const response = await api.post(`/api/rfq/${rfqId}/generar-ocs`, { proveedorId });

      toast.success(response?.mensaje || 'OC generada correctamente.');

      // Backend regresa { ocs: [{ id, numero_oc }] }
      if (response?.ocs?.length > 0) {
        await handleDownloadPdf(response.ocs[0].id);
      }

      await fetchDetails();
      refreshList?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.error || 'Ocurrió un error al generar la OC.');
    } finally {
      setGlobalLoading(false);
      setLoading(false);
    }
  };

  // =============================================================================================
  // UI: RENDER
  // =============================================================================================
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Generar Órdenes de Compra para: <strong>{details?.rfq_code || `RFQ ${rfqId || ''}`}</strong>
      </DialogTitle>

      <DialogContent dividers>
        {loading && !details ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <CircularProgress />
          </div>
        ) : (
          <Box>
            {/* =========================
                MENSAJES DE ESTADO (CLAVE PARA EL BUG)
               ========================= */}

            {/* Si no cargó el detalle */}
            {!details && !loading && (
              <Alert severity="error" sx={{ mb: 2 }}>
                No se pudo cargar el detalle del RFQ. Intenta cerrar y volver a abrir este modal.
              </Alert>
            )}

            {/* Si el RFQ llegó a VB pero aún no tiene ninguna opción ganadora seleccionada */}
            {details && selectedCount === 0 && !loading && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Aún no hay líneas seleccionadas para generar una Orden de Compra. <br />
                Regresa a <strong>G_RFQ</strong>, selecciona al menos un proveedor (opción ganadora) y vuelve a intentar.
              </Alert>
            )}

            {/* =========================
                BLOQUES PENDIENTES DE OC
               ========================= */}
            {proveedoresBloques.pendientes.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  OCs Pendientes de Generar
                </Typography>

                {proveedoresBloques.pendientes.map((grupo) => {
                  const provId = grupo?.opciones?.[0]?.proveedor_id;
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
                              <ListItem
                                key={file.id}
                                component={Link}
                                href={file.ruta_archivo}
                                target="_blank"
                                button
                                dense
                              >
                                <ListItemIcon sx={{ minWidth: 32 }}>
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
                            <Typography variant="body2" color="error">
                              Ret. ISR:
                            </Typography>
                            <Typography variant="body2" color="error">
                              -${grupo.resumenFinanciero.retIsr.toFixed(2)}
                            </Typography>
                          </Box>
                        )}
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
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
                          onClick={() => handleGenerateOC(provId)}
                          disabled={loading || !provId}
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
                BLOQUES BLOQUEADOS (YA CON OC)
               ========================= */}
            {proveedoresBloques.bloqueadas.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Líneas ya con Orden de Compra
                </Typography>

                {proveedoresBloques.bloqueadas.map((grupo, idx) => (
                  <Paper key={`bloqueada-${idx}`} variant="outlined" sx={{ p: 2, mb: 2, opacity: 0.92 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LockIcon fontSize="small" /> {grupo.nombre}
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
                            <ListItem
                              key={file.id}
                              component={Link}
                              href={file.ruta_archivo}
                              target="_blank"
                              button
                              dense
                            >
                              <ListItemIcon sx={{ minWidth: 32 }}>
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
                          <Typography variant="body2" color="error">
                            Ret. ISR:
                          </Typography>
                          <Typography variant="body2" color="error">
                            -${grupo.resumenFinanciero.retIsr.toFixed(2)}
                          </Typography>
                        </Box>
                      )}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
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

            {/* =========================
                MENSAJE FINAL (CORREGIDO)
               =========================
               Antes: si pendientes=0 y bloqueadas=0 => "¡Excelente!..."
               Ahora:
               - Si selectedCount=0 => warning (no hay nada seleccionado)
               - Si selectedCount>0 pero no hay pendientes y no hay bloqueadas => caso raro, lo tratamos como info
               - Si selectedCount>0 y pendientes=0 y bloqueadas>0 => ya hay OCs para lo seleccionado (no mostramos éxito falso)
            */}
            {details && selectedCount > 0 && proveedoresBloques.pendientes.length === 0 && proveedoresBloques.bloqueadas.length === 0 && !loading && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No hay bloques pendientes para generar. Revisa la selección de proveedores en G_RFQ.
              </Alert>
            )}

            {details && selectedCount > 0 && proveedoresBloques.pendientes.length === 0 && proveedoresBloques.bloqueadas.length > 0 && !loading && (
              <Alert severity="success" sx={{ mt: 2 }}>
                ¡Listo! Todas las líneas seleccionadas ya tienen una Orden de Compra generada.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
