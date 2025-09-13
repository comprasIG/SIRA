//C:\SIRA\sira-front\src\components\vb_rfq\RfqApprovalModal.jsx
/**
 * =================================================================================================
 * COMPONENTE: RfqApprovalModal (Con Compras Divididas y Loader Global)
 * =================================================================================================
 * @file RfqApprovalModal.jsx
 * @description Este modal ahora permite generar OCs para compras divididas (múltiples
 * proveedores para un mismo material) y utiliza una función 'setGlobalLoading' para
 * activar un loader en toda la pantalla durante la generación de la OC.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress,
  Paper, Typography, Alert, List, ListItem, ListItemText, Divider, Link, ListItemIcon
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { calcularResumenParaModal } from './vbRfqUtils';

export default function RfqApprovalModal({ open, onClose, rfqId, refreshList, setGlobalLoading }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

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
      fetchDetails();
    } else {
      setDetails(null);
    }
  }, [open, fetchDetails]);

  const ocsPendientes = useMemo(() => {
    if (!details) return [];
    
    const agrupado = {};
    details.materiales.forEach(material => {
      // Usamos .filter() para encontrar TODAS las opciones seleccionadas.
      const opcionesGanadoras = material.opciones.filter(op => op.seleccionado === true);
      
      opcionesGanadoras.forEach(opcion => {
        if (material.status_compra === 'PENDIENTE') {
          const provId = opcion.proveedor_id;
          if (!agrupado[provId]) {
            agrupado[provId] = {
              nombre: opcion.proveedor_razon_social || opcion.proveedor_nombre,
              opciones: [],
              adjuntos: details.adjuntos_cotizacion?.filter(a => a.proveedor_id === provId) || []
            };
          }
          agrupado[provId].opciones.push({ ...opcion, materialNombre: material.material });
        }
      });
    });
    
    return Object.values(agrupado).map(grupo => ({
      ...grupo,
      resumenFinanciero: calcularResumenParaModal(grupo.opciones)
    }));
  }, [details]);

  const handleDownloadPdf = async (ocId) => {
    try {
        toast.info("Preparando descarga del PDF...");
        const response = await api.get(`/api/ocs/${ocId}/pdf`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const contentDisposition = response.headers['content-disposition'];
        let fileName = `OC-${ocId}.pdf`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
        }
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        toast.error("No se pudo descargar el PDF.");
        console.error("Error al descargar PDF:", error);
    }
  };

  const handleGenerateOC = async (proveedorId) => {
    setGlobalLoading(true); // Activa el loader global
    try {
      toast.info("Iniciando proceso de generación...");
      const response = await api.post(`/api/rfq/${rfqId}/generar-ocs`, { proveedorId });
      toast.success(response.mensaje);
      if (response.ocs && response.ocs.length > 0) {
        await handleDownloadPdf(response.ocs[0].id);
      }
      fetchDetails(); 
      refreshList();
    } catch (err) {
      toast.error(err.error || "Ocurrió un error al generar la OC.");
    } finally {
      setGlobalLoading(false); // Desactiva el loader global
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Generar Órdenes de Compra para: <strong>{details?.rfq_code}</strong></DialogTitle>
      <DialogContent dividers>
        {loading ? <div style={{textAlign: 'center', padding: '20px'}}><CircularProgress /></div> : (
          <Box>
            <Typography variant="h6" gutterBottom>OCs Pendientes de Generar</Typography>
            {ocsPendientes.length > 0 ? ocsPendientes.map((grupo, index) => {
              const provId = grupo.opciones[0].proveedor_id;
              return (
                <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
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
                  {grupo.adjuntos.length > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="caption">Archivos de Cotización:</Typography>
                      <List dense disablePadding>
                        {grupo.adjuntos.map(file => (
                          <ListItem key={file.id} component={Link} href={file.ruta_archivo} target="_blank" button dense>
                            <ListItemIcon sx={{minWidth: '32px'}}><AttachFileIcon fontSize="small" /></ListItemIcon>
                            <ListItemText primary={file.nombre_archivo} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Subtotal:</Typography><Typography variant="body2">${grupo.resumenFinanciero.subTotal.toFixed(2)}</Typography></Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">IVA:</Typography><Typography variant="body2">${grupo.resumenFinanciero.iva.toFixed(2)}</Typography></Box>
                    {grupo.resumenFinanciero.retIsr > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="error">Ret. ISR:</Typography><Typography variant="body2" color="error">-${grupo.resumenFinanciero.retIsr.toFixed(2)}</Typography></Box>}
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
                      // Se deshabilita si el modal está cargando su propia data
                      disabled={loading}
                    >
                      Generar OC
                    </Button>
                  </Box>
                </Paper>
              );
            }) : <Alert severity="success">¡Excelente! Todas las líneas de este RFQ ya tienen una Orden de Compra generada.</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
};