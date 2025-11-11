// sira-front/src/components/-requisiciones/UnidadCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box, Button, Divider, Chip, Stack, Tooltip } from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import BusinessIcon from '@mui/icons-material/Business';
import BuildIcon from '@mui/icons-material/Build';
import PlagiarismIcon from '@mui/icons-material/Plagiarism';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import SpeedIcon from '@mui/icons-material/Speed';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

// Helper para formatear KM
const formatKm = (km) => km ? `${Number(km).toLocaleString('es-MX')} km` : 'N/A';

// ======== ¡CAMBIO! Recibimos las nuevas funciones en las props ========
export default function UnidadCard({ unidad, onAbrirServicio, onAbrirHistorial }) {
  const tieneReqAbierta = parseInt(unidad.requisiciones_abiertas, 10) > 0;

  // ======== ¡CAMBIO! Estas funciones ya no muestran 'alert' ========
  const handleSolicitarServicio = () => {
    onAbrirServicio(unidad); // Llama a la función del padre
  };

  const handleVerBitacora = () => {
    onAbrirHistorial(unidad); // Llama a la función del padre
  };
  // ===============================================================

  return (
    <motion.div variants={cardVariants} style={{ height: '100%' }}>
      <Paper elevation={3} sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%', borderTop: tieneReqAbierta ? '4px solid' : '4px solid transparent', borderColor: 'warning.main' }}>
        
        {/* Encabezado (sin cambios) */}
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              No. Eco: {unidad.no_eco}
            </Typography>
            {tieneReqAbierta && (
              <Tooltip title="Esta unidad tiene una requisición de servicio abierta">
                <Chip size="small" icon={<BuildIcon />} label="En Servicio" color="warning" variant="outlined" />
              </Tooltip>
            )}
            {!unidad.activo && (
              <Chip size="small" label="Inactiva" color="error" variant="outlined" />
            )}
          </Stack>
          
          <Typography variant="h6" fontWeight="bold" lineHeight={1.2} noWrap>
            {unidad.unidad}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {unidad.marca} {unidad.modelo} | {unidad.placas}
          </Typography>
        </Box>
        <Divider />

        {/* Detalles (sin cambios) */}
        <Box sx={{ p: 2, flexGrow: 1 }}>
          <Stack spacing={1}>
            <InfoChip icon={<AccountCircleIcon />} label={unidad.responsable_nombre || 'Sin responsable'} />
            <InfoChip icon={<BusinessIcon />} label={unidad.departamento_codigo || 'Sin depto.'} />
            <InfoChip icon={<SpeedIcon />} label={`Kilometraje: ${formatKm(unidad.km)}`} />
            <InfoChip icon={<LocalGasStationIcon />} label={`Combustible: ${unidad.tipo_combustible || 'N/A'}`} />
          </Stack>
        </Box>

        {/* Footer de Acciones (sin cambios, ahora los onClick funcionan) */}
        <Box sx={{ p: 2, mt: 'auto' }}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="text" startIcon={<PlagiarismIcon />} onClick={handleVerBitacora}>
              Bitácora
            </Button>
            <Button 
              size="small" 
              variant="contained" 
              startIcon={<BuildIcon />} 
              onClick={handleSolicitarServicio}
              disabled={tieneReqAbierta || !unidad.activo}
            >
              Servicio
            </Button>
          </Stack>
        </Box>
      </Paper>
    </motion.div>
  );
}

// Componente helper interno (sin cambios)
function InfoChip({ icon, label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {React.cloneElement(icon, { sx: { color: 'text.secondary', fontSize: '1.1rem' } })}
      <Typography variant="body2" color="text.secondary" noWrap>
        {label}
      </Typography>
    </Box>
  );
}