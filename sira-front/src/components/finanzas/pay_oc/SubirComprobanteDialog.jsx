// C:\SIRA\sira-front\src\components\finanzas\pay_oc\SubirComprobanteDialog.jsx
import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Typography, Box, Paper, IconButton
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';

export default function SubirComprobanteDialog({ open, onClose, onSubmit, oc, loading }) {
  const saldo = useMemo(() => {
    if (!oc) return 0;
    if (typeof oc.saldo_pendiente !== 'undefined') return Number(oc.saldo_pendiente || 0);
    return Math.max(0, Number(oc.total || 0) - Number(oc.monto_pagado || 0));
  }, [oc]);

  const [archivo, setArchivo] = useState(null);
  const [tipoPago, setTipoPago] = useState('TOTAL'); // 'TOTAL' | 'ANTICIPO'
  const [monto, setMonto] = useState('');
  const [comentario, setComentario] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  const reset = () => { setArchivo(null); setTipoPago('TOTAL'); setMonto(''); setComentario(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setArchivo(f);
  };

  const handleDrag = (e, active) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(active); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setArchivo(f);
  };

  const isMontoInvalido = tipoPago === 'ANTICIPO' && (!monto || Number(monto) <= 0);

  const handleSubmit = async () => {
    if (!archivo) return;
    if (isMontoInvalido) return;
    await onSubmit({
      archivo,
      tipoPago, // <-- ahora puede ser 'TOTAL' o 'ANTICIPO'
      monto: tipoPago === 'TOTAL' ? undefined : monto,
      comentario: comentario.trim(),
    });
    reset();
  };

  const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight="bold">
        Subir Comprobante {oc?.numero_oc ? `– ${oc.numero_oc}` : ''}
      </DialogTitle>

      <DialogContent dividers>
        {/* Dropzone */}
        {!archivo ? (
          <Box
            component="label"
            htmlFor="file-upload"
            onDragEnter={(e) => handleDrag(e, true)}
            onDragOver={(e) => handleDrag(e, true)}
            onDragLeave={(e) => handleDrag(e, false)}
            onDrop={handleDrop}
            sx={{
              border: `2px dashed ${isDragActive ? 'primary.main' : '#ccc'}`,
              borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'transparent', transition: 'all .2s'
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography>{isDragActive ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para subir'}</Typography>
            <Typography variant="caption" color="text.secondary">PDF o imagen</Typography>
            <input id="file-upload" type="file" accept="application/pdf,image/*" hidden onChange={handleFileChange} />
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <InsertDriveFileIcon color="primary" />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap variant="body2" fontWeight={600}>{archivo.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(archivo.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setArchivo(null)} size="small"><CloseIcon /></IconButton>
          </Paper>
        )}

        <TextField
          select
          label="Tipo de pago"
          fullWidth
          sx={{ mt: 2 }}
          value={tipoPago}
          onChange={(e) => setTipoPago(e.target.value)}
          helperText={tipoPago === 'TOTAL' ? `Se aplicará por el saldo pendiente (${fmt.format(saldo)})` : 'Ingresa el monto del abono'}
        >
          <MenuItem value="TOTAL">Pago TOTAL</MenuItem>
          <MenuItem value="ANTICIPO">Pago PARCIAL (Anticipo)</MenuItem>
        </TextField>

        {tipoPago === 'ANTICIPO' ? (
          <TextField
            label="Monto pagado"
            type="number"
            fullWidth
            sx={{ mt: 2 }}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
            error={isMontoInvalido}
            helperText={isMontoInvalido ? 'Ingresa un monto válido' : ''}
            required
          />
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Monto a registrar: <b>{fmt.format(saldo)}</b>
            </Typography>
          </Box>
        )}

        <TextField
          label="Comentario (opcional)"
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 2 }}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !archivo || isMontoInvalido}
        >
          {loading ? 'Subiendo…' : 'Subir comprobante'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
