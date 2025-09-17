// C:\SIRA\sira-front\src\components\finanzas\pay_oc\ConfirmacionSpeiDialog.jsx

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton } from '@mui/material';
import Lottie from 'lottie-react';
import uploadAnimation from '@/assets/lottie/upload-animation.json'; // Descarga una animación de subida
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';

export const ConfirmacionSpeiDialog = ({ open, onClose, onConfirm, ocId }) => {
    const [archivo, setArchivo] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            setArchivo(event.target.files[0]);
        }
    };

    const handleConfirm = async () => {
        if (!archivo) return;
        setIsUploading(true);
        await onConfirm(ocId, archivo);
        setIsUploading(false);
        setArchivo(null); // Limpiar para la próxima vez
    };
    
    // Limpiar el estado si se cierra el modal
    const handleClose = () => {
        setArchivo(null);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle fontWeight="bold">Subir Comprobante SPEI</DialogTitle>
            <DialogContent>
                <Box
                    sx={{
                        border: '2px dashed #ccc',
                        borderRadius: 2,
                        p: 3,
                        textAlign: 'center',
                        cursor: 'pointer',
                        bgcolor: archivo ? '#e8f5e9' : '#fafafa'
                    }}
                    component="label"
                    htmlFor="file-upload"
                >
                    <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                    <Typography>
                        {archivo ? `Archivo seleccionado: ${archivo.name}` : 'Haz clic o arrastra para subir el archivo'}
                    </Typography>
                    <input id="file-upload" type="file" accept="image/*,.pdf" hidden onChange={handleFileChange} />
                </Box>
                 {isUploading && <Lottie animationData={uploadAnimation} style={{ height: 100, marginTop: 16 }} />}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="inherit">Cancelar</Button>
                <Button onClick={handleConfirm} variant="contained" disabled={!archivo || isUploading}>
                    {isUploading ? 'Subiendo...' : 'Confirmar y Aprobar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};