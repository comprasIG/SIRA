//C:\SIRA\sira-front\src\components\vb_rfq\RfqApprovalModal.jsx
/**
 * =================================================================================================
 * COMPONENTE: RfqApprovalModal
 * =================================================================================================
 * @file RfqApprovalModal.jsx
 * @description Modal final para que el gerente revise y genere todas las OCs de un RFQ.
 * Muestra un resumen de las compras seleccionadas y, con un solo botón, ejecuta
 * todo el proceso de generación y distribución (PDF, Drive, Email).
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress,
  Paper, Typography, Alert, List, ListItem, ListItemText, Divider
} from '@mui/material';
import { calcularResumenParaModal } from './vbRfqUtils';

export default function RfqApprovalModal({ open, onClose, rfqId, refreshList }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // --- LÓGICA CORREGIDA: Agrupa las opciones que el comprador marcó como 'seleccionado: true' ---
  const preOcsPorProveedor = useMemo(() => {
    if (!details) return [];
    const agrupado = {};
    details.materiales.forEach(material => {
      // La clave está en buscar la opción que el comprador ya eligió.
      const opcionGanadora = material.opciones.find(op => op.seleccionado === true);
      if (opcionGanadora) {
        const provId = opcionGanadora.proveedor_id;
        if (!agrupado[provId]) {
          agrupado[provId] = {
            nombre: opcionGanadora.proveedor_razon_social || opcionGanadora.proveedor_nombre,
            opciones: [],
          };
        }
        agrupado[provId].opciones.push({ ...opcionGanadora, materialNombre: material.material });
      }
    });
    
    return Object.values(agrupado).map(grupo => ({
      ...grupo,
      resumenFinanciero: calcularResumenParaModal(grupo.opciones)
    }));
  }, [details]);

  /**
   * @description Maneja el clic en el botón principal. Llama a la nueva ruta "todo en uno" del backend.
   */
  const handleGenerateAndSendOCs = async () => {
    setIsProcessing(true);
    try {
      toast.info("Iniciando proceso... Esto puede tardar un momento.", { autoClose: 5000 });
      // --- LLAMADA ÚNICA AL BACKEND ---
      const response = await api.post(`/api/rfq/${rfqId}/generar-ocs`);
      toast.success(response.mensaje);
      refreshList(); // Actualiza la lista principal (el RFQ desaparecerá de "Por Aprobar")
      onClose();     // Cierra el modal
    } catch (err) {
      toast.error(err.error || "Ocurrió un error al generar las OCs.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Generar OCs para RFQ: <strong>{details?.rfq_code}</strong></DialogTitle>
      <DialogContent dividers>
        {loading || !details ? <div style={{ textAlign: 'center', padding: '20px' }}><CircularProgress /></div> : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Resumen de OCs a Generar</Typography>
            {preOcsPorProveedor.length > 0 ? (
              preOcsPorProveedor.map((grupo, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
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
                  <Divider sx={{ my: 1 }} />
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Subtotal:</Typography><Typography variant="body2">${grupo.resumenFinanciero.subTotal.toFixed(2)}</Typography></Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">IVA:</Typography><Typography variant="body2">${grupo.resumenFinanciero.iva.toFixed(2)}</Typography></Box>
                    {grupo.resumenFinanciero.retIsr > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="error">Ret. ISR:</Typography><Typography variant="body2" color="error">-${grupo.resumenFinanciero.retIsr.toFixed(2)}</Typography></Box>}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total ({grupo.resumenFinanciero.moneda}):</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${grupo.resumenFinanciero.total.toFixed(2)}</Typography>
                    </Box>
                  </Box>
                </Paper>
              ))
            ) : (
              <Alert severity="warning">No se encontraron opciones de compra seleccionadas en este RFQ.</Alert>
            )}
          </Box> 
        )}
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleGenerateAndSendOCs}
          disabled={isProcessing || loading || preOcsPorProveedor.length === 0}
        >
          {isProcessing ? <CircularProgress size={24} color="inherit" /> : `Generar ${preOcsPorProveedor.length} OC(s) y Enviar`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};