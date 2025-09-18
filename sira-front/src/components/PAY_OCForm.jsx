// C:\SIRA\SIRA\sira-front\src\components\PAY_OCForm.jsx

import React, { useMemo, useState } from 'react';
import { useAutorizaciones } from './finanzas/pay_oc/useAutorizaciones';
import AutorizacionOCCard from './finanzas/pay_oc/AutorizacionOCCard';
import { ConfirmacionCreditoDialog } from './finanzas/pay_oc/ConfirmacionCreditoDialog';
import SubirComprobanteDialog from './finanzas/pay_oc/SubirComprobanteDialog';
import RechazoOCDialog from './finanzas/pay_oc/RechazoOCDialog';
import HoldOCDialog from './finanzas/pay_oc/HoldOCDialog';
import PreviewOCDialog from './finanzas/pay_oc/PreviewOCDialog';

import {
  Box, Typography, Container, Paper, Button, TextField, MenuItem,
  Stack, Divider, Tabs, Tab, Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import loadingAnimation from '@/assets/lottie/loading.json';
import emptyAnimation from '@/assets/lottie/payment_sucess.json';

import KPIRowPayOC from './finanzas/pay_oc/KPIRowPayOC';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

const TAB_KEYS = {
  POR_AUTORIZAR: 'POR_AUTORIZAR',
  SPEI_CONFIRMAR: 'SPEI_CONFIRMAR',
  POR_LIQUIDAR: 'POR_LIQUIDAR',
  EN_HOLD: 'EN_HOLD',
};

const digitsOnly = (str = '') => (str || '').replace(/\D+/g, '');
const matchesOcNumber = (ocNumero = '', query = '') => {
  if (!query) return true;
  const qDigits = digitsOnly(query);
  const ocDigits = digitsOnly(ocNumero);
  if (qDigits) return ocDigits.includes(qDigits);
  return (ocNumero || '').toLowerCase().includes((query || '').toLowerCase());
};

const sum = (arr, key) => arr.reduce((acc, it) => acc + Number(it?.[key] || 0), 0);

export default function PAY_OCForm() {
  const {
    ocs: ocsPorAutorizar,
    speiPorConfirmar,
    porLiquidar,
    enHold,
    loading, error,
    dialogState, iniciarAprobacionCredito, confirmarAprobacionCredito, cerrarDialogo,
    preautorizarSpei, cancelarSpei,
    rechazarOC, holdOC, reanudarOC,
    subirComprobantePago,
    getOcPreview,
  } = useAutorizaciones();

  // KPI montos
  const kpiData = {
    porAutorizar: ocsPorAutorizar.length,
    confirmarSpei: speiPorConfirmar.length,
    pendienteLiquidar: porLiquidar.length,
    porAutorizarMonto: sum(ocsPorAutorizar, 'total'),
    confirmarSpeiMonto: sum(speiPorConfirmar, 'total'),
    pendienteLiquidarMonto: porLiquidar.reduce((acc, it) =>
      acc + (typeof it.saldo_pendiente !== 'undefined'
        ? Number(it.saldo_pendiente)
        : Math.max(0, Number(it.total || 0) - Number(it.monto_pagado || 0))
      ), 0),
  };

  const [tab, setTab] = useState(TAB_KEYS.POR_AUTORIZAR);
  const handleTabChange = (_e, v) => setTab(v);

  // ===== Filtros persistentes por TAB =====
  // POR AUTORIZAR
  const [paFilters, setPaFilters] = useState({ numero: '', sitio: 'ALL', proyecto: 'ALL' });
  const paSitios = useMemo(() => Array.from(new Set(ocsPorAutorizar.map(o => o.sitio_nombre).filter(Boolean))), [ocsPorAutorizar]);
  const paProyectos = useMemo(() => Array.from(new Set(ocsPorAutorizar.map(o => o.proyecto_nombre).filter(Boolean))), [ocsPorAutorizar]);
  const ocsPorAutorizarFiltradas = useMemo(() => {
    return ocsPorAutorizar.filter(oc => {
      const okNum = matchesOcNumber(oc.numero_oc, paFilters.numero);
      const okSitio = paFilters.sitio === 'ALL' || oc.sitio_nombre === paFilters.sitio;
      const okProyecto = paFilters.proyecto === 'ALL' || oc.proyecto_nombre === paFilters.proyecto;
      return okNum && okSitio && okProyecto;
    });
  }, [ocsPorAutorizar, paFilters]);

  // SPEI POR CONFIRMAR
  const [scFilters, setScFilters] = useState({ numero: '', sitio: 'ALL', proyecto: 'ALL' });
  const scSitios = useMemo(() => Array.from(new Set(speiPorConfirmar.map(o => o.sitio_nombre).filter(Boolean))), [speiPorConfirmar]);
  const scProyectos = useMemo(() => Array.from(new Set(speiPorConfirmar.map(o => o.proyecto_nombre).filter(Boolean))), [speiPorConfirmar]);
  const speiPorConfirmarFiltradas = useMemo(() => {
    return speiPorConfirmar.filter(oc => {
      const okNum = matchesOcNumber(oc.numero_oc, scFilters.numero);
      const okSitio = scFilters.sitio === 'ALL' || oc.sitio_nombre === scFilters.sitio;
      const okProyecto = scFilters.proyecto === 'ALL' || oc.proyecto_nombre === scFilters.proyecto;
      return okNum && okSitio && okProyecto;
    });
  }, [speiPorConfirmar, scFilters]);

  // POR LIQUIDAR
  const [plFilters, setPlFilters] = useState({ numero: '', sitio: 'ALL', proyecto: 'ALL' });
  const plSitios = useMemo(() => Array.from(new Set(porLiquidar.map(o => o.sitio_nombre).filter(Boolean))), [porLiquidar]);
  const plProyectos = useMemo(() => Array.from(new Set(porLiquidar.map(o => o.proyecto_nombre).filter(Boolean))), [porLiquidar]);
  const porLiquidarFiltradas = useMemo(() => {
    return porLiquidar.filter(oc => {
      const okNum = matchesOcNumber(oc.numero_oc, plFilters.numero);
      const okSitio = plFilters.sitio === 'ALL' || oc.sitio_nombre === plFilters.sitio;
      const okProyecto = plFilters.proyecto === 'ALL' || oc.proyecto_nombre === plFilters.proyecto;
      return okNum && okSitio && okProyecto;
    });
  }, [porLiquidar, plFilters]);

  // EN HOLD
  const [ehFilters, setEhFilters] = useState({ numero: '', sitio: 'ALL', proyecto: 'ALL' });
  const ehSitios = useMemo(() => Array.from(new Set(enHold.map(o => o.sitio_nombre).filter(Boolean))), [enHold]);
  const ehProyectos = useMemo(() => Array.from(new Set(enHold.map(o => o.proyecto_nombre).filter(Boolean))), [enHold]);
  const enHoldFiltradas = useMemo(() => {
    return enHold.filter(oc => {
      const okNum = matchesOcNumber(oc.numero_oc, ehFilters.numero);
      const okSitio = ehFilters.sitio === 'ALL' || oc.sitio_nombre === ehFilters.sitio;
      const okProyecto = ehFilters.proyecto === 'ALL' || oc.proyecto_nombre === ehFilters.proyecto;
      return okNum && okSitio && okProyecto;
    });
  }, [enHold, ehFilters]);

  // ===== Diálogos =====
  const [comprobanteDialogOpen, setComprobanteDialogOpen] = useState(false);
  const [ocSeleccionada, setOcSeleccionada] = useState(null);
  const [loadingComprobante, setLoadingComprobante] = useState(false);
  const handleSubirComprobante = async ({ archivo, tipoPago, monto, comentario }) => {
    setLoadingComprobante(true);
    await subirComprobantePago(ocSeleccionada.id, { archivo, tipoPago, monto, comentario });
    setLoadingComprobante(false);
    setComprobanteDialogOpen(false);
    setOcSeleccionada(null);
  };

  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [ocRechazo, setOcRechazo] = useState(null);

  const [holdOpen, setHoldOpen] = useState(false);
  const [ocHold, setOcHold] = useState(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Lottie animationData={loadingAnimation} style={{ width: 200 }} />
      </Box>
    );
  }
  if (error) return <Typography color="error" sx={{ textAlign: 'center', mt: 4 }}>{error}</Typography>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">Autorización de Pagos</Typography>
      <KPIRowPayOC kpiData={kpiData} />

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab value={TAB_KEYS.POR_AUTORIZAR} label={<Stack direction="row" spacing={1} alignItems="center"><span>Por autorizar</span><Chip size="small" label={kpiData.porAutorizar} /></Stack>} />
          <Tab value={TAB_KEYS.SPEI_CONFIRMAR} label={<Stack direction="row" spacing={1} alignItems="center"><span>SPEI por confirmar</span><Chip size="small" label={kpiData.confirmarSpei} /></Stack>} />
          <Tab value={TAB_KEYS.POR_LIQUIDAR} label={<Stack direction="row" spacing={1} alignItems="center"><span>Por liquidar</span><Chip size="small" label={kpiData.pendienteLiquidar} /></Stack>} />
          <Tab value={TAB_KEYS.EN_HOLD} label={<Stack direction="row" spacing={1} alignItems="center"><span>En hold</span><Chip size="small" label={enHold.length} /></Stack>} />
        </Tabs>
      </Paper>

      {/* POR AUTORIZAR */}
      {tab === TAB_KEYS.POR_AUTORIZAR && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 1 }}>
              <TextField label="Buscar por número OC (solo dígitos)" value={paFilters.numero} onChange={e => setPaFilters(f => ({ ...f, numero: e.target.value }))} size="small" sx={{ minWidth: 280 }} />
              <TextField select size="small" label="Sitio" value={paFilters.sitio} onChange={e => setPaFilters(f => ({ ...f, sitio: e.target.value }))} sx={{ minWidth: 180 }}>
                <MenuItem value="ALL">Todos</MenuItem>{paSitios.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Proyecto" value={paFilters.proyecto} onChange={e => setPaFilters(f => ({ ...f, proyecto: e.target.value }))} sx={{ minWidth: 220 }}>
                <MenuItem value="ALL">Todos</MenuItem>{paProyectos.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
              <Button onClick={() => setPaFilters({ numero: '', sitio: 'ALL', proyecto: 'ALL' })} variant="outlined">Reset filtros</Button>
            </Stack>
            <Divider />
          </Paper>

          <AnimatePresence>
            {ocsPorAutorizarFiltradas.length > 0 ? (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {ocsPorAutorizarFiltradas.map(oc => (
                  <AutorizacionOCCard
                    key={oc.id}
                    oc={oc}
                    mode="porAutorizar"
                    onAprobarCredito={iniciarAprobacionCredito}
                    onPreautorizarSpei={preautorizarSpei}
                    onRechazar={(o) => { setOcRechazo(o); setRechazoOpen(true); }}
                    onHold={(o) => { setOcHold(o); setHoldOpen(true); }}
                    onPreview={async (ocId) => {
                      const data = await getOcPreview(ocId);
                      if (data) { setPreviewData(data); setPreviewOpen(true); }
                    }}
                  />
                ))}
              </motion.div>
            ) : (
              <Box sx={{ textAlign: 'center', mt: 8 }}>
                <Lottie animationData={emptyAnimation} style={{ width: 300, margin: 'auto' }} />
                <Typography variant="h6" color="text.secondary" mt={2}>No hay OCs que coincidan con los filtros.</Typography>
              </Box>
            )}
          </AnimatePresence>
        </>
      )}

      {/* SPEI POR CONFIRMAR / POR LIQUIDAR / EN HOLD (comparten layout de filtros + grid) */}
      {(tab === TAB_KEYS.SPEI_CONFIRMAR || tab === TAB_KEYS.POR_LIQUIDAR || tab === TAB_KEYS.EN_HOLD) && (
        <Paper sx={{ p: 2, borderLeft: theme => `6px solid ${theme.palette.warning.main}` }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            {tab === TAB_KEYS.SPEI_CONFIRMAR && (
              <>
                <TextField label="Buscar por número OC (solo dígitos)" value={scFilters.numero} onChange={e => setScFilters(f => ({ ...f, numero: e.target.value }))} size="small" sx={{ minWidth: 280 }} />
                <TextField select size="small" label="Sitio" value={scFilters.sitio} onChange={e => setScFilters(f => ({ ...f, sitio: e.target.value }))} sx={{ minWidth: 180 }}>
                  <MenuItem value="ALL">Todos</MenuItem>{scSitios.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Proyecto" value={scFilters.proyecto} onChange={e => setScFilters(f => ({ ...f, proyecto: e.target.value }))} sx={{ minWidth: 220 }}>
                  <MenuItem value="ALL">Todos</MenuItem>{scProyectos.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
                <Button onClick={() => setScFilters({ numero: '', sitio: 'ALL', proyecto: 'ALL' })} variant="outlined">Reset filtros</Button>
              </>
            )}
            {tab === TAB_KEYS.POR_LIQUIDAR && (
              <>
                <TextField label="Buscar por número OC (solo dígitos)" value={plFilters.numero} onChange={e => setPlFilters(f => ({ ...f, numero: e.target.value }))} size="small" sx={{ minWidth: 280 }} />
                <TextField select size="small" label="Sitio" value={plFilters.sitio} onChange={e => setPlFilters(f => ({ ...f, sitio: e.target.value }))} sx={{ minWidth: 180 }}>
                  <MenuItem value="ALL">Todos</MenuItem>{plSitios.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Proyecto" value={plFilters.proyecto} onChange={e => setPlFilters(f => ({ ...f, proyecto: e.target.value }))} sx={{ minWidth: 220 }}>
                  <MenuItem value="ALL">Todos</MenuItem>{plProyectos.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
                <Button onClick={() => setPlFilters({ numero: '', sitio: 'ALL', proyecto: 'ALL' })} variant="outlined">Reset filtros</Button>
              </>
            )}
            {tab === TAB_KEYS.EN_HOLD && (
              <>
                <TextField label="Buscar por número OC (solo dígitos)" value={ehFilters.numero} onChange={e => setEhFilters(f => ({ ...f, numero: e.target.value }))} size="small" sx={{ minWidth: 280 }} />
                <TextField select size="small" label="Sitio" value={ehFilters.sitio} onChange={e => setEhFilters(f => ({ ...f, sitio: e.target.value }))} sx={{ minWidth: 180 }}>
                  <MenuItem value="ALL">Todos</MenuItem>{ehSitios.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Proyecto" value={ehFilters.proyecto} onChange={e => setEhFilters(f => ({ ...f, proyecto: e.target.value }))} sx={{ minWidth: 220 }}>
                  <MenuItem value="ALL">Todos</MenuItem>{ehProyectos.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
                <Button onClick={() => setEhFilters({ numero: '', sitio: 'ALL', proyecto: 'ALL' })} variant="outlined">Reset filtros</Button>
              </>
            )}
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <AnimatePresence>
            {(tab === TAB_KEYS.SPEI_CONFIRMAR ? speiPorConfirmarFiltradas : tab === TAB_KEYS.POR_LIQUIDAR ? porLiquidarFiltradas : enHoldFiltradas).length > 0 ? (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {(tab === TAB_KEYS.SPEI_CONFIRMAR ? speiPorConfirmarFiltradas : tab === TAB_KEYS.POR_LIQUIDAR ? porLiquidarFiltradas : enHoldFiltradas).map(oc => (
                  <AutorizacionOCCard
                    key={oc.id}
                    oc={oc}
                    mode={tab === TAB_KEYS.SPEI_CONFIRMAR ? 'speiConfirm' : tab === TAB_KEYS.POR_LIQUIDAR ? 'porLiquidar' : 'hold'}
                    onSubirComprobante={(o) => { setOcSeleccionada(o); setComprobanteDialogOpen(true); }}
                    onCancelarSpei={cancelarSpei}
                    onReanudar={(ocId) => reanudarOC(ocId)}
                    onRechazar={(o) => { setOcRechazo(o); setRechazoOpen(true); }}
                    onPreview={async (ocId) => {
                      const data = await getOcPreview(ocId);
                      if (data) { setPreviewData(data); setPreviewOpen(true); }
                    }}
                  />
                ))}
              </motion.div>
            ) : (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="body1" color="text.secondary">No hay registros que coincidan con los filtros.</Typography>
              </Box>
            )}
          </AnimatePresence>
        </Paper>
      )}

      {/* Diálogos */}
      <ConfirmacionCreditoDialog open={dialogState.open} onClose={cerrarDialogo} onConfirm={confirmarAprobacionCredito} diasCredito={dialogState.diasCredito} fechaPago={dialogState.fechaPago} />

      <SubirComprobanteDialog open={comprobanteDialogOpen} onClose={() => setComprobanteDialogOpen(false)} onSubmit={handleSubirComprobante} oc={ocSeleccionada} loading={loadingComprobante} />

      <RechazoOCDialog
        open={rechazoOpen}
        onClose={() => { setRechazoOpen(false); setOcRechazo(null); }}
        oc={ocRechazo}
        onConfirm={async (motivo) => { await rechazarOC(ocRechazo.id, motivo); setRechazoOpen(false); setOcRechazo(null); }}
      />

      <HoldOCDialog
        open={holdOpen}
        onClose={() => { setHoldOpen(false); setOcHold(null); }}
        oc={ocHold}
        onConfirm={async (fecha) => { await holdOC(ocHold.id, fecha); setHoldOpen(false); setOcHold(null); }}
      />

      <PreviewOCDialog open={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewData(null); }} preview={previewData} />
    </Container>
  );
}
