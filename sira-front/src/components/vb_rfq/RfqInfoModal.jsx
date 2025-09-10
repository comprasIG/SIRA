//C:\SIRA\sira-front\src\components\vb_rfq\RfqInfoModal.jsx
/**
 * =================================================================================================
 * COMPONENTE: RfqInfoModal (Versión Dashboard)
 * =================================================================================================
 * @description Muestra un resumen tipo dashboard del estado de un RFQ, incluyendo
 * contadores de progreso, resumen financiero de OCs generadas/pendientes y anexos.
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress,
  Typography, Box, Paper, List, ListItem, ListItemText, Divider, Grid, Link, Chip,Alert
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
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

    const { ocsPendientes, ocsGeneradas, totalLineas, lineasProcesadas, anexos } = useMemo(() => {
        if (!details) return { ocsPendientes: [], ocsGeneradas: [], totalLineas: 0, lineasProcesadas: 0, anexos: [] };
        
        const agrupadoPendiente = {};
        const agrupadoGenerado = {};

        details.materiales.forEach(material => {
            const opcionGanadora = material.opciones.find(op => op.seleccionado === true);
            if (!opcionGanadora) return;

            if (material.status_compra === 'PENDIENTE') {
                const provId = opcionGanadora.proveedor_id;
                if (!agrupadoPendiente[provId]) {
                    agrupadoPendiente[provId] = { nombre: opcionGanadora.proveedor_razon_social, opciones: [] };
                }
                agrupadoPendiente[provId].opciones.push({ ...opcionGanadora, materialNombre: material.material });
            } else {
                const ocId = Number(material.status_compra);
                 if (!agrupadoGenerado[ocId]) {
                    agrupadoGenerado[ocId] = { opciones: [] };
                }
                agrupadoGenerado[ocId].opciones.push(opcionGanadora);
            }
        });
        
        const ocsPendientes = Object.values(agrupadoPendiente).map(g => ({ ...g, resumen: calcularResumenParaModal(g.opciones) }));
        const ocsGeneradas = Object.values(agrupadoGenerado).map(g => ({ ...g, resumen: calcularResumenParaModal(g.opciones) }));
        
        const lineasProcesadas = details.materiales.filter(m => m.status_compra !== 'PENDIENTE').length;

        return { ocsPendientes, ocsGeneradas, totalLineas: details.materiales.length, lineasProcesadas, anexos: details.adjuntos };
    }, [details]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Dashboard de RFQ: <strong>{details?.rfq_code}</strong></DialogTitle>
            <DialogContent dividers>
                {loading || !details ? <CircularProgress /> : (
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h6">Progreso de Generación de OCs</Typography>
                                <Typography variant="h4">{lineasProcesadas} / {totalLineas}</Typography>
                                <Typography variant="body2" color="text.secondary">Líneas de material con OC generada</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'bold'}}>Pendiente de Generar</Typography>
                            {ocsPendientes.length > 0 ? ocsPendientes.map((g, i) => (
                                <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1 }}>
                                    <Typography variant="body1"><strong>{g.nombre}</strong></Typography>
                                    <Typography variant="body2">Total: ${g.resumen.total.toFixed(2)} {g.resumen.moneda}</Typography>
                                </Paper>
                            )) : <Alert severity="success">No hay OCs pendientes.</Alert>}
                        </Grid>
                         <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'bold'}}>OCs ya Generadas</Typography>
                            {ocsGeneradas.length > 0 ? ocsGeneradas.map((g, i) => (
                                <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1 }}>
                                     <Typography variant="body1"><strong>Total: ${g.resumen.total.toFixed(2)} {g.resumen.moneda}</strong></Typography>
                                </Paper>
                            )) : <Alert severity="info">Aún no se han generado OCs.</Alert>}
                        </Grid>
                        {anexos.length > 0 && <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'bold'}}>Anexos de Requisición</Typography>
                             <List dense>
                                {anexos.map(file => (
                                    <ListItem key={file.id} component={Link} href={file.ruta_archivo} target="_blank" button>
                                        <AttachFileIcon sx={{ mr: 1, fontSize: '1rem' }} /> {file.nombre_archivo}
                                    </ListItem>
                                ))}
                            </List>
                        </Grid>}
                    </Grid>
                )}
            </DialogContent>
            <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
        </Dialog>
    );
}