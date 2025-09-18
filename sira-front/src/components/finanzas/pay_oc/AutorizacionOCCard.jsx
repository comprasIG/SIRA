import React from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box, Button, Divider, Chip, Stack, Tooltip, IconButton } from '@mui/material';
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
      <Paper elevation={4} sx={{ borderRadius: 3, transition: 'border-color 0.3s', border: '1px solid transparent', '&:hover': { borderColor: 'primary.main' } }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">Orden de Compra</Typography>
              <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>{oc.numero_oc}</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Previsualizar OC">
                <IconButton size="small" onClick={() => onPreview?.(oc.id)}>
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Stack direction="column" spacing={0.5} alignItems="flex-end">
                {oc.proyecto_nombre && <Chip size="small" icon={<WorkspacesIcon />} label={oc.proyecto_nombre} color="primary" />}
                {oc.sitio_nombre && <Chip size="small" icon={<PlaceIcon />} label={oc.sitio_nombre} />}
              </Stack>
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{oc.proveedor_razon_social}</Typography>
        </Box>

        <Divider />

        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={800} color="primary.main">{totalFormatted}</Typography>
          <Typography variant="caption" display="block" color="text.secondary">Monto Total (IVA incluido)</Typography>
          {mode === 'porLiquidar' && (
            <Chip
              sx={{ mt: 1 }}
              color="warning"
              label={`Saldo pendiente: ${saldoFormatted}`}
              size="small"
            />
          )}
          {mode === 'hold' && oc.hold_regresar_en && (
            <Chip sx={{ mt: 1 }} color="info" label={`Regresar en: ${oc.hold_regresar_en}`} size="small" />
          )}
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
            {oc.metodo_pago && <Chip size="small" label={`Pago: ${oc.metodo_pago}`} variant="outlined" />}
            {oc.status && <Chip size="small" color="warning" label={oc.status} />}
          </Stack>
        </Box>

        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
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
