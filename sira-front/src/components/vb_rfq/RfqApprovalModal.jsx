//C:\SIRA\sira-front\src\components\vb_rfq\RfqApprovalModal.jsx
// ... (importaciones no cambian)
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress,
  Paper, Typography, Alert, List, ListItem, ListItemText, ListItemIcon, Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { calcularResumenParaModal } from './vbRfqUtils';

export default function RfqApprovalModal({ open, onClose, rfqId, refreshList }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (open && rfqId) {
      setLoading(true);
      api.get(`/api/rfq/${rfqId}`)
        .then(data => setDetails(data))
        .catch(() => toast.error("No se pudo cargar el detalle del RFQ."))
        .finally(() => setLoading(false));
    } else {
      setDetails(null);
    }
  }, [open, rfqId]);

  const { pendientes, generadas } = useMemo(() => {
    if (!details) return { pendientes: {}, generadas: [] };

    const pendientes = {};
    const generadasMap = new Map();

    details.materiales.forEach(material => {
      // 1. Encontrar la opción que el comprador eligió ("seleccionado: true")
      const opcionGanadora = material.opciones.find(op => op.seleccionado === true);
      
      // Si no hay opción ganadora para este material, no hacemos nada.
      if (!opcionGanadora) return;

      // 2. --- ¡LA CORRECCIÓN CLAVE ESTÁ AQUÍ! ---
      // Si el material está pendiente, lo agrupamos para ser autorizado.
      if (material.status_compra === 'PENDIENTE') {
        const provId = opcionGanadora.proveedor_id;
        if (!pendientes[provId]) {
          pendientes[provId] = {
            nombre: opcionGanadora.proveedor_razon_social || opcionGanadora.proveedor_nombre,
            opciones: [],
          };
        }
        pendientes[provId].opciones.push({ ...opcionGanadora, materialNombre: material.material });
      
      } else { // Si no está pendiente, significa que ya tiene una OC.
        const ocId = Number(material.status_compra);
        if (!isNaN(ocId) && !generadasMap.has(ocId)) {
          // Buscamos la info de la OC en los datos que (idealmente) vendrían del backend.
          // Si no vienen, creamos un placeholder.
          const ocInfo = details.ordenes_compra?.find(oc => oc.id === ocId) || { id: ocId, numero_oc: `OC-${ocId}`, status: 'GENERADA' };
          generadasMap.set(ocId, ocInfo);
        }
      }
    });

    return { pendientes, generadas: Array.from(generadasMap.values()) };
  }, [details]);


  const handleAuthorizeOC = async (providerId, opciones) => {
    // ... (El resto de esta función no necesita cambios)
    setProcessingId(providerId);
    const opcionIds = opciones.map(op => op.id);
    try {
      toast.info("Paso 1/2: Generando registro de la OC...");
      const genRes = await api.post(`/api/ocs/rfq/${rfqId}/generar-oc`, { opcionIds, proveedor_id: providerId });
      const nuevaOcId = genRes.ordenDeCompra.id;
      toast.success(`OC ${genRes.ordenDeCompra.numero_oc} generada.`);
      
      toast.info("Paso 2/2: Autorizando y distribuyendo...");
      const authRes = await api.post(`/api/ocs/${nuevaOcId}/autorizar`);
      toast.success(authRes.mensaje);

      refreshList();
      onClose();
    } catch (err) {
      toast.error(err.error || "Ocurrió un error en la autorización.");
    } finally {
      setProcessingId(null);
    }
  };

  // ... (El JSX de renderizado no necesita cambios)
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Revisión y Autorización de OC para: <strong>{details?.rfq_code}</strong></DialogTitle>
      <DialogContent dividers>
        {loading ? <CircularProgress /> : !details ? <p>No hay datos.</p> : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box>
              <Typography variant="h6" gutterBottom>OCs Listas para Autorizar</Typography>
              {Object.keys(pendientes).length > 0 ? Object.entries(pendientes).map(([providerId, data]) => {
                const resumen = calcularResumenParaModal(data.opciones);
                const isProcessing = processingId === providerId;
                return (
                  <Paper key={providerId} sx={{ p: 2, mb: 2 }} variant="outlined">
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{data.nombre}</Typography>
                    <List dense>
                      {data.opciones.map(item => (
                        <ListItem key={item.id} sx={{ pl: 0 }}>
                           <ListItemText primary={item.materialNombre} secondary={`Cant: ${Number(item.cantidad_cotizada).toFixed(2)} @ $${Number(item.precio_unitario).toFixed(4)}`}/>
                        </ListItem>
                      ))}
                    </List>
                    <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                       <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Subtotal:</Typography><Typography variant="body2">${resumen.subTotal.toFixed(2)}</Typography></Box>
                       <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">IVA:</Typography><Typography variant="body2">${resumen.iva.toFixed(2)}</Typography></Box>
                       {resumen.retIsr > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Ret. ISR:</Typography><Typography variant="body2" color="error">-${resumen.retIsr.toFixed(2)}</Typography></Box>}
                       <Divider sx={{ my: 1 }}/>
                       <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total ({resumen.moneda}):</Typography><Typography variant="body1" sx={{ fontWeight: 'bold' }}>${resumen.total.toFixed(2)}</Typography></Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                      <Button variant="contained" color="success" onClick={() => handleAuthorizeOC(providerId, data.opciones)} disabled={isProcessing}>
                        {isProcessing ? <CircularProgress size={24} /> : 'Autorizar y Enviar'}
                      </Button>
                    </Box>
                  </Paper>
                );
              }) : <Alert severity="info">No hay nuevas Órdenes de Compra pendientes de autorizar en este RFQ.</Alert>}
            </Box>
            <Box>
              <Typography variant="h6" gutterBottom>OCs ya Generadas</Typography>
              {generadas.length > 0 ? (
                <List component={Paper} variant="outlined">
                  {generadas.map(oc => (
                    <ListItem key={oc.id}>
                      <ListItemIcon>{oc.status === 'APROBADA' ? <CheckCircleIcon color="success" /> : <PendingActionsIcon color="warning" />}</ListItemIcon>
                      <ListItemText primary={<><strong>{oc.numero_oc}</strong> - {oc.proveedor_razon_social}</>} secondary={`Estado: ${oc.status}`} />
                      <Typography variant="body2">${Number(oc.total).toFixed(2)}</Typography>
                    </ListItem>
                  ))}
                </List>
              ) : <Alert severity="info">Aún no se ha generado ninguna Orden de Compra para este RFQ.</Alert>}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
};