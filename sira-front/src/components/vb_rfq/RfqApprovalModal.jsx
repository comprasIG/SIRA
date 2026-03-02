/**
 * =================================================================================================
 * COMPONENTE: RfqApprovalModal (Visualización Dual: OCs Pendientes y Generadas)
 * =================================================================================================
 * @file RfqApprovalModal.jsx
 *
 * Incluye:
 * - URGENTE + Comentarios finanzas (por OC / por ejecución)
 * - Descarga automática del PDF al generar OC
 *
 * Fix (v2):
 * - Compatibilidad con wrapper api.js (no Axios puro) cuando responseType = 'blob'
 *   Evita error "No se pudo descargar el PDF" aunque el backend responda correctamente.
 * =================================================================================================
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
  ListItemIcon,
  Checkbox,
  FormControlLabel,
  TextField
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LockIcon from '@mui/icons-material/Lock';
import { calcularResumenParaModal } from './vbRfqUtils';
import ImpoPrefsSection from '../ImpoPrefsSection';

export default function RfqApprovalModal({ open, onClose, rfqId, refreshList, setGlobalLoading }) {
  // =============================================================================================
  // ESTADO LOCAL
  // =============================================================================================
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Draft por proveedor (aplica a la OC que se generará en esa ejecución)
   * { [proveedorId]: { esUrgente, comentariosFinanzas, imprimir_proyecto, sitio_entrega_id, imprimir_direccion_entrega, incoterm_id } }
   */
  const [ocDraftByProveedor, setOcDraftByProveedor] = useState({});
  const [incoterms, setIncoterms] = useState([]);
  const [sitios,    setSitios]    = useState([]);

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
      // Cargar catálogos IMPO (ligeros, siempre útil tenerlos listos)
      api.get('/api/incrementables/catalogos/incoterms').then(d => setIncoterms(d || [])).catch(() => {});
      api.get('/api/sitios').then(d => setSitios(d || [])).catch(() => {});
    } else {
      setDetails(null);
      setOcDraftByProveedor({});
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
    const raw = details?.opciones_bloqueadas || [];
    return new Set(raw.map((x) => Number(x)));
  }, [details]);

  // =============================================================================================
  // AGRUPACIÓN POR PROVEEDOR (pendientes vs bloqueadas)
  // =============================================================================================
  const proveedoresBloques = useMemo(() => {
    if (!details?.materiales) return { pendientes: [], bloqueadas: [] };

    const agrupadosPendientes = {};
    const agrupadosBloqueados = {};

    details.materiales.forEach((material) => {
      const opciones = material?.opciones || [];

      // PENDIENTES (seleccionadas y NO bloqueadas)
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

      // BLOQUEADAS (seleccionadas y YA tienen OC)
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
  // INICIALIZACIÓN DEL DRAFT (por proveedor pendiente)
  // =============================================================================================
  useEffect(() => {
    if (!open) return;

    setOcDraftByProveedor((prev) => {
      const next = { ...prev };

      // Agregar claves nuevas
      proveedoresBloques.pendientes.forEach((grupo) => {
        const provId = grupo?.opciones?.[0]?.proveedor_id;
        if (!provId) return;

        if (!next[provId]) {
          next[provId] = {
            esUrgente: false,
            comentariosFinanzas: '',
            imprimir_proyecto: true,
            sitio_entrega_id: null,
            imprimir_direccion_entrega: true,
            incoterm_id: null,
          };
        }
      });

      // Limpiar claves que ya no existan (por refresh)
      const pendientesIds = new Set(
        proveedoresBloques.pendientes
          .map((g) => g?.opciones?.[0]?.proveedor_id)
          .filter(Boolean)
          .map((x) => String(x))
      );

      Object.keys(next).forEach((k) => {
        if (!pendientesIds.has(String(k))) delete next[k];
      });

      return next;
    });
  }, [open, proveedoresBloques.pendientes]);

  // =============================================================================================
  // HELPERS: Descargar PDF (compat Axios + wrapper api.js)
  // =============================================================================================
  const extractBlobResponse = (resp) => {
    // Axios típico: { data, headers, status }
    // Wrapper tuyo: puede regresar { data, headers, status } o ya regresar data directo
    if (!resp) return { blob: null, headers: {} };

    // Si es Axios-like
    if (resp.data instanceof Blob) return { blob: resp.data, headers: resp.headers || {} };

    // Si es wrapper y data es ArrayBuffer / Blob
    if (resp.data && (resp.data instanceof ArrayBuffer)) {
      return { blob: new Blob([resp.data]), headers: resp.headers || {} };
    }

    // Si la función api.get devuelve directo el data (raro para blob, pero por compat)
    if (resp instanceof Blob) return { blob: resp, headers: {} };

    return { blob: null, headers: resp.headers || {} };
  };

  const parseFilenameFromContentDisposition = (contentDisposition) => {
    if (!contentDisposition) return null;

    // Soporta filename="..." y filename*=UTF-8''...
    const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try { return decodeURIComponent(utf8Match[1]); } catch { return utf8Match[1]; }
    }

    const match = contentDisposition.match(/filename="(.+?)"/i);
    if (match?.[1]) return match[1];

    return null;
  };

  const handleDownloadPdf = async (ocId) => {
    try {
      toast.info('Preparando descarga del PDF...');

      // IMPORTANTE: api.js tuyo recibe el config como segundo parámetro (fetch/axios wrapper)
      const resp = await api.get(`/api/ocs/${ocId}/pdf`, { responseType: 'blob' });

      const { blob, headers } = extractBlobResponse(resp);
      if (!blob) {
        console.error('[PDF Download] Respuesta inválida:', resp);
        toast.error('La respuesta del PDF no es válida.');
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // filename desde headers (Axios: headers['content-disposition'], Fetch: headers.get('content-disposition'))
      const cd =
        (headers && (headers['content-disposition'] || headers['Content-Disposition'])) ||
        (typeof headers?.get === 'function' ? headers.get('content-disposition') : null);

      const headerFileName = parseFilenameFromContentDisposition(cd);

      link.setAttribute('download', headerFileName || `OC-${ocId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PDF descargado.');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo descargar el PDF.');
    }
  };

  // =============================================================================================
  // ACCIONES: Generar OC por proveedor
  // =============================================================================================
  // =============================================================================================
  // ACCIONES: Cerrar definitivamente (descartar líneas sin OC)
  // =============================================================================================
  const handleCerrarDefinitivamente = async () => {
    if (!window.confirm(
      '¿Cerrar esta requisición definitivamente?\n\nLas líneas sin Orden de Compra serán descartadas. Esta acción no se puede deshacer.'
    )) return;

    setLoading(true);
    setGlobalLoading(true);
    try {
      const result = await api.post(`/api/rfq/${rfqId}/cerrar`);
      toast.success(result?.mensaje || 'Requisición cerrada definitivamente.');
      refreshList?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err?.error || 'Error al cerrar la requisición.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleGenerateOC = async (proveedorId) => {
    setLoading(true);
    setGlobalLoading(true);

    try {
      const draft = ocDraftByProveedor?.[proveedorId] || { esUrgente: false, comentariosFinanzas: '' };
      const payload = {
        proveedorId,
        esUrgente: Boolean(draft.esUrgente),
        comentariosFinanzas: typeof draft.comentariosFinanzas === 'string' ? draft.comentariosFinanzas.trim() : '',
        preferencias_impo: {
          imprimir_proyecto: draft.imprimir_proyecto !== false,
          sitio_entrega_id: draft.sitio_entrega_id || null,
          imprimir_direccion_entrega: draft.imprimir_direccion_entrega !== false,
          incoterm_id: draft.incoterm_id || null,
        },
      };

      toast.info('Iniciando proceso de generación...');
      const response = await api.post(`/api/rfq/${rfqId}/generar-ocs`, payload);

      toast.success(response?.mensaje || 'OC generada correctamente.');

      if (response?.ocs?.length > 0) {
        await handleDownloadPdf(response.ocs[0].id);
      }

      await fetchDetails();
      refreshList?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.error || err?.message || 'Ocurrió un error al generar la OC.');
    } finally {
      setGlobalLoading(false);
      setLoading(false);
    }
  };

  // =============================================================================================
  // UI
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
            {!details && !loading && (
              <Alert severity="error" sx={{ mb: 2 }}>
                No se pudo cargar el detalle del RFQ. Intenta cerrar y volver a abrir este modal.
              </Alert>
            )}

            {details && selectedCount === 0 && !loading && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Aún no hay líneas seleccionadas para generar una Orden de Compra. <br />
                Regresa a <strong>G_RFQ</strong>, selecciona al menos un proveedor (opción ganadora) y vuelve a intentar.
              </Alert>
            )}

            {proveedoresBloques.pendientes.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  OCs Pendientes de Generar
                </Typography>

                {proveedoresBloques.pendientes.map((grupo) => {
                  const provId = grupo?.opciones?.[0]?.proveedor_id;
                  const draft = ocDraftByProveedor?.[provId] || { esUrgente: false, comentariosFinanzas: '' };
                  const esImpo = grupo.opciones.some(op => op.es_importacion === true);

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

                      <Divider sx={{ my: 1 }} />

                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(draft.esUrgente)}
                              onChange={(e) =>
                                setOcDraftByProveedor((prev) => ({
                                  ...prev,
                                  [provId]: {
                                    ...(prev?.[provId] || { esUrgente: false, comentariosFinanzas: '' }),
                                    esUrgente: e.target.checked
                                  }
                                }))
                              }
                            />
                          }
                          label="URGENTE"
                        />

                        <TextField
                          label="Comentarios finanzas (se imprimen en el PDF)"
                          value={draft.comentariosFinanzas}
                          onChange={(e) =>
                            setOcDraftByProveedor((prev) => ({
                              ...prev,
                              [provId]: {
                                ...(prev?.[provId] || { esUrgente: false, comentariosFinanzas: '' }),
                                comentariosFinanzas: e.target.value
                              }
                            }))
                          }
                          multiline
                          minRows={2}
                          maxRows={4}
                          fullWidth
                          placeholder="Ej. Prioridad alta, requerimos pago anticipado / condiciones especiales / etc."
                        />
                      </Box>

                      {esImpo && (
                        <ImpoPrefsSection
                          value={draft}
                          onChange={(patch) => setOcDraftByProveedor(prev => ({
                            ...prev,
                            [provId]: { ...(prev[provId] || {}), ...patch }
                          }))}
                          sitios={sitios}
                          incoterms={incoterms}
                        />
                      )}

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

            {proveedoresBloques.bloqueadas.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Líneas ya con Orden de Compra
                </Typography>

                {proveedoresBloques.bloqueadas.map((grupo, idx) => (
                  <Paper key={`bloqueada-${idx}`} variant="outlined" sx={{ p: 2, mb: 2, opacity: 0.92 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}
                    >
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
                  </Paper>
                ))}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cerrar
        </Button>
        <Button
          onClick={handleCerrarDefinitivamente}
          color="error"
          variant="outlined"
          disabled={loading || proveedoresBloques.pendientes.length === 0}
        >
          Cerrar definitivamente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
