// sira-front/src/components/dashboard/gasolina/ModalRegistrarPago.jsx
/**
 * Modal para registrar un pago (depósito) que cubre N cargas seleccionadas.
 * - El total se calcula automáticamente como suma de las cargas.
 * - El comprobante se carga como archivo (PDF o imagen) y se sube a Drive,
 *   igual que en /PAY_OC (SubirComprobanteDialog).
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, Box, Typography, Stack, TextField, Button, CircularProgress,
  Autocomplete, Divider,
  Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Paper, IconButton,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';

const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '95%',
  maxWidth: 640,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  maxHeight: '92vh',
  overflowY: 'auto',
};

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export default function ModalRegistrarPago({
  open, onClose, cargasSeleccionadas, fuentesPago, isSubmitting, onSubmit,
}) {
  const [fuentePago,    setFuentePago]    = useState(null);
  const [fechaPago,     setFechaPago]     = useState(dayjs().format('YYYY-MM-DD'));
  const [archivo,       setArchivo]       = useState(null);
  const [isDragActive,  setIsDragActive]  = useState(false);
  const [comentario,    setComentario]    = useState('');

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setFuentePago(null);
      setFechaPago(dayjs().format('YYYY-MM-DD'));
      setArchivo(null);
      setIsDragActive(false);
      setComentario('');
    }
  }, [open]);

  const totalMxn = useMemo(
    () => cargasSeleccionadas.reduce((sum, c) => sum + parseFloat(c.costo_total_mxn || 0), 0),
    [cargasSeleccionadas]
  );

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDrag = (e, active) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(active);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setArchivo(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setArchivo(f);
  };

  // Comprobante obligatorio excepto para fuentes tipo EFECTIVO
  const esEfectivo = fuentePago?.tipo === 'EFECTIVO';
  const archivoRequerido = !esEfectivo && !archivo;

  const canSubmit = fuentePago && cargasSeleccionadas.length > 0 && !archivoRequerido && !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const ok = await onSubmit({
      fuente_pago_id:  fuentePago.id,
      carga_ids:       cargasSeleccionadas.map((c) => c.id),
      fecha_pago:      fechaPago || new Date().toISOString(),
      archivo:         archivo || null,   // File object — el hook construye el FormData
      comentario:      comentario.trim() || null,
    });
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={!isSubmitting ? onClose : undefined}>
      <Box sx={styleModal}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <PaymentsIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Registrar Pago de Gasolina
          </Typography>
        </Stack>

        {/* ── Resumen de cargas ── */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Cargas a pagar ({cargasSeleccionadas.length})
        </Typography>

        <Box sx={{ maxHeight: 200, overflowY: 'auto', mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Unidad</TableCell>
                <TableCell>Combustible</TableCell>
                <TableCell align="right">Costo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cargasSeleccionadas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell sx={{ fontSize: '0.78rem' }}>
                    {dayjs(c.fecha_carga).format('DD/MM/YY')}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <LocalGasStationIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      {c.no_eco} — {c.unidad_nombre}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>
                    {c.tipo_combustible || '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    {fmt(c.costo_total_mxn)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* Total */}
        <Box sx={{
          p: 1.5, mb: 2, borderRadius: 2,
          bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Typography variant="subtitle1" fontWeight="bold">Total a pagar:</Typography>
          <Chip
            label={fmt(totalMxn)}
            color="primary"
            sx={{ fontWeight: 800, fontSize: '1rem', px: 1 }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>

            {/* Fuente de Pago */}
            <Autocomplete
              options={fuentesPago}
              getOptionLabel={(f) => `${f.nombre} (${f.tipo})`}
              value={fuentePago}
              onChange={(_, v) => { setFuentePago(v); setArchivo(null); }}
              fullWidth
              renderInput={(params) => (
                <TextField {...params} label="Fuente de Pago" required size="small" />
              )}
            />

            {/* Fecha de Pago */}
            <TextField
              label="Fecha de Pago"
              type="date"
              required
              fullWidth
              size="small"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            {/* ── Comprobante (upload a Drive) ── */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
                  Comprobante de pago
                </Typography>
                {esEfectivo && (
                  <Chip label="Opcional para efectivo" size="small" color="info" variant="outlined" />
                )}
              </Stack>

              {!archivo ? (
                <Box
                  component="label"
                  htmlFor="file-upload-gasolina"
                  onDragEnter={(e) => handleDrag(e, true)}
                  onDragOver={(e) => handleDrag(e, true)}
                  onDragLeave={(e) => handleDrag(e, false)}
                  onDrop={handleDrop}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px dashed ${isDragActive ? '#1976d2' : '#ccc'}`,
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
                  <input
                    id="file-upload-gasolina"
                    type="file"
                    accept="application/pdf,image/*"
                    hidden
                    onChange={handleFileChange}
                  />
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
                  <IconButton onClick={() => setArchivo(null)} size="small">
                    <CloseIcon />
                  </IconButton>
                </Paper>
              )}
            </Box>

            {/* Comentario */}
            <TextField
              label="Comentario (opcional)"
              multiline
              rows={2}
              fullWidth
              size="small"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />

            {/* Acciones */}
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ pt: 1 }}>
              <Button onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={!canSubmit}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <PaymentsIcon />}
              >
                {isSubmitting ? 'Registrando...' : `Registrar Pago (${fmt(totalMxn)})`}
              </Button>
            </Stack>

          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}
