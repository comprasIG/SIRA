// C:\SIRA\sira-front\src\components\rfq\ConfigPopover.jsx
/**
 * Componente: ConfigPopover
 * Propósito: Muestra un formulario emergente para configurar las reglas de cálculo
 * de la cotización, incluyendo ahora la selección de moneda.
 */
import React, { useState, useEffect } from 'react';
import { Popover, Typography, TextField, FormControlLabel, Switch, Box, Select, MenuItem, FormControl, InputLabel, CircularProgress } from '@mui/material';
import api from '../../api/api'; // Asegúrate de que la ruta a tu API sea correcta.

export default function ConfigPopover({ open, anchorEl, onClose, config, setConfig }) {
  // --- Estados ---
  const [monedas, setMonedas] = useState([]);
  const [loadingMonedas, setLoadingMonedas] = useState(true);

  // --- Efecto para Cargar Monedas ---
  useEffect(() => {
    // Solo se ejecuta si el popover está abierto y la lista de monedas no se ha cargado.
    if (open && monedas.length === 0) {
      setLoadingMonedas(true);
      api.get('/api/monedas')
        .then(data => {
          setMonedas(data);
        })
        .catch(() => {
          // No usamos toast aquí para no ser intrusivos. El error se verá en la consola.
          console.error("No se pudo cargar el catálogo de monedas.");
        })
        .finally(() => {
          setLoadingMonedas(false);
        });
    }
  }, [open, monedas.length]);

  // --- Manejadores de Eventos (sin cambios) ---
  const handleChange = (event) => {
    const { name, checked } = event.target;
    setConfig(prev => ({ ...prev, [name]: checked }));
  };

  const handleValueChange = (event) => {
    const { name, value } = event.target;
    setConfig(prev => ({ ...prev, [name]: value }));
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

        {/* --- NUEVA SECCIÓN: Moneda --- */}
        <FormControl fullWidth size="small">
          <InputLabel id="moneda-select-label">Moneda</InputLabel>
          <Select
            labelId="moneda-select-label"
            label="Moneda"
            name="moneda"
            value={config.moneda || 'MXN'} // Valor por defecto 'MXN'
            onChange={handleValueChange}
            disabled={loadingMonedas}
            endAdornment={loadingMonedas ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          >
            {monedas.map((m) => (
              <MenuItem key={m.codigo} value={m.codigo}>
                {m.codigo} - {m.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sección IVA (sin cambios) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="IVA" type="number" name="ivaRate" value={config.ivaRate ?? ''}
            onChange={handleValueChange} size="small" fullWidth
            inputProps={{ step: "0.01" }} disabled={!config.isIvaActive}
          />
          <FormControlLabel
            control={<Switch checked={config.isIvaActive} onChange={handleChange} name="isIvaActive" />}
            label="Activo" sx={{ minWidth: '100px' }}
          />
        </Box>

        {/* Sección ISR (sin cambios) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="Ret. ISR" type="number" name="isrRate" value={config.isrRate ?? ''}
            onChange={handleValueChange} size="small" fullWidth
            inputProps={{ step: "0.0001" }} disabled={!config.isIsrActive}
          />
          <FormControlLabel
            control={<Switch checked={config.isIsrActive} onChange={handleChange} name="isIsrActive" />}
            label="Activo" sx={{ minWidth: '100px' }}
          />
        </Box>

        {/* Sección Forzar Total (sin cambios) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, p: 1, border: '1px solid', borderColor: config.isForcedTotalActive ? 'warning.main' : 'transparent', borderRadius: 1 }}>
          <TextField
            label="Forzar Total" type="number" name="forcedTotal" value={config.forcedTotal ?? ''}
            onChange={handleValueChange} size="small" fullWidth disabled={!config.isForcedTotalActive}
          />
          <FormControlLabel
            control={<Switch checked={config.isForcedTotalActive} onChange={handleChange} name="isForcedTotalActive" />}
            label="Activo" sx={{ minWidth: '100px' }}
          />
        </Box>
      </Box>
    </Popover>
  );
}