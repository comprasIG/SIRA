// C:\SIRA\sira-front\src\components\finanzas\pay_oc\SubirComprobanteDialog.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Typography, Box, Paper, IconButton, CircularProgress,
  Divider, Stack, Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import api from '@/api/api';

export default function SubirComprobanteDialog({ open, onClose, onSubmit, oc, loading }) {
  const saldo = useMemo(() => {
    if (!oc) return 0;
    if (typeof oc.saldo_pendiente !== 'undefined') return Number(oc.saldo_pendiente || 0);
    return Math.max(0, Number(oc.total || 0) - Number(oc.monto_pagado || 0));
  }, [oc]);

  const [archivo, setArchivo] = useState(null);
  const [tipoPago, setTipoPago] = useState('TOTAL');
  const [monto, setMonto] = useState('');
  const [comentario, setComentario] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  // Fuentes de pago
  const [fuentes, setFuentes] = useState([]);
  const [fuentesLoading, setFuentesLoading] = useState(false);
  const [fuentePagoId, setFuentePagoId] = useState('');

  const fmt = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), []);

  const reset = () => {
    setArchivo(null);
    setTipoPago('TOTAL');
    setMonto('');
    setComentario('');
    setFuentePagoId('');
  };

  const handleClose = () => { reset(); onClose(); };

  // Cargar fuentes al abrir
  useEffect(() => {
    const loadFuentes = async () => {
      if (!open) return;
      setFuentesLoading(true);
      try {
        const data = await api.get('/api/finanzas/fuentes-pago?soloActivas=true');
        setFuentes(data || []);
        const noEsp = (data || []).find(f => String(f.nombre || '').toUpperCase() === 'NO ESPECIFICADO');
        const firstId = noEsp?.id ?? (data?.[0]?.id ?? '');
        setFuentePagoId(firstId ? String(firstId) : '');
      } catch {
        setFuentes([]);
        setFuentePagoId('');
      } finally {
        setFuentesLoading(false);
      }
    };
    loadFuentes();
  }, [open]);

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

  // Determinar si la fuente seleccionada es EFECTIVO
  const selectedFuente = useMemo(() => {
    if (!fuentePagoId) return null;
    return fuentes.find(f => String(f.id) === String(fuentePagoId));
  }, [fuentes, fuentePagoId]);

  const esEfectivo = selectedFuente?.tipo === 'EFECTIVO';

  const isMontoInvalido = tipoPago === 'ANTICIPO' && (!monto || Number(monto) <= 0);
  const isFuenteInvalida = !fuentePagoId || Number(fuentePagoId) <= 0;
  // Comprobante obligatorio EXCEPTO para EFECTIVO
  const archivoRequerido = !esEfectivo && !archivo;

  const handleSubmit = async () => {
    if (archivoRequerido) return;
    if (isMontoInvalido) return;
    if (isFuenteInvalida) return;

    await onSubmit({
      archivo: archivo || null,
      tipoPago,
      monto: tipoPago === 'TOTAL' ? undefined : monto,
      comentario: comentario.trim(),
      fuentePagoId: Number(fuentePagoId),
    });

    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <ReceiptLongIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
              Registrar Pago
            </Typography>
            {oc?.numero_oc && (
              <Typography variant="caption" color="text.secondary">
                {oc.numero_oc} — Saldo pendiente: {fmt.format(saldo)}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2.5 }}>
        {/* ─── Sección 1: Configuración de pago ─── */}
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
          Configuración del pago
        </Typography>

        <Stack spacing={2} sx={{ mb: 2.5 }}>
          {/* Tipo de pago */}
          <TextField
            select
            label="Tipo de pago"
            fullWidth
            value={tipoPago}
            onChange={(e) => setTipoPago(e.target.value)}
            size="small"
          >
            <MenuItem value="TOTAL">
              Pago TOTAL — {fmt.format(saldo)}
            </MenuItem>
            <MenuItem value="ANTICIPO">Pago PARCIAL (Anticipo)</MenuItem>
          </TextField>

          {/* Monto anticipo */}
          {tipoPago === 'ANTICIPO' && (
            <TextField
              label="Monto del anticipo"
              type="number"
              fullWidth
              size="small"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              inputProps={{ min: 0, step: "0.01" }}
              error={isMontoInvalido}
              helperText={isMontoInvalido ? 'Ingresa un monto válido' : `Máximo: ${fmt.format(saldo)}`}
              required
            />
          )}

          {/* Fuente de pago */}
          <TextField
            select
            fullWidth
            size="small"
            label="Fuente de pago"
            value={fuentePagoId}
            onChange={(e) => setFuentePagoId(e.target.value)}
            error={isFuenteInvalida}
            helperText={isFuenteInvalida ? 'Selecciona una fuente' : ''}
            InputProps={{
              endAdornment: fuentesLoading ? <CircularProgress size={18} /> : null
            }}
          >
            {(fuentes || []).map((f) => (
              <MenuItem key={f.id} value={String(f.id)}>
                {f.nombre} {f.tipo ? `(${f.tipo})` : ''}
              </MenuItem>
            ))}
            {(fuentes || []).length === 0 && (
              <MenuItem value="" disabled>No hay fuentes disponibles</MenuItem>
            )}
          </TextField>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* ─── Sección 2: Comprobante ─── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
            Comprobante de pago
          </Typography>
          {esEfectivo && (
            <Chip label="Opcional para efectivo" size="small" color="info" variant="outlined" />
          )}
        </Stack>

        {!archivo ? (
          <Box
            component="label"
            htmlFor="file-upload-comprobante"
            onDragEnter={(e) => handleDrag(e, true)}
            onDragOver={(e) => handleDrag(e, true)}
            onDragLeave={(e) => handleDrag(e, false)}
            onDrop={handleDrop}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px dashed ${isDragActive ? '#1976d2' : archivoRequerido ? '#ccc' : '#ccc'}`,
              borderRadius: 2,
              p: 3,
              cursor: 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'grey.50',
              transition: 'all .2s',
              '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 0.5 }} />
            <Typography variant="body2" fontWeight={600}>
              {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para subir'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              PDF o imagen {esEfectivo ? '(opcional)' : '(requerido)'}
            </Typography>
            <input id="file-upload-comprobante" type="file" accept="application/pdf,image/*" hidden onChange={handleFileChange} />
          </Box>
        ) : (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'success.50',
              borderColor: 'success.light',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
              <InsertDriveFileIcon color="success" />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap variant="body2" fontWeight={600}>{archivo.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(archivo.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => setArchivo(null)} size="small"><CloseIcon /></IconButton>
          </Paper>
        )}

        {/* Comentario */}
        <TextField
          label="Comentario (opcional)"
          fullWidth
          multiline
          minRows={2}
          size="small"
          sx={{ mt: 2.5 }}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || archivoRequerido || isMontoInvalido || isFuenteInvalida}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
        >
          {loading ? 'Registrando…' : 'Registrar pago'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
