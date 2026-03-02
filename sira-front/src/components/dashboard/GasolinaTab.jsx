// sira-front/src/components/dashboard/GasolinaTab.jsx
/**
 * Tab "Gasolina" para dashboards FIN y SSD.
 *
 * Secciones:
 *   1. Cargas pendientes de pago (con checkboxes para seleccionar y pagar)
 *   2. Historial de pagos registrados
 *
 * Flujos:
 *   - "Nueva Carga" → ModalRegistrarCarga → POST /api/finanzas/gasolina/cargas
 *   - "Registrar Pago" (con cargas seleccionadas) → ModalRegistrarPago → POST /api/finanzas/gasolina/pagos
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, CircularProgress, Tooltip, Alert, Divider, IconButton,
  TextField, InputAdornment,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import dayjs from 'dayjs';

import { useGasolina } from '../../hooks/useGasolina';
import ModalRegistrarCarga from './gasolina/ModalRegistrarCarga';
import ModalRegistrarPago from './gasolina/ModalRegistrarPago';

const paperSx = {
  p: 2,
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export default function GasolinaTab() {
  const {
    cargas, pagos,
    fuentesPago, unidades, sitios, proyectos,
    loadingCargas, loadingPagos, loadingCatalog, isSubmitting,
    fetchCargas, fetchPagos,
    crearCarga, crearPago,
  } = useGasolina();

  const [seleccionados, setSeleccionados] = useState([]); // ids de cargas seleccionadas
  const [modalCarga, setModalCarga]       = useState(false);
  const [modalPago,  setModalPago]        = useState(false);
  const [busqueda,   setBusqueda]         = useState('');

  // ─── Cargas pendientes filtradas por búsqueda ──────────────────────────────
  const cargasPendientes = useMemo(
    () => cargas.filter((c) => !c.pagado),
    [cargas]
  );

  const cargasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return cargasPendientes;
    const q = busqueda.toLowerCase();
    return cargasPendientes.filter(
      (c) =>
        c.unidad_nombre?.toLowerCase().includes(q) ||
        c.no_eco?.toLowerCase().includes(q) ||
        c.tipo_combustible?.toLowerCase().includes(q) ||
        c.sitio_destino_nombre?.toLowerCase().includes(q) ||
        c.proyecto_destino_nombre?.toLowerCase().includes(q)
    );
  }, [cargasPendientes, busqueda]);

  const cargasSeleccionadasData = useMemo(
    () => cargasPendientes.filter((c) => seleccionados.includes(c.id)),
    [cargasPendientes, seleccionados]
  );

  const totalSeleccionado = useMemo(
    () => cargasSeleccionadasData.reduce((s, c) => s + parseFloat(c.costo_total_mxn || 0), 0),
    [cargasSeleccionadasData]
  );

  const totalPendiente = useMemo(
    () => cargasPendientes.reduce((s, c) => s + parseFloat(c.costo_total_mxn || 0), 0),
    [cargasPendientes]
  );

  // ─── Selección ──────────────────────────────────────────────────────────────
  const toggleAll = () => {
    if (seleccionados.length === cargasFiltradas.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(cargasFiltradas.map((c) => c.id));
    }
  };

  const toggleOne = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ─── Handlers de submit ────────────────────────────────────────────────────
  const handleCrearCarga = useCallback(
    async (payload) => {
      const ok = await crearCarga(payload);
      if (ok) setSeleccionados([]);
      return ok;
    },
    [crearCarga]
  );

  const handleCrearPago = useCallback(
    async (payload) => {
      const ok = await crearPago(payload);
      if (ok) setSeleccionados([]);
      return ok;
    },
    [crearPago]
  );

  const handleRefresh = () => {
    fetchCargas({ pagado: false });
    fetchPagos();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── Barra de acciones ── */}
      <Paper sx={paperSx}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <LocalGasStationIcon color="success" />
            <Typography variant="subtitle1" fontWeight="bold">
              Gasolina
            </Typography>
            <Chip
              label={`${cargasPendientes.length} pendiente${cargasPendientes.length !== 1 ? 's' : ''}`}
              size="small"
              color="warning"
              variant="outlined"
            />
            {cargasPendientes.length > 0 && (
              <Chip
                label={`Total: ${fmt(totalPendiente)}`}
                size="small"
                color="warning"
              />
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Actualizar">
              <IconButton size="small" onClick={handleRefresh} disabled={loadingCargas || loadingPagos}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setModalCarga(true)}
              disabled={loadingCatalog}
            >
              Nueva Carga
            </Button>

            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={<PaymentsIcon />}
              disabled={seleccionados.length === 0 || isSubmitting}
              onClick={() => setModalPago(true)}
            >
              {seleccionados.length > 0
                ? `Pagar ${seleccionados.length} carga${seleccionados.length !== 1 ? 's' : ''} (${fmt(totalSeleccionado)})`
                : 'Registrar Pago'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* ── Tabla de cargas pendientes ── */}
      <Paper sx={paperSx}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            Cargas Pendientes de Pago
          </Typography>
          <TextField
            size="small"
            placeholder="Buscar unidad, combustible..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 260 }}
          />
        </Stack>

        {loadingCargas ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : cargasFiltradas.length === 0 ? (
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            No hay cargas pendientes de pago.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={seleccionados.length > 0 && seleccionados.length < cargasFiltradas.length}
                      checked={cargasFiltradas.length > 0 && seleccionados.length === cargasFiltradas.length}
                      onChange={toggleAll}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Unidad</TableCell>
                  <TableCell>Km</TableCell>
                  <TableCell>Combustible</TableCell>
                  <TableCell>Destino</TableCell>
                  <TableCell>Quien registró</TableCell>
                  <TableCell align="right">Costo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cargasFiltradas.map((c) => {
                  const isSelected = seleccionados.includes(c.id);
                  return (
                    <TableRow
                      key={c.id}
                      selected={isSelected}
                      hover
                      onClick={() => toggleOne(c.id)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: isSelected ? alpha('#4caf50', 0.06) : undefined,
                      }}
                    >
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleOne(c.id)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {dayjs(c.fecha_carga).format('DD/MM/YY HH:mm')}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        <Stack>
                          <Typography variant="caption" fontWeight="bold">
                            {c.no_eco}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {c.unidad_nombre}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {c.kilometraje?.toLocaleString('es-MX')} km
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={c.tipo_combustible || 'N/D'}
                          size="small"
                          color="success"
                          variant="outlined"
                          icon={<LocalGasStationIcon />}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {c.proyecto_destino_nombre
                          ? `${c.sitio_destino_nombre} / ${c.proyecto_destino_nombre}`
                          : c.sitio_destino_nombre || '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {c.usuario_nombre || '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'success.main' }}>
                        {fmt(c.costo_total_mxn)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Historial de pagos ── */}
      <Paper sx={paperSx}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <ReceiptLongIcon color="primary" />
          <Typography variant="subtitle2" fontWeight="bold">
            Historial de Pagos
          </Typography>
          <Chip label={pagos.length} size="small" color="default" />
        </Stack>

        {loadingPagos ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : pagos.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Aún no se han registrado pagos de gasolina.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha Pago</TableCell>
                  <TableCell>Fuente</TableCell>
                  <TableCell align="center"># Cargas</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Comprobante</TableCell>
                  <TableCell>Quien pagó</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagos.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {dayjs(p.fecha_pago).format('DD/MM/YYYY HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${p.fuente_pago_nombre} (${p.fuente_pago_tipo})`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={p.cargas_count} size="small" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {fmt(p.total_mxn)}
                    </TableCell>
                    <TableCell>
                      {p.comprobante_link ? (
                        <Tooltip title={p.comprobante_link}>
                          <IconButton
                            size="small"
                            href={p.comprobante_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {p.usuario_nombre || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Modales ── */}
      <ModalRegistrarCarga
        open={modalCarga}
        onClose={() => setModalCarga(false)}
        unidades={unidades}
        sitios={sitios}
        proyectos={proyectos}
        isSubmitting={isSubmitting}
        onSubmit={handleCrearCarga}
      />

      <ModalRegistrarPago
        open={modalPago}
        onClose={() => setModalPago(false)}
        cargasSeleccionadas={cargasSeleccionadasData}
        fuentesPago={fuentesPago}
        isSubmitting={isSubmitting}
        onSubmit={handleCrearPago}
      />
    </Box>
  );
}
