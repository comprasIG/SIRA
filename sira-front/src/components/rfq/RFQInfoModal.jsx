// C:\SIRA\sira-front\src\components\rfq\RFQInfoModal.jsx
/**
 * Componente: RFQInfoModal
 * * Propósito:
 * Muestra un diálogo (modal) con los detalles completos de una Solicitud de Cotización (RFQ),
 * incluyendo información general, materiales solicitados y archivos adjuntos.
 * * Props:
 * - open (boolean): Controla si el modal está visible o no.
 * - onClose (function): Función que se ejecuta cuando se cierra el modal.
 * - rfqId (number): El ID del RFQ del cual se cargarán y mostrarán los detalles.
 */
import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress,
  Typography, Box, Link, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';

export default function RFQInfoModal({ open, onClose, rfqId }) {
    // --- Estados ---
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    // --- Efectos ---
    useEffect(() => {
        if (open && rfqId) {
            setLoading(true);
            setDetails(null); // Limpiar detalles anteriores
            api.get(`/api/rfq/${rfqId}`)
                .then(data => setDetails(data))
                .catch(() => toast.error("No se pudo cargar el detalle."))
                .finally(() => setLoading(false));
        }
    }, [open, rfqId]);

    // --- Renderizado ---
    if (!open) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Detalle RFQ: <strong>{details?.rfq_code}</strong></DialogTitle>
            <DialogContent dividers>
                {loading || !details ? <CircularProgress /> : (
                    <>
                        {/* Sección: Información General */}
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <p><strong>Proyecto:</strong> {details.proyecto}</p>
                            <p><strong>Sitio:</strong> {details.sitio}</p>
                            <p><strong>Creador:</strong> {details.usuario_creador}</p>
                            <p><strong>Se entrega en:</strong> {details.lugar_entrega}</p>
                            {details.comentario_general && (
                                <p className="col-span-2"><strong>Comentario General:</strong> {details.comentario_general}</p>
                            )}
                        </div>

                        {/* Sección: Materiales Solicitados */}
                        <h4 className="font-semibold text-lg mb-2">Materiales Solicitados:</h4>
                        <TableContainer component={Paper} variant="outlined" className='mb-4'>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Material</TableCell>
                                        <TableCell align="right">Cantidad</TableCell>
                                        <TableCell>Unidad</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {details.materiales?.map(mat => (
                                        <TableRow key={mat.id}>
                                            <TableCell>{mat.material}</TableCell>
                                            <TableCell align="right">{mat.cantidad}</TableCell>
                                            <TableCell>{mat.unidad}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Sección: Archivos Adjuntos */}
                        {details.adjuntos && details.adjuntos.length > 0 && (
                            <>
                                <h4 className="font-semibold text-lg mb-2">Archivos Adjuntos:</h4>
                                <Box>
                                    {details.adjuntos.map(file => (
                                        <Link href={file.ruta_archivo} target="_blank" rel="noopener noreferrer" key={file.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <AttachFileIcon sx={{ mr: 1, fontSize: '1rem' }} />
                                            {file.nombre_archivo}
                                        </Link>
                                    ))}
                                </Box>
                            </>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};