// sira-front/src/components/dashboard/IncrementablesTab.jsx
/**
 * Tab "Incrementables" — solo para dashboard SSD (Compras).
 *
 * Muestra la lista de OC de costos incrementables de importación
 * (flete, impuestos, última milla, etc.) con su distribución por artículo.
 *
 * Flujo:
 *  "Nueva OC Incrementable" → ModalCrearIncrementable → POST /api/incrementables/crear
 *  "Cerrar" (APROBADA) → POST /api/recoleccion/ocs/:id/cerrar-incrementable
 */
import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Collapse, CircularProgress, Tooltip, Alert, IconButton,
  TextField, InputAdornment,
} from '@mui/material';
import AddIcon             from '@mui/icons-material/Add';
import RefreshIcon         from '@mui/icons-material/Refresh';
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore';
import ExpandLessIcon      from '@mui/icons-material/ExpandLess';
import SearchIcon          from '@mui/icons-material/Search';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import ReceiptLongIcon     from '@mui/icons-material/ReceiptLong';
import SettingsIcon        from '@mui/icons-material/Settings';
import dayjs               from 'dayjs';

import { useIncrementables } from '../../hooks/useIncrementables';
import ModalCrearIncrementable from './incrementables/ModalCrearIncrementable';
import ModalCatalogos          from './incrementables/ModalCatalogos';

