// C:\SIRA\SIRA\sira-front\src\components\finanzas\pay_oc\AutorizacionOCCard.jsx

import React from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box, Button, Divider, Chip, Stack } from '@mui/material';
import CreditScoreIcon from '@mui/icons-material/CreditScore';
import BoltIcon from '@mui/icons-material/Bolt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import WorkspacesIcon from '@mui/icons-material/Workspaces';

const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function AutorizacionOCCard({
  oc,
  mode = 'porAutorizar', // 'porAutorizar' | 'speiConfirm' | 'porLiquidar'
  onAprobarCredito,
  onPreautorizarSpei,
  onSubirComprobante,
  onCancelarSpei,
}) {
  const totalFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(oc.total);

  const showCredito = mode === 'porAutorizar';
  const showContado = mode === 'porAutorizar';
  const showSubirComprobante = mode === 'speiConfirm' || mode === 'porLiquidar';
  const showCancelarSpei = mode === 'speiConfirm';

  return (
    <motion.div variants={cardVariants}>
      <Paper elevation={4} sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="h6" fontWeight="bold">{oc.numero_oc}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
              {oc.proyecto_nombre && (
                <Chip size="small" icon={<WorkspacesIcon />} label={oc.proyecto_nombre} color="primary" />
              )}
              {oc.sitio_nombre && (
                <Chip size="small" icon={<PlaceIcon />} label={oc.sitio_nombre} />
              )}
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary">{oc.proveedor_razon_social}</Typography>
        </Box>

        <Box sx={{ p: 2 }}>
          <Typography variant="h4" fontWeight="bold" color="primary" textAlign="center" my={2}>
            {totalFormatted}
          </Typography>
          <Typography variant="caption" display="block" textAlign="center" color="text.secondary">
            Monto Total (IVA incluido)
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
            {oc.metodo_pago && <Chip size="small" label={`Pago: ${oc.metodo_pago}`} />}
            {oc.status && <Chip size="small" color="warning" variant="outlined" label={oc.status} />}
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          {showCredito && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="contained" color="success" startIcon={<CreditScoreIcon />} onClick={() => onAprobarCredito(oc.id)}>
                Aprobar a Crédito
              </Button>
            </motion.div>
          )}

          {showContado && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="contained" color="primary" startIcon={<BoltIcon />} onClick={() => onPreautorizarSpei(oc.id)}>
                Aprobar de contado
              </Button>
            </motion.div>
          )}

          {showSubirComprobante && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outlined" color="warning" startIcon={<CloudUploadIcon />} onClick={() => onSubirComprobante(oc)}>
                Subir Comprobante
              </Button>
            </motion.div>
          )}

          {showCancelarSpei && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => onCancelarSpei?.(oc.id)}>
                Cancelar
              </Button>
            </motion.div>
          )}
        </Box>
      </Paper>
    </motion.div>
  );
}
