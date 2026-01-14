// sira-front/src/components/PICK_IN/RetiroAsignado.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Button,
  CircularProgress,
  Stack,
  Checkbox,
  Divider,
  Paper,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * RetiroAsignado (PICK_IN)
 * =========================================================================================
 * Opción 1 acordada:
 * - NO capturar destino para retiros desde ASIGNADO.
 * - Se entiende que el material se consume en el mismo proyecto/sitio donde estaba asignado.
 *
 * Requisitos:
 * - Siempre pedir "Solicitante" (empleado activo).
 * - ORIGEN (sitio/proyecto) se usa para consultar asignaciones.
 * - El backend deriva proyecto_origen_id + ubicacion_id desde la asignación.
 *
 * Payload:
 * {
 *   tipoRetiro: 'ASIGNADO',
 *   solicitanteEmpleadoId,
 *   sitioOrigenId,
 *   proyectoOrigenId,
 *   items: [{ asignacion_id, material_id, cantidad_a_retirar }]
 * }
 */
export default function RetiroAsignado({
  filterOptions,
  empleadosActivos,
  materialesAsignados,
  loadingAsignados,
  fetchMaterialesAsignados,
  registrarRetiro,
  isSubmitting,
}) {
  const theme = useTheme();

  // ORIGEN (para consultar asignaciones)
  const [selectedSitioOrigen, setSelectedSitioOrigen] = useState(null);
  const [selectedProyectoOrigen, setSelectedProyectoOrigen] = useState(null);

  // SOLICITANTE
  const [selectedSolicitante, setSelectedSolicitante] = useState(null);

  // { [asignacion_id]: cantidad_string }
  const [itemsToWithdraw, setItemsToWithdraw] = useState({});

  /** -------------------------------
   *  Opciones dependientes
   * ------------------------------ */
  const proyectosOrigenFiltrados = useMemo(() => {
    if (!selectedSitioOrigen) return [];
    return (filterOptions.proyectosAsignados || []).filter(
      (p) => p.sitio_id === selectedSitioOrigen.id,
    );
  }, [selectedSitioOrigen, filterOptions.proyectosAsignados]);

  /** -------------------------------
   *  Cargar asignaciones cuando cambia ORIGEN
   * ------------------------------ */
  useEffect(() => {
    if (selectedSitioOrigen && selectedProyectoOrigen) {
      fetchMaterialesAsignados(selectedSitioOrigen.id, selectedProyectoOrigen.id);
      setItemsToWithdraw({});
    }
  }, [selectedSitioOrigen, selectedProyectoOrigen, fetchMaterialesAsignados]);

  /** -------------------------------
   *  Si cambia sitio origen y el proyecto ya no coincide, limpiarlo
   * ------------------------------ */
  useEffect(() => {
    if (
      selectedSitioOrigen &&
      selectedProyectoOrigen &&
      selectedProyectoOrigen.sitio_id !== selectedSitioOrigen.id
    ) {
      setSelectedProyectoOrigen(null);
    }
  }, [selectedSitioOrigen, selectedProyectoOrigen]);

  /** -------------------------------
   *  Handlers
   * ------------------------------ */
  const handleQuantityChange = (asignacion_id, value) => {
    const material = materialesAsignados.find((m) => m.asignacion_id === asignacion_id);
    if (!material) return;

    const maxQty = parseFloat(material.cantidad_asignada_pendiente);
    const inputQty = parseFloat(value) || 0;
    const finalQty = Math.max(0, Math.min(inputQty, maxQty));

    setItemsToWithdraw((prev) => ({ ...prev, [asignacion_id]: finalQty.toString() }));
  };

  const handleSelectAll = () => {
    const newItems = {};
    materialesAsignados.forEach((item) => {
      newItems[item.asignacion_id] = item.cantidad_asignada_pendiente.toString();
    });
    setItemsToWithdraw(newItems);
  };

  const handleCheckboxChange = (asignacion_id, checked) => {
    if (checked) {
      const material = materialesAsignados.find((m) => m.asignacion_id === asignacion_id);
      if (material) {
        handleQuantityChange(asignacion_id, material.cantidad_asignada_pendiente);
      }
    } else {
      setItemsToWithdraw((prev) => {
        const newState = { ...prev };
        delete newState[asignacion_id];
        return newState;
      });
    }
  };

  const canSubmit =
    !!selectedSitioOrigen &&
    !!selectedProyectoOrigen &&
    !!selectedSolicitante &&
    Object.keys(itemsToWithdraw).length > 0;

  const handleSubmit = async () => {
    if (!selectedSolicitante) {
      alert('Selecciona el solicitante (empleado).');
      return;
    }
    if (!selectedSitioOrigen || !selectedProyectoOrigen) {
      alert('Selecciona ORIGEN (sitio/proyecto) para ver asignaciones.');
      return;
    }

    const itemsPayload = Object.entries(itemsToWithdraw)
      .map(([asignacion_id, cantidad_a_retirar]) => {
        const material = materialesAsignados.find(
          (m) => m.asignacion_id === parseInt(asignacion_id, 10),
        );
        return material
          ? {
              asignacion_id: parseInt(asignacion_id, 10),
              material_id: material.material_id,
              cantidad_a_retirar: parseFloat(cantidad_a_retirar),
            }
          : null;
      })
      .filter((item) => item && item.cantidad_a_retirar > 0);

    if (itemsPayload.length === 0) {
      alert('No has seleccionado materiales o cantidades a retirar.');
      return;
    }

    const payload = {
      tipoRetiro: 'ASIGNADO',
      solicitanteEmpleadoId: selectedSolicitante.id,
      sitioOrigenId: selectedSitioOrigen.id,
      proyectoOrigenId: selectedProyectoOrigen.id,
      items: itemsPayload,
    };

    try {
      await registrarRetiro(payload);

      // ✅ refrescar asignaciones inmediatamente (sin recargar toda la página)
      await fetchMaterialesAsignados(selectedSitioOrigen.id, selectedProyectoOrigen.id);

      // limpia cantidades (mantiene origen y solicitante para capturar más retiros rápido)
      setItemsToWithdraw({});
    } catch (e) {
      // toast ya se maneja en el hook
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
        backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 60%)`,
        boxShadow: `0 12px 26px ${alpha(theme.palette.primary.main, 0.08)}`,
      }}
    >
      <Box>
        <Typography variant="h6" gutterBottom>
          Retirar Material Asignado
        </Typography>

        {/* =========================
            SOLICITANTE
           ========================= */}
        <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
          Solicitante (¿quién pidió la salida?)
        </Typography>
        <Autocomplete
          fullWidth
          options={empleadosActivos || []}
          getOptionLabel={(o) => o?.empleado || ''}
          value={selectedSolicitante}
          onChange={(_, v) => setSelectedSolicitante(v)}
          renderInput={(params) => (
            <TextField {...params} label="Solicitante" required />
          )}
        />

        <Divider sx={{ my: 2 }} />

        {/* =========================
            ORIGEN
           ========================= */}
        <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
          Origen (de dónde sale el material asignado)
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <Autocomplete
            fullWidth
            options={filterOptions.sitiosAsignados || []}
            getOptionLabel={(o) => o?.nombre || ''}
            value={selectedSitioOrigen}
            onChange={(_, v) => {
              setSelectedSitioOrigen(v);
              setSelectedProyectoOrigen(null);
            }}
            renderInput={(params) => <TextField {...params} label="Sitio Origen" />}
          />
          <Autocomplete
            fullWidth
            options={proyectosOrigenFiltrados}
            getOptionLabel={(o) => o?.nombre || ''}
            value={selectedProyectoOrigen}
            onChange={(_, v) => setSelectedProyectoOrigen(v)}
            renderInput={(params) => <TextField {...params} label="Proyecto Origen" />}
            disabled={!selectedSitioOrigen}
          />
        </Stack>

        {/* =========================
            LISTA + CANTIDADES
           ========================= */}
        {loadingAsignados && (
          <CircularProgress sx={{ display: 'block', margin: 'auto', mt: 2 }} />
        )}

        {!loadingAsignados && selectedSitioOrigen && selectedProyectoOrigen && (
          <>
            {materialesAsignados.length === 0 ? (
              <Typography>
                No hay materiales asignados pendientes para este proyecto/sitio.
              </Typography>
            ) : (
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={handleSelectAll}>
                    Seleccionar Todo
                  </Button>
                </Box>

                {materialesAsignados.map((item) => (
                  <Stack
                    key={item.asignacion_id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Checkbox
                      checked={!!itemsToWithdraw[item.asignacion_id]}
                      onChange={(e) =>
                        handleCheckboxChange(item.asignacion_id, e.target.checked)
                      }
                    />
                    <Typography sx={{ flexGrow: 1 }}>{item.material_nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {`Disp: ${item.cantidad_asignada_pendiente} ${item.unidad_simbolo}`}
                    </Typography>

                    <TextField
                      size="small"
                      type="number"
                      label="Retirar"
                      value={itemsToWithdraw[item.asignacion_id] || ''}
                      onChange={(e) => handleQuantityChange(item.asignacion_id, e.target.value)}
                      sx={{ width: '110px' }}
                      inputProps={{
                        max: item.cantidad_asignada_pendiente,
                        min: 0,
                        step: 'any',
                      }}
                      disabled={!itemsToWithdraw[item.asignacion_id]}
                    />
                  </Stack>
                ))}

                <Button
                  sx={{ mt: 3 }}
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canSubmit}
                  startIcon={
                    isSubmitting ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <SendIcon />
                    )
                  }
                >
                  {isSubmitting ? 'Registrando Retiro...' : 'Confirmar Retiro Asignado'}
                </Button>
              </Stack>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