const paperSx = {
  p: 2,
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const STATUS_CHIP = {
  POR_AUTORIZAR:  { label: 'Por Autorizar', color: 'warning' },
  CONFIRMAR_SPEI: { label: 'Confirmar SPEI', color: 'info' },
  APROBADA:       { label: 'Aprobada', color: 'success' },
  EN_PROCESO:     { label: 'En Proceso', color: 'primary' },
  ENTREGADA:      { label: 'Cerrada', color: 'default' },
  RECHAZADA:      { label: 'Rechazada', color: 'error' },
  CANCELADA:      { label: 'Cancelada', color: 'error' },
};

const fmtMonto = (n, moneda = 'MXN') =>
  `${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${moneda}`;

const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`;

export default function IncrementablesTab() {
  const {
    incrementables, loading, isSubmitting, kpis,
    fetchIncrementables, cerrarIncrementable,
    fetchDatosIniciales, datosIniciales, loadingIniciales,
  } = useIncrementables();

  const [modalOpen,      setModalOpen]      = useState(false);
  const [catalogosOpen,  setCatalogosOpen]  = useState(false);
  const [expandedId,     setExpandedId]     = useState(null);
  const [busqueda,       setBusqueda]       = useState('');
  const [cerrando,       setCerrando]       = useState(null); // ocId en proceso de cierre

  // ─── Filtrado por búsqueda ─────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return incrementables;
    const q = busqueda.toLowerCase();
    return incrementables.filter(i =>
      i.tipo_nombre?.toLowerCase().includes(q) ||
      i.numero_oc?.toLowerCase().includes(q) ||
      i.proveedor_nombre?.toLowerCase().includes(q) ||
      (i.oc_bases || []).some(b => b.numero_oc?.toLowerCase().includes(q) || b.proyecto?.toLowerCase().includes(q))
    );
  }, [incrementables, busqueda]);

  // ─── Abrir modal con datos pre-cargados ───────────────────────────────────
  const handleAbrirModal = async () => {
    if (!datosIniciales) await fetchDatosIniciales();
    setModalOpen(true);
  };

  // ─── Cerrar incrementable ─────────────────────────────────────────────────
  const handleCerrar = async (ocId) => {
    if (!window.confirm('¿Confirmas el cierre? Los costos se aplicarán al inventario de los artículos afectados.')) return;
    setCerrando(ocId);
    try {
      await cerrarIncrementable(ocId);
    } finally {
      setCerrando(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ─── Encabezado y botón ────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptLongIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700}>
            Costos Incrementables de Importación
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={fetchIncrementables} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Tooltip title="Gestionar catálogos (Tipos de Gasto e Incoterms)">
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setCatalogosOpen(true)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              Catálogos
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={loadingIniciales ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            onClick={handleAbrirModal}
            disabled={loadingIniciales}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Nueva OC Incrementable
          </Button>
        </Stack>
      </Box>

      {/* ─── KPIs ──────────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {[
          { label: 'Por Autorizar', value: kpis.porAutorizar, color: '#f59e0b' },
          { label: 'Aprobadas',     value: kpis.aprobadas,    color: '#10b981' },
          { label: 'Cerradas',      value: kpis.cerradas,     color: '#6b7280' },
        ].map(kpi => (
          <Paper key={kpi.label} sx={{ ...paperSx, minWidth: 130, textAlign: 'center', flex: '0 0 auto' }}>
            <Typography variant="h4" fontWeight={800} sx={{ color: kpi.color }}>{kpi.value}</Typography>
            <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
          </Paper>
        ))}
      </Stack>

      {/* ─── Búsqueda ──────────────────────────────────────────────────────── */}
      <TextField
        size="small"
        placeholder="Buscar por tipo, OC, proveedor, proyecto…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ maxWidth: 400 }}
      />

      {/* ─── Tabla de incrementables ───────────────────────────────────────── */}
      <Paper sx={paperSx}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filtrados.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            {busqueda ? 'No hay resultados para tu búsqueda.' : 'No hay OC incrementables registradas todavía.'}
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, whiteSpace: 'nowrap' } }}>
                  <TableCell />
                  <TableCell>OC</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Proveedor</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>OC(s) Base</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {filtrados.map(inc => {
                  const ocBases = Array.isArray(inc.oc_bases) ? inc.oc_bases : [];
                  const isExpanded = expandedId === inc.id;
                  const statusChip = STATUS_CHIP[inc.status] || { label: inc.status, color: 'default' };
                  const puedesCerrar = ['APROBADA', 'EN_PROCESO'].includes(inc.status);

                  return (
                    <React.Fragment key={inc.id}>
                      <TableRow hover sx={{ '& td': { verticalAlign: 'middle' } }}>
                        {/* Expandir */}
                        <TableCell sx={{ width: 32, p: 0.5 }}>
                          <IconButton size="small" onClick={() => setExpandedId(isExpanded ? null : inc.id)}>
                            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>

                        {/* OC */}
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} color="primary.main">
                            {inc.numero_oc}
                          </Typography>
                        </TableCell>

                        {/* Tipo */}
                        <TableCell>
                          <Chip label={inc.tipo_nombre} size="small" variant="outlined" />
                        </TableCell>

                        {/* Proveedor */}
                        <TableCell>
                          <Typography variant="body2">
                            {inc.proveedor_nombre || '—'}
                          </Typography>
                        </TableCell>

                        {/* Monto */}
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {fmtMonto(inc.total, inc.moneda)}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            label={statusChip.label}
                            color={statusChip.color}
                            size="small"
                          />
                        </TableCell>

                        {/* OC base */}
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                            {ocBases.map(b => (
                              <Chip key={b.id} label={b.numero_oc} size="small" sx={{ fontSize: 11 }} />
                            ))}
                          </Stack>
                        </TableCell>

                        {/* Fecha */}
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(inc.creado_en).format('DD/MM/YY')}
                          </Typography>
                        </TableCell>

                        {/* Acciones */}
                        <TableCell>
                          {puedesCerrar && (
                            <Tooltip title="Cerrar y aplicar costos al inventario">
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="success"
                                  startIcon={cerrando === inc.oc_id
                                    ? <CircularProgress size={12} />
                                    : <CheckCircleIcon fontSize="small" />
                                  }
                                  disabled={cerrando === inc.oc_id || isSubmitting}
                                  onClick={() => handleCerrar(inc.oc_id)}
                                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                                >
                                  Cerrar
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* ─── Detalle expandido: OC base y proyectos ────────── */}
                      <TableRow>
                        <TableCell colSpan={9} sx={{ p: 0, border: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ px: 4, py: 2, bgcolor: 'grey.50' }}>
                              {/* OC base detalle */}
                              {ocBases.length > 0 && (
                                <>
                                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                    OC de Importación Afectadas
                                  </Typography>
                                  <Stack direction="row" spacing={2} flexWrap="wrap" gap={1} mb={1.5}>
                                    {ocBases.map(b => (
                                      <Paper key={b.id} sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="body2" fontWeight={600}>{b.numero_oc}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {b.proyecto} / {b.sitio}
                                        </Typography>
                                      </Paper>
                                    ))}
                                  </Stack>
                                </>
                              )}

                              {inc.comentario && (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  Comentario: {inc.comentario}
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ─── Modal catálogos ───────────────────────────────────────────────── */}
      <ModalCatalogos
        open={catalogosOpen}
        onClose={() => setCatalogosOpen(false)}
      />

      {/* ─── Modal crear incrementable ─────────────────────────────────────── */}
      {modalOpen && (
        <ModalCrearIncrementable
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          datosIniciales={datosIniciales}
          loadingIniciales={loadingIniciales}
          onCreated={() => {
            setModalOpen(false);
            fetchIncrementables();
          }}
        />
      )}
    </Box>
  );
}
