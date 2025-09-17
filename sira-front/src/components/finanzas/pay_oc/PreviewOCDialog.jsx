//C:\SIRA\SIRA\sira-front\src\components\finanzas\pay_oc\PreviewOCDialog.jsx
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Table, TableHead, TableBody, TableRow, TableCell, Stack } from '@mui/material';

export default function PreviewOCDialog({ open, onClose, preview }) {
  const enc = preview?.encabezado;
  const det = preview?.detalle || [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Previsualización OC {enc?.numero_oc || ''}</DialogTitle>
      <DialogContent dividers>
        {enc && (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="body2"><b>Proveedor:</b> {enc.proveedor_nombre}</Typography>
            <Typography variant="body2"><b>Proyecto:</b> {enc.proyecto_nombre}</Typography>
            <Typography variant="body2"><b>Sitio:</b> {enc.sitio_nombre}</Typography>
            <Typography variant="body2"><b>Status:</b> {enc.status} | <b>Método:</b> {enc.metodo_pago || '-'}</Typography>
            <Typography variant="body2"><b>Total:</b> ${Number(enc.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Typography>
          </Stack>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Material / Descripción</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Precio</TableCell>
              <TableCell>Moneda</TableCell>
              <TableCell align="right">Total línea</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {det.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">Sin renglones.</TableCell></TableRow>
            ) : det.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.material_nombre || r.descripcion || '-'}</TableCell>
                <TableCell align="right">{r.cantidad}</TableCell>
                <TableCell align="right">${Number(r.precio_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{r.moneda || 'MXN'}</TableCell>
                <TableCell align="right">${Number(r.total_linea).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
