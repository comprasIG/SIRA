import React from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box, Button, Divider, Chip, Stack, Tooltip, IconButton } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CreditScoreIcon from '@mui/icons-material/CreditScore';
import BoltIcon from '@mui/icons-material/Bolt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import WorkspacesIcon from '@mui/icons-material/Workspaces';

const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function AutorizacionOCCard({
  oc,
  mode = 'porAutorizar', // 'porAutorizar' | 'speiConfirm' | 'porLiquidar' | 'hold'
  onAprobarCredito,
  onPreautorizarSpei,
  onSubirComprobante,
  onCancelarSpei,
  onRechazar,
  onHold,
  onReanudar,
  onPreview,
}) {
  const theme = useTheme();
  const totalFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(oc.total);
  const saldo = typeof oc.saldo_pendiente !== 'undefined'
    ? oc.saldo_pendiente
    : Math.max(0, Number(oc.total || 0) - Number(oc.monto_pagado || 0));
  const saldoFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldo);

  const showCredito = mode === 'porAutorizar';
  const showContado = mode === 'porAutorizar';
  const showSubirComprobante = mode === 'speiConfirm' || mode === 'porLiquidar';
  const showCancelarSpei = mode === 'speiConfirm';
  const showHoldReject = mode === 'porAutorizar';
  const showReanudarReject = mode === 'hold';

  return (
    <motion.div variants={cardVariants}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
          boxShadow: `0 14px 28px ${alpha(theme.palette.primary.main, 0.08)}`,
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: `0 18px 38px ${alpha(theme.palette.primary.main, 0.18)}`,
            borderColor: alpha(theme.palette.primary.main, 0.28),
          },
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 2.25,
            backgroundImage: `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 65%, ${theme.palette.background.paper} 100%)`,
            borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" color="primary" sx={{ letterSpacing: 1.2 }}>
                OC {oc.numero_oc}
              </Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                lineHeight={1.25}
                color="text.primary"
                sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                {oc.proveedor_razon_social}
              </Typography>
              {oc.proveedor_rfc && (
                <Typography variant="caption" color="text.secondary">
                  RFC: {oc.proveedor_rfc}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ flexShrink: 0 }}>
              <Tooltip title="Ver detalle completo de la OC">
                <IconButton size="small" onClick={() => onPreview?.(oc)}>
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Stack spacing={0.5} alignItems="flex-end" sx={{ maxWidth: 130 }}>
                {oc.proyecto_nombre && (
                  <Tooltip title={oc.proyecto_nombre} placement="left">
                    <Chip
                      size="small"
                      icon={<WorkspacesIcon />}
                      label={oc.proyecto_nombre}
                      color="primary"
                      variant="outlined"
                      sx={{ maxWidth: '100%', '.MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                    />
                  </Tooltip>
                )}
                {oc.sitio_nombre && (
                  <Tooltip title={oc.sitio_nombre} placement="left">
                    <Chip
                      size="small"
                      icon={<PlaceIcon />}
                      label={oc.sitio_nombre}
                      variant="outlined"
                      sx={{ maxWidth: '100%', '.MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                    />
                  </Tooltip>
                )}
              </Stack>
            </Stack>
          </Stack>
        </Box>

        <Stack spacing={2.5} sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Monto total
            </Typography>
            <Typography variant="h4" fontWeight={800} color="primary.main">
              {totalFormatted}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Incluye impuestos y cargos asociados
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {oc.metodo_pago && (
              <Chip size="small" variant="outlined" label={`Pago: ${oc.metodo_pago}`} sx={{ maxWidth: '100%' }} />
            )}
            {oc.status && (
              <Chip size="small" color="warning" label={oc.status} sx={{ maxWidth: '100%' }} />
            )}
            {mode === 'hold' && oc.hold_regresar_en && (
              <Chip size="small" color="info" label={`Regresar en: ${oc.hold_regresar_en}`} sx={{ maxWidth: '100%' }} />
            )}
            {mode === 'porLiquidar' && (
              <Chip size="small" color="warning" variant="outlined" label={`Saldo: ${saldoFormatted}`} sx={{ maxWidth: '100%' }} />
            )}
          </Stack>
        </Stack>

        <Divider sx={{ mt: 'auto' }} />

        <Box sx={{ p: 2.25, display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
          {showCredito && (
            <Tooltip title="Aprobar con días de crédito del proveedor.">
              <Button size="small" variant="contained" color="success" startIcon={<CreditScoreIcon />} onClick={() => onAprobarCredito(oc.id)}>
                Crédito
              </Button>
            </Tooltip>
          )}
          {showContado && (
            <Tooltip title="Aprobar para pago SPEI y subir comprobante después.">
              <Button size="small" variant="contained" color="primary" startIcon={<BoltIcon />} onClick={() => onPreautorizarSpei(oc.id)}>
                Contado
              </Button>
            </Tooltip>
          )}
          {showSubirComprobante && (
            <Tooltip title="Subir el comprobante de pago para esta OC.">
              <Button variant="contained" color="secondary" startIcon={<CloudUploadIcon />} onClick={() => onSubirComprobante(oc)}>
                Subir Comprobante
              </Button>
            </Tooltip>
          )}
          {showCancelarSpei && (
            <Tooltip title="Devolver esta OC a 'Por Autorizar'.">
              <Button size="small" variant="text" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => onCancelarSpei?.(oc.id)}>
                Cancelar
              </Button>
            </Tooltip>
          )}
          {showHoldReject && (
            <>
              <Tooltip title="Poner en HOLD (saldrá de 'Por Autorizar').">
                <Button size="small" variant="outlined" color="warning" startIcon={<PauseCircleOutlineIcon />} onClick={() => onHold?.(oc)}>
                  Hold
                </Button>
              </Tooltip>
              <Tooltip title="Rechazar definitivamente esta OC.">
                <Button size="small" variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => onRechazar?.(oc)}>
                  Rechazar
                </Button>
              </Tooltip>
            </>
          )}
          {showReanudarReject && (
            <>
              <Tooltip title="Reanudar (volver a 'Por Autorizar').">
                <Button size="small" variant="outlined" color="success" startIcon={<PlayArrowIcon />} onClick={() => onReanudar?.(oc.id)}>
                  Reanudar
                </Button>
              </Tooltip>
              <Tooltip title="Rechazar definitivamente esta OC.">
                <Button size="small" variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => onRechazar?.(oc)}>
                  Rechazar
                </Button>
              </Tooltip>
            </>
          )}
        </Box>
      </Paper>
    </motion.div>
  );
}
