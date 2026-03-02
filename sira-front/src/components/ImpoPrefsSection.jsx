// sira-front/src/components/ImpoPrefsSection.jsx
/**
 * Sección de preferencias de impresión para OC de Importación (impo=true).
 * Aparece antes de generar la OC en VB_RFQ y VB_OC.
 *
 * Props:
 *   value    - { imprimir_proyecto, sitio_entrega_id, imprimir_direccion_entrega, incoterm_id }
 *   onChange - (patch) => void  (patch es un objeto parcial)
 *   sitios   - [{ id, nombre, ubicacion }]
 *   incoterms - [{ id, abreviatura, incoterm }]
 */
import React from 'react';
import {
  Box, Typography, FormControlLabel, Switch, Autocomplete,
  TextField, Divider, Chip,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

const EMPTY_PREFS = {
  imprimir_proyecto: true,
  sitio_entrega_id: null,
  imprimir_direccion_entrega: true,
  incoterm_id: null,
};

export default function ImpoPrefsSection({ value = EMPTY_PREFS, onChange, sitios = [], incoterms = [] }) {
  const prefs = { ...EMPTY_PREFS, ...value };

  const sitioSeleccionado = sitios.find(s => s.id === prefs.sitio_entrega_id) || null;
  const incotermSeleccionado = incoterms.find(i => i.id === prefs.incoterm_id) || null;

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'info.light',
        bgcolor: 'rgba(2, 136, 209, 0.04)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <LocalShippingIcon fontSize="small" color="info" />
        <Typography variant="subtitle2" color="info.dark" fontWeight={700}>
          Opciones de Importación
        </Typography>
        <Chip label="IMPO" size="small" color="info" variant="outlined" sx={{ fontSize: 10 }} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Imprimir proyecto */}
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={prefs.imprimir_proyecto !== false}
              onChange={e => onChange({ imprimir_proyecto: e.target.checked })}
            />
          }
          label={
            <Typography variant="body2">
              Imprimir proyecto destino en el PDF
            </Typography>
          }
        />

        <Divider sx={{ my: 0.5 }} />

        {/* Sitio de entrega */}
        <Autocomplete
          size="small"
          options={sitios}
          value={sitioSeleccionado}
          onChange={(_, newVal) => onChange({
            sitio_entrega_id: newVal?.id || null,
            imprimir_direccion_entrega: true,
          })}
          getOptionLabel={opt => `${opt.nombre}${opt.ubicacion ? ` — ${opt.ubicacion}` : ''}`}
          renderOption={(props, opt) => (
            <Box component="li" {...props} key={opt.id}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{opt.nombre}</Typography>
                {opt.ubicacion && (
                  <Typography variant="caption" color="text.secondary">{opt.ubicacion}</Typography>
                )}
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Sitio de entrega (para imprimir dirección)"
              placeholder="Seleccionar sitio..."
              helperText={sitioSeleccionado?.ubicacion
                ? `Dirección: ${sitioSeleccionado.ubicacion}`
                : 'Opcional — la dirección del sitio se imprimirá en el PDF'}
            />
          )}
        />

        {/* Imprimir dirección (solo si hay sitio) */}
        {prefs.sitio_entrega_id && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={prefs.imprimir_direccion_entrega !== false}
                onChange={e => onChange({ imprimir_direccion_entrega: e.target.checked })}
              />
            }
            label={
              <Typography variant="body2">
                Imprimir dirección de entrega en el PDF
              </Typography>
            }
          />
        )}

        <Divider sx={{ my: 0.5 }} />

        {/* Incoterm */}
        <Autocomplete
          size="small"
          options={incoterms}
          value={incotermSeleccionado}
          onChange={(_, newVal) => onChange({ incoterm_id: newVal?.id || null })}
          getOptionLabel={opt => `${opt.abreviatura} — ${opt.incoterm}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Incoterm"
              placeholder="EXW, FOB, CIF, DDP..."
              helperText="Se imprimirá en la OC"
            />
          )}
        />
      </Box>
    </Box>
  );
}
