/**
 * Componente: RFQFormHeader
 * Propósito:
 * - Encabezado de la página de cotización (G_RFQ).
 * - Incluye botón volver, datos del RFQ y un menú discreto (⋮) con preferencias UI.
 *
 * Preferencias UI:
 * - showSku: mostrar/ocultar SKU debajo del nombre del material (persistido por usuario en BD).
 *
 * Props:
 * - onBack (function)
 * - rfq_code (string)
 * - proyecto (string)
 * - sitio (string)
 *
 * Props opcionales (nuevas):
 * - showSku (boolean)
 * - onToggleShowSku (function) => (nextValue:boolean) => Promise|void
 * - prefsLoading (boolean)
 */

import React, { useState } from 'react';
import {
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  Box,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export default function RFQFormHeader({
  onBack,
  rfq_code,
  proyecto,
  sitio,
  // nuevas props opcionales
  showSku = false,
  onToggleShowSku,
  prefsLoading = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleOpenMenu = (e) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  const handleChangeShowSku = async (e) => {
    const next = e.target.checked;
    // si no hay handler aún, solo no hacemos nada (evita romper)
    if (!onToggleShowSku) return;

    try {
      await onToggleShowSku(next);
    } finally {
      // cerramos el menú para que se sienta “snappy”
      handleCloseMenu();
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 mb-4 border-b pb-4">
      <div className="flex items-center gap-4">
        <IconButton onClick={onBack} aria-label="Volver a la lista">
          <ArrowBackIcon />
        </IconButton>

        <div>
          <Typography variant="h5" component="h1" className="font-bold text-gray-800">
            Cotizando: {rfq_code}
          </Typography>
          <Typography variant="body2" className="text-gray-500">
            {proyecto} / {sitio}
          </Typography>
        </div>
      </div>

      {/* Menú discreto de preferencias (⋮) */}
      <Box>
        <Tooltip title="Opciones de vista">
          <span>
            <IconButton
              aria-label="Opciones"
              onClick={handleOpenMenu}
              disabled={prefsLoading}
              size="small"
            >
              <MoreVertIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleCloseMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem disableRipple>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(showSku)}
                  onChange={handleChangeShowSku}
                  disabled={prefsLoading || !onToggleShowSku}
                />
              }
              label="Mostrar SKU"
            />
          </MenuItem>
        </Menu>
      </Box>
    </div>
  );
}
