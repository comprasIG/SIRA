// sira-front/src/components/-requisiciones/UnidadCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import {
  Paper, Typography, Box, Button, Divider, Chip, Stack, Tooltip, Badge, IconButton,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import BusinessIcon from '@mui/icons-material/Business';
import BuildIcon from '@mui/icons-material/Build';
import PlagiarismIcon from '@mui/icons-material/Plagiarism';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import SpeedIcon from '@mui/icons-material/Speed';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const formatKm = (km) =>
  typeof km === 'number' ? `${Number(km).toLocaleString('es-MX')} km` : 'N/A';

export default function UnidadCard({
  unidad,
  onAbrirServicio,
  onAbrirHistorial,
  onAbrirRegistro,
  onAbrirDetalle,
}) {
  const tieneReqAbierta   = parseInt(unidad.requisiciones_abiertas, 10) > 0;
  const alertasAbiertas   = parseInt(unidad.alertas_abiertas, 10) > 0;
  const servicioVencido   = unidad.servicio_vencido === true;

  const bordeColor = alertasAbiertas
    ? 'error.main'
    : servicioVencido
    ? 'warning.main'
    : tieneReqAbierta
    ? 'info.main'
    : 'transparent';

  return (
    <motion.div variants={cardVariants} style={{ height: '100%' }}>
      <Paper
        elevation={3}
        sx={{
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderTop: '4px solid',
          borderColor: bordeColor,
        }}
      >
        {/* Encabezado */}
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="caption" color="text.secondary">
              No. Eco: {unidad.no_eco}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {alertasAbiertas && (
                <Tooltip title={`${unidad.alertas_abiertas} incidencia(s) abierta(s)`}>
                  <Chip
                    size="small"
                    icon={<WarningAmberIcon />}
                    label={`${unidad.alertas_abiertas} Alerta`}
                    color="error"
                    variant="filled"
                  />
                </Tooltip>
              )}
              {servicioVencido && !tieneReqAbierta && (
                <Tooltip title="Servicio programado vencido — km actual superó el próximo servicio">
                  <Chip
                    size="small"
                    icon={<NotificationsActiveIcon />}
                    label="Serv. Vencido"
                    color="warning"
                    variant="outlined"
                  />
                </Tooltip>
              )}
              {tieneReqAbierta && (
                <Tooltip title="Tiene una requisición de servicio abierta">
                  <Chip
                    size="small"
                    icon={<BuildIcon />}
                    label="En Servicio"
                    color="info"
                    variant="outlined"
                  />
                </Tooltip>
              )}
              {!unidad.activo && (
                <Chip size="small" label="Inactiva" color="error" variant="outlined" />
              )}
            </Stack>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold" lineHeight={1.2} noWrap>
                {unidad.unidad}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {unidad.marca} {unidad.modelo} | {unidad.placas}
              </Typography>
            </Box>
            <Tooltip title="Ver información completa de la unidad">
              <IconButton size="small" onClick={() => onAbrirDetalle?.(unidad)}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Divider />

        {/* Datos */}
        <Box sx={{ p: 2, flexGrow: 1 }}>
          <Stack spacing={1}>
            <InfoRow icon={<AccountCircleIcon />} label={unidad.responsable_nombre || 'Sin responsable'} />
            <InfoRow icon={<BusinessIcon />} label={unidad.departamento_codigo || 'Sin depto.'} />
            <InfoRow icon={<SpeedIcon />} label={`KM: ${formatKm(unidad.km)}`} />
            {unidad.km_proximo_servicio && (
              <InfoRow
                icon={<BuildIcon />}
                label={`Próx. servicio: ${formatKm(unidad.km_proximo_servicio)}`}
                color={servicioVencido ? 'warning.main' : 'text.secondary'}
              />
            )}
            <InfoRow
              icon={<LocalGasStationIcon />}
              label={`Combustible: ${unidad.tipo_combustible || 'N/A'}`}
            />
          </Stack>
        </Box>

        {/* Acciones */}
        <Box sx={{ p: 2, mt: 'auto' }}>
          <Stack direction="row" spacing={1} justifyContent="space-between">
            <Stack direction="row" spacing={0.5}>
              <Button
                size="small"
                variant="text"
                startIcon={<PlagiarismIcon />}
                onClick={() => onAbrirHistorial?.(unidad)}
              >
                Bitácora
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => onAbrirRegistro?.(unidad)}
                disabled={!unidad.activo}
              >
                Registrar
              </Button>
            </Stack>

            <Tooltip
              title={
                tieneReqAbierta
                  ? 'Ya tiene un servicio en proceso'
                  : servicioVencido
                  ? 'Servicio vencido — solicítalo ahora'
                  : 'Solicitar servicio'
              }
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  color={servicioVencido && !tieneReqAbierta ? 'warning' : 'primary'}
                  startIcon={<BuildIcon />}
                  onClick={() => onAbrirServicio?.(unidad)}
                  disabled={tieneReqAbierta || !unidad.activo}
                >
                  Servicio
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>
    </motion.div>
  );
}

function InfoRow({ icon, label, color = 'text.secondary' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {React.cloneElement(icon, { sx: { color: 'text.secondary', fontSize: '1.1rem' } })}
      <Typography variant="body2" color={color} noWrap>
        {label}
      </Typography>
    </Box>
  );
}
