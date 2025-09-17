// C:\SIRA\sira-front\src\components\finanzas\pay_oc\SubirComprobanteDialog.jsx

import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
    Typography, Box, Chip, CircularProgress, IconButton, Paper
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';

export default function SubirComprobanteDialog({ open, onClose, onSubmit, oc, loading }) {
    const [archivo, setArchivo] = useState(null);
    const [tipoPago, setTipoPago] = useState('TOTAL');
    const [monto, setMonto] = useState('');
    const [comentario, setComentario] = useState('');
    const [isDragActive, setIsDragActive] = useState(false);

    // Limpia el estado cuando se cierra el modal
    const handleClose = () => {
        setArchivo(null);
        setTipoPago('TOTAL');
        setMonto('');
        setComentario('');
        onClose();
    };
    
    // Maneja la selección de un archivo desde el input
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setArchivo(e.target.files[0]);
        }
    };
    
    // Maneja el envío del formulario
    const handleSubmit = () => {
        // Validación básica
        if (!archivo || !tipoPago || !monto) return;
        
        onSubmit({
            archivo,
            tipoPago,
            monto,
            comentario: comentario.trim()
        });
    };
    
    // Manejadores para la funcionalidad de arrastrar y soltar
    const handleDrag = (e, active) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(active);
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setArchivo(e.dataTransfer.files[0]);
        }
    };

    // Función de ayuda para formatear el tamaño del archivo
    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // --- RETURN COMPLETO Y CORREGIDO ---
    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle fontWeight="bold">
                Subir Comprobante de Pago {oc?.numero_oc ? `(${oc.numero_oc})` : ''}
            </DialogTitle>
            <DialogContent>
                {/* Zona de subida interactiva */}
                {!archivo ? (
                    <Box
                        sx={{
                            border: `2px dashed ${isDragActive ? 'primary.main' : '#ccc'}`,
                            borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
                            bgcolor: isDragActive ? 'action.hover' : 'transparent', transition: 'all 0.2s'
                        }}
                        component="label" htmlFor="file-upload"
                        onDragEnter={(e) => handleDrag(e, true)}
                        onDragOver={(e) => handleDrag(e, true)}
                        onDragLeave={(e) => handleDrag(e, false)}
                        onDrop={handleDrop}
                    >
                        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                        <Typography>{isDragActive ? '¡Suelta el archivo aquí!' : 'Arrastra o haz clic para subir'}</Typography>
                        <Typography variant="caption" color="text.secondary">PDF o Imagen. Máx 10MB.</Typography>
                        {/* ✨ CORRECCIÓN AQUÍ */}
                        <input id="file-upload" type="file" accept="image/*,.pdf" hidden onChange={handleFileChange} />
                    </Box>
                ) : (
                    // Previsualización del archivo seleccionado
                    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                            <InsertDriveFileIcon color="primary" />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography noWrap variant="body2" fontWeight={500}>{archivo.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{formatFileSize(archivo.size)}</Typography>
                            </Box>
                        </Box>
                        <IconButton onClick={() => setArchivo(null)} size="small"><CloseIcon /></IconButton>
                    </Paper>
                )}

                <TextField
                    select
                    label="Tipo de Pago"
                    fullWidth
                    sx={{ my: 2 }} // Margen arriba y abajo
                    value={tipoPago}
                    onChange={e => setTipoPago(e.target.value)}
                >
                    <MenuItem value="TOTAL">Pago TOTAL</MenuItem>
                    <MenuItem value="ANTICIPO">Anticipo</MenuItem>
                </TextField>
                <TextField
                    label="Monto pagado"
                    type="number"
                    fullWidth
                    sx={{ mb: 2 }}
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                    inputProps={{ min: 1, step: "any" }}
                />
                <TextField
                    label="Comentario (opcional)"
                    fullWidth
                    multiline
                    minRows={2}
                    value={comentario}
                    onChange={e => setComentario(e.target.value)}
                />
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={handleClose} color="inherit" disabled={loading}>Cancelar</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!archivo || !monto || loading}
                >
                    {loading && <CircularProgress size={24} sx={{ color: 'white', mr: 1 }} />}
                    {loading ? 'Subiendo...' : 'Subir Comprobante'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}