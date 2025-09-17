// C:\SIRA\sira-front\src\components\finanzas\pay_oc\SubirComprobanteDialog.jsx

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Typography, Box } from '@mui/material';
import Lottie from 'lottie-react';
import uploadAnimation from '@/assets/lottie/upload-animation.json'; // Si tienes animación, si no, bórrala

export default function SubirComprobanteDialog({ open, onClose, onSubmit, oc, loading }) {
    const [archivo, setArchivo] = useState(null);
    const [tipoPago, setTipoPago] = useState('TOTAL');
    const [monto, setMonto] = useState('');
    const [comentario, setComentario] = useState('');

    // Limpia estado al cerrar
    const handleClose = () => {
        setArchivo(null); setTipoPago('TOTAL'); setMonto(''); setComentario('');
        onClose();
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setArchivo(e.target.files[0]);
        }
    };

    const handleSubmit = () => {
        if (!archivo || !tipoPago || !monto) return;
        onSubmit({
            archivo,
            tipoPago,
            monto,
            comentario: comentario.trim()
        });
        setArchivo(null); setTipoPago('TOTAL'); setMonto(''); setComentario('');
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle fontWeight="bold">
                Subir Comprobante de Pago {oc?.numero_oc ? `(${oc.numero_oc})` : ''}
            </DialogTitle>
            <DialogContent>
                <Box sx={{
                    border: '2px dashed #ccc', borderRadius: 2, p: 3,
                    textAlign: 'center', bgcolor: archivo ? '#e8f5e9' : '#fafafa', cursor: 'pointer', mb: 2
                }} component="label" htmlFor="file-upload">
                    <Typography sx={{ mb: 1 }}>
                        {archivo ? `Archivo seleccionado: ${archivo.name}` : 'Haz clic aquí para seleccionar el archivo PDF o imagen'}
                    </Typography>
                    <input id="file-upload" type="file" accept="image/*,.pdf" hidden onChange={handleFileChange} />
                </Box>

                <TextField
                    select
                    label="Tipo de Pago"
                    fullWidth
                    sx={{ mb: 2 }}
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
            <DialogActions>
                <Button onClick={handleClose} color="inherit" disabled={loading}>Cancelar</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!archivo || !monto || loading}
                >
                    {loading ? 'Subiendo...' : 'Subir Comprobante'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
