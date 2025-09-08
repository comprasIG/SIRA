//C:\SIRA\sira-front\src\components\vb_rfq\RfqInfoModal.jsx
/**
 * =================================================================================================
 * COMPONENTE: RfqInfoModal
 * =================================================================================================
 * @file RfqInfoModal.jsx
 * @description Muestra un resumen financiero completo de las opciones de compra
 * seleccionadas por el comprador para un RFQ.
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress,
  Typography, Box, Paper, List, ListItem, ListItemText, Divider
} from '@mui/material';
// Reutilizamos la misma lógica de cálculo que el modal de aprobación
import { calcularResumenParaModal } from './vbRfqUtils';

export default function RfqInfoModal({ open, onClose, rfqId }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && rfqId) {
            setLoading(true);
            setDetails(null);
            api.get(`/api/rfq/${rfqId}`)
                .then(data => setDetails(data))
                .catch(() => toast.error("No se pudo cargar el resumen del RFQ."))
                .finally(() => setLoading(false));
        }
    }, [open, rfqId]);

    // --- Lógica para agrupar las opciones ganadoras por proveedor ---
    const resumenesPorProveedor = useMemo(() => {
        if (!details) return [];
        const agrupado = {};
        details.materiales.forEach(material => {
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
        
        // Calculamos los totales para cada grupo
        return Object.values(agrupado).map(grupo => ({
            ...grupo,
            resumenFinanciero: calcularResumenParaModal(grupo.opciones)
        }));
    }, [details]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Resumen de Compras para RFQ: <strong>{details?.rfq_code}</strong></DialogTitle>
            <DialogContent dividers>
                {loading || !details ? <CircularProgress /> : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {resumenesPorProveedor.map((grupo, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom>{grupo.nombre}</Typography>
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
                        ))}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}