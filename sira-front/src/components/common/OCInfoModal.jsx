import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Paper,
  Stack,
  Chip,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Box,
  CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const formatCurrency = (value, currency = 'MXN') => {
  if (value == null || Number.isNaN(Number(value))) return '-';
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(Number(value));
  } catch (error) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(value));
  }
};

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function OCInfoModal({
  open,
  onClose,
  oc,
  items = [],
  loading = false,
  metadata = [],
  extraContent = null,
}) {
  const theme = useTheme();

  const cleanedMetadata = useMemo(
    () => metadata.filter((entry) => entry && entry.value),
    [metadata],
  );

  const totalsPorMoneda = useMemo(() => {
    return items.reduce((acc, item) => {
      const currency = item.currency || oc?.moneda || 'MXN';
      const total = item.total ?? (safeNumber(item.price) * safeNumber(item.quantity));
      if (!Number.isFinite(total)) return acc;
      acc[currency] = (acc[currency] || 0) + Number(total);
      return acc;
    }, {});
  }, [items, oc?.moneda]);

  const resumenLineas = useMemo(() => {
    if (!items.length) {
      return {
        total: 0,
        completadas: 0,
        pendientes: 0,
      };
    }

    let completas = 0;
    let pendientes = 0;

    items.forEach((item) => {
      const qty = safeNumber(item.quantity);
      if (qty === 0) return;
      const pendiente = item.pending ?? Math.max(0, qty - safeNumber(item.received));
      if (pendiente > 0.001) pendientes += 1;
      else completas += 1;
    });

    return {
      total: items.length,
      completadas: completas,
      pendientes,
    };
  }, [items]);

  const hasQuantity = useMemo(() => items.some((item) => item.quantity != null), [items]);
  const hasReceived = useMemo(
    () => items.some((item) => item.received != null && item.received !== ''),
    [items],
  );
  const hasPending = useMemo(
    () => items.some((item) => item.pending != null && item.pending !== ''),
    [items],
  );
  const hasUnit = useMemo(() => items.some((item) => item.unit), [items]);
  const hasPrice = useMemo(() => items.some((item) => item.price != null), [items]);
  const hasTotal = useMemo(() => items.some((item) => item.total != null), [items]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          px: 4,
          py: 3,
          backgroundImage: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.18)} 0%, ${alpha(t.palette.primary.main, 0.05)} 65%, ${t.palette.background.paper} 100%)`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.08)}`,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 1.4 }} color="primary">
              Orden de compra
            </Typography>
            <Typography variant="h5" fontWeight={700} color="text.primary">
              {oc?.numero_oc || oc?.numero || 'OC sin folio'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {oc?.proveedor_razon_social || oc?.proveedor_nombre || 'Proveedor no disponible'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {oc?.status && <Chip size="small" color="warning" label={oc.status} />}
            {oc?.metodo_pago && <Chip size="small" variant="outlined" label={`Pago: ${oc.metodo_pago}`} />}
            {oc?.metodo_recoleccion_nombre && (
              <Chip size="small" variant="outlined" label={oc.metodo_recoleccion_nombre} />
            )}
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          px: 4,
          py: 3.5,
          backgroundColor: alpha(theme.palette.primary.main, 0.015),
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={4}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    height: '100%',
                    borderRadius: 3,
                    backgroundImage: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 75%)`,
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <ListAltIcon color="primary" />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Líneas totales
                        </Typography>
                        <Typography variant="h5" fontWeight={700}>
                          {resumenLineas.total}
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider flexItem sx={{ borderColor: alpha(theme.palette.primary.main, 0.12) }} />
                    <Stack direction="row" spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CheckCircleOutlineIcon color="success" fontSize="small" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Completas
                          </Typography>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {resumenLineas.completadas}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PendingActionsIcon color="warning" fontSize="small" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Pendientes
                          </Typography>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {resumenLineas.pendientes}
                          </Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={8}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Resumen económico
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {Object.entries(totalsPorMoneda).map(([currency, amount]) => (
                      <Chip
                        key={currency}
                        color="primary"
                        variant="outlined"
                        label={`${currency}: ${formatCurrency(amount, currency)}`}
                        sx={{ fontWeight: 600 }}
                      />
                    ))}
                    {!Object.keys(totalsPorMoneda).length && (
                      <Typography variant="body2" color="text.secondary">
                        Sin montos registrados en los renglones.
                      </Typography>
                    )}
                  </Stack>
                  {cleanedMetadata.length > 0 && (
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      {cleanedMetadata.map((entry) => (
                        <Stack key={entry.label} direction="row" spacing={1.5} alignItems="baseline">
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                            {entry.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={500} color="text.primary">
                            {entry.value}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            </Grid>

            {extraContent}

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.08)}`,
                }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  Detalle de materiales
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Visualiza cantidades y montos registrados por línea de la orden.
                </Typography>
              </Box>
              <Box sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Material / Descripción</TableCell>
                      {(hasQuantity || hasReceived) && <TableCell align="right">Solicitada / Recibida</TableCell>}
                      {hasUnit && <TableCell align="center">Unidad</TableCell>}
                      {hasPending && <TableCell align="right">Pendiente</TableCell>}
                      {hasPrice && <TableCell align="right">Precio</TableCell>}
                      <TableCell align="center">Moneda</TableCell>
                      {hasTotal && <TableCell align="right">Total línea</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No hay renglones disponibles para esta orden.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => {
                        const qty = item.quantity != null ? Number(item.quantity) : null;
                        const rec = item.received != null ? Number(item.received) : null;
                        const isComplete = qty != null && rec != null && rec >= qty;
                        const isPartial = qty != null && rec != null && rec > 0 && rec < qty;
                        const fmtNum = (n) => n != null ? n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-';
                        return (
                        <TableRow key={item.id || item.material_id || item.detalle_id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} color="text.primary">
                              {item.description || '-'}
                            </Typography>
                            {item.note && (
                              <Typography variant="caption" color="text.secondary">
                                {item.note}
                              </Typography>
                            )}
                          </TableCell>
                          {(hasQuantity || hasReceived) && (
                            <TableCell align="right">
                              <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5 }}>
                                <Typography variant="body2" component="span" fontWeight={500}>
                                  {fmtNum(qty)}
                                </Typography>
                                <Typography variant="body2" component="span" color="text.disabled">/</Typography>
                                <Typography
                                  variant="body2"
                                  component="span"
                                  fontWeight={600}
                                  color={isComplete ? 'success.main' : isPartial ? 'warning.main' : 'text.secondary'}
                                >
                                  {fmtNum(rec)}
                                </Typography>
                              </Box>
                            </TableCell>
                          )}
                          {hasUnit && <TableCell align="center">{item.unit || '-'}</TableCell>}
                          {hasPending && (
                            <TableCell align="right">
                              {item.pending != null ? Number(item.pending).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                          )}
                          {hasPrice && (
                            <TableCell align="right">
                              {item.price != null ? formatCurrency(item.price, item.currency || oc?.moneda || 'MXN') : '-'}
                            </TableCell>
                          )}
                          <TableCell align="center">{item.currency || oc?.moneda || 'MXN'}</TableCell>
                          {hasTotal && (
                            <TableCell align="right">
                              {item.total != null
                                ? formatCurrency(item.total, item.currency || oc?.moneda || 'MXN')
                                : '-'}
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 4, py: 2.5 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
