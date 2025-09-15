// C:\SIRA\sira-front\src\components\rfq\RFQInfoModal.jsx (VERSIÓN MEJORADA)

import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress,
  Typography, Box, Link, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip // Chip para consistencia visual
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ListAltIcon from '@mui/icons-material/ListAlt';

export default function RFQInfoModal({ open, onClose, rfqId }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && rfqId) {
            setLoading(true);
            setDetails(null);
            api.get(`/api/rfq/${rfqId}`)
                .then(data => setDetails(data))
                .catch(() => toast.error("No se pudo cargar el detalle."))
                .finally(() => setLoading(false));
        }
    }, [open, rfqId]);

    if (!open) return null;

    // Componente para una línea de detalle, para no repetir código
    const DetailItem = ({ label, value }) => (
        <Box>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body1">{value}</Typography>
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoOutlinedIcon />
                Detalle RFQ: <Typography component="span" variant="h6" sx={{ fontWeight: 'bold' }}>{details?.rfq_code}</Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ bgcolor: '#f9f9f9' }}>
                {loading || !details ? <CircularProgress /> : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Información General</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                <DetailItem label="Proyecto" value={<Chip label={details.proyecto} color="primary" />} />
                                <DetailItem label="Sitio" value={details.sitio} />
                                <DetailItem label="Creador" value={details.usuario_creador} />
                                <DetailItem label="Se entrega en" value={details.lugar_entrega_nombre} />
                            </Box>
                            {details.comentario_general && (
                                <Box sx={{ mt: 2 }}>
                                    <DetailItem label="Comentario General" value={details.comentario_general} />
                                </Box>
                            )}
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2 }}>
                             <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ListAltIcon /> Materiales Solicitados
                            </Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead><TableRow><TableCell>Material</TableCell><TableCell align="right">Cantidad</TableCell><TableCell>Unidad</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {details.materiales?.map(mat => (
                                            <TableRow key={mat.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                <TableCell>{mat.material}</TableCell>
                                                <TableCell align="right">{mat.cantidad}</TableCell>
                                                <TableCell>{mat.unidad}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>

                        {details.adjuntos && details.adjuntos.length > 0 && (
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom>Archivos Adjuntos</Typography>
                                <Box>
                                    {details.adjuntos.map(file => (
                                        <Link href={file.ruta_archivo} target="_blank" rel="noopener noreferrer" key={file.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                            <AttachFileIcon sx={{ mr: 1, fontSize: '1rem', color: 'primary.main' }} />
                                            {file.nombre_archivo}
                                        </Link>
                                    ))}
                                </Box>
                            </Paper>
                            
                        )}
                          </Box>
                    
                )}
            </DialogContent>
            <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
        </Dialog>
    );
};