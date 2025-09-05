// C:\SIRA\sira-front\src\components\rfq\ConfigPopover.jsx
/**
 * Componente: ConfigPopover
 * Propósito:
 * Muestra un formulario emergente (Popover) para configurar las reglas de cálculo
 * globales de la cotización, como tasas de impuestos y totales forzados.
 */
import React from 'react';
import { Popover, Typography, TextField, FormControlLabel, Switch, Box } from '@mui/material';

export default function ConfigPopover({ open, anchorEl, onClose, config, setConfig }) {
  
  // --- Manejadores de Eventos ---

  const handleChange = (event) => {
    const { name, checked } = event.target;
    setConfig(prevConfig => ({
      ...prevConfig,
      [name]: checked,
    }));
  };

  // CAMBIO: Se modifica el handler para que guarde el texto del input directamente.
  // Esto soluciona los problemas de que el valor se borre o no se pueda escribir.
  const handleValueChange = (event) => {
    const { name, value } = event.target;
    setConfig(prevConfig => ({
      ...prevConfig,
      [name]: value, // Se guarda el string tal cual, no se convierte a número aquí.
    }));
  };

  // --- Renderizado ---

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Box sx={{ p: 2, width: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Configuración de Cálculo
        </Typography>

        {/* Sección IVA */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="IVA"
            type="number"
            name="ivaRate"
            // CAMBIO: Se usa '??' para mostrar un string vacío si el valor es null/undefined.
            value={config.ivaRate ?? ''}
            onChange={handleValueChange}
            size="small"
            fullWidth
            inputProps={{ step: "0.01" }}
            disabled={!config.isIvaActive}
          />
          <FormControlLabel
            control={<Switch checked={config.isIvaActive} onChange={handleChange} name="isIvaActive" />}
            label="Activo"
            sx={{ minWidth: '100px' }}
          />
        </Box>

        {/* Sección ISR */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="Ret. ISR"
            type="number"
            name="isrRate"
            value={config.isrRate ?? ''}
            onChange={handleValueChange}
            size="small"
            fullWidth
            inputProps={{ step: "0.0001" }}
            disabled={!config.isIsrActive}
          />
          <FormControlLabel
            control={<Switch checked={config.isIsrActive} onChange={handleChange} name="isIsrActive" />}
            label="Activo"
            sx={{ minWidth: '100px' }}
          />
        </Box>

        {/* Sección Forzar Total */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, p: 1, border: '1px solid', borderColor: config.isForcedTotalActive ? 'warning.main' : 'transparent', borderRadius: 1 }}>
          <TextField
            label="Forzar Total"
            type="number"
            name="forcedTotal"
            value={config.forcedTotal ?? ''}
            onChange={handleValueChange}
            size="small"
            fullWidth
            disabled={!config.isForcedTotalActive}
          />
          <FormControlLabel
            control={<Switch checked={config.isForcedTotalActive} onChange={handleChange} name="isForcedTotalActive" />}
            label="Activo"
            sx={{ minWidth: '100px' }}
          />
        </Box>
      </Box>
    </Popover>
  );
}