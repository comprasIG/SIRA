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
  Divider
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

/**
 * RetiroAsignado
 * =========================================================================================
 * Flujo:
 * 1) Seleccionas ORIGEN (sitio/proyecto) -> lista material asignado pendiente.
 * 2) Seleccionas DESTINO (sitio/proyecto) -> requerido para registrar la SALIDA.
 * 3) Seleccionas cantidades por asignación (checkbox + qty).
 *
 * Nota:
 * - El backend usa el ORIGEN real desde la asignación (proyecto_origen_id + requisicion_id),
 *   para que la reversa devuelva a asignado y no a stock.
 * - El DESTINO lo enviamos en el payload y queda reflejado en kardex (proyecto_destino_id + observaciones).
 */
export default function RetiroAsignado({
  filterOptions,
  materialesAsignados,
  loadingAsignados,
  fetchMaterialesAsignados,
  registrarRetiro,
  isSubmitting,
}) {
  // ORIGEN (para consultar asignaciones)
  const [selectedSitioOrigen, setSelectedSitioOrigen] = useState(null);
  const [selectedProyectoOrigen, setSelectedProyectoOrigen] = useState(null);

  // DESTINO (para registrar salida)
  const [selectedSitioDestino, setSelectedSitioDestino] = useState(null);
  const [selectedProyectoDestino, setSelectedProyectoDestino] = useState(null);

  // { [asignacion_id]: cantidad_string }
  const [itemsToWithdraw, setItemsToWithdraw] = useState({});

  /** -------------------------------
   *  Opciones dependientes
   * ------------------------------ */
  const proyectosOrigenFiltrados = useMemo(() => {
    if (!selectedSitioOrigen) return [];
    return (filterOptions.proyectosAsignados || []).filter(p => p.sitio_id === selectedSitioOrigen.id);
  }, [selectedSitioOrigen, filterOptions.proyectosAsignados]);

  const proyectosDestinoFiltrados = useMemo(() => {
    if (!selectedSitioDestino) return [];
    return (filterOptions.todosProyectos || []).filter(p => p.sitio_id === selectedSitioDestino.id);
  }, [selectedSitioDestino, filterOptions.todosProyectos]);

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
    if (selectedSitioOrigen && selectedProyectoOrigen && selectedProyectoOrigen.sitio_id !== selectedSitioOrigen.id) {
      setSelectedProyectoOrigen(null);
    }
  }, [selectedSitioOrigen, selectedProyectoOrigen]);

  /** -------------------------------
   *  Si cambia sitio destino y el proyecto ya no coincide, limpiarlo
   * ------------------------------ */
  useEffect(() => {
    if (selectedSitioDestino && selectedProyectoDestino && selectedProyectoDestino.sitio_id !== selectedSitioDestino.id) {
      setSelectedProyectoDestino(null);
    }
  }, [selectedSitioDestino, selectedProyectoDestino]);

  /**
   * Conveniencia UX:
   * - Cuando ya seleccionaste ORIGEN, prellenamos DESTINO igual (puedes cambiarlo).
   */
  useEffect(() => {
    if (selectedSitioOrigen && !selectedSitioDestino) setSelectedSitioDestino(selectedSitioOrigen);
    // Ojo: selectedProyectoOrigen puede tardar en setear, por eso usamos un efecto separado
  }, [selectedSitioOrigen, selectedSitioDestino]);

  useEffect(() => {
    if (selectedProyectoOrigen && !selectedProyectoDestino) setSelectedProyectoDestino(selectedProyectoOrigen);
  }, [selectedProyectoOrigen, selectedProyectoDestino]);

  /** -------------------------------
   *  Handlers
   * ------------------------------ */
  const handleQuantityChange = (asignacion_id, value) => {
    const material = materialesAsignados.find(m => m.asignacion_id === asignacion_id);
    if (!material) return;

    const maxQty = parseFloat(material.cantidad_asignada_pendiente);
    const inputQty = parseFloat(value) || 0;
    const finalQty = Math.max(0, Math.min(inputQty, maxQty));

    setItemsToWithdraw(prev => ({ ...prev, [asignacion_id]: finalQty.toString() }));
  };

  const handleSelectAll = () => {
    const newItems = {};
    materialesAsignados.forEach(item => {
      newItems[item.asignacion_id] = item.cantidad_asignada_pendiente.toString();
    });
    setItemsToWithdraw(newItems);
  };

  const handleCheckboxChange = (asignacion_id, checked) => {
    if (checked) {
      const material = materialesAsignados.find(m => m.asignacion_id === asignacion_id);
      if (material) {
        handleQuantityChange(asignacion_id, material.cantidad_asignada_pendiente);
      }
    } else {
      setItemsToWithdraw(prev => {
        const newState = { ...prev };
        delete newState[asignacion_id];
        return newState;
      });
    }
  };

  const destinoSeleccionado = !!(selectedSitioDestino && selectedProyectoDestino);

  const handleSubmit = async () => {
    if (!selectedSitioOrigen || !selectedProyectoOrigen) {
      alert('Selecciona ORIGEN (sitio/proyecto) para ver asignaciones.');
      return;
    }
    if (!destinoSeleccionado) {
      alert('Selecciona DESTINO (sitio/proyecto) para registrar la salida.');
      return;
    }

    const itemsPayload = Object.entries(itemsToWithdraw)
      .map(([asignacion_id, cantidad_a_retirar]) => {
        const material = materialesAsignados.find(m => m.asignacion_id === parseInt(asignacion_id, 10));
        return material
          ? {
              asignacion_id: parseInt(asignacion_id, 10),
              material_id: material.material_id,
              cantidad_a_retirar: parseFloat(cantidad_a_retirar),
            }
          : null;
      })
      .filter(item => item && item.cantidad_a_retirar > 0);

    if (itemsPayload.length === 0) {
      alert('No has seleccionado materiales o cantidades a retirar.');
      return;
    }

    const payload = {
      tipoRetiro: 'ASIGNADO',
      items: itemsPayload,
      proyectoDestinoId: selectedProyectoDestino.id,
      sitioDestinoId: selectedSitioDestino.id,
    };

    const success = await registrarRetiro(payload);

    if (success) {
      // ✅ Refrescar asignaciones inmediatamente (sin recargar)
      await fetchMaterialesAsignados(selectedSitioOrigen.id, selectedProyectoOrigen.id);

      // Limpia cantidades pero mantiene origen/destino para capturar rápido más retiros
      setItemsToWithdraw({});
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Retirar Material Asignado
      </Typography>

      {/* =========================
          1) ORIGEN
         ========================= */}
      <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
        1) Origen (de dónde sale el material apartado)
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

      <Divider sx={{ my: 2 }} />

      {/* =========================
          2) DESTINO
         ========================= */}
      <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
        2) Destino (a dónde se va el material)
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Autocomplete
          fullWidth
          options={filterOptions.todosSitios || []}
          getOptionLabel={(o) => o?.nombre || ''}
          value={selectedSitioDestino}
          onChange={(_, v) => {
            setSelectedSitioDestino(v);
            setSelectedProyectoDestino(null);
          }}
          renderInput={(params) => <TextField {...params} label="Sitio Destino" required />}
        />

        <Autocomplete
          fullWidth
          options={proyectosDestinoFiltrados}
          getOptionLabel={(o) => o?.nombre || ''}
          value={selectedProyectoDestino}
          onChange={(_, v) => setSelectedProyectoDestino(v)}
          renderInput={(params) => <TextField {...params} label="Proyecto Destino" required />}
          disabled={!selectedSitioDestino}
        />
      </Stack>

      {/* =========================
          3) LISTA + CANTIDADES
         ========================= */}
      {loadingAsignados && <CircularProgress sx={{ display: 'block', margin: 'auto', mt: 2 }} />}

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
                    onChange={(e) => handleCheckboxChange(item.asignacion_id, e.target.checked)}
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
                    inputProps={{ max: item.cantidad_asignada_pendiente, min: 0, step: 'any' }}
                    disabled={!itemsToWithdraw[item.asignacion_id]}
                  />
                </Stack>
              ))}

              <Button
                sx={{ mt: 3 }}
                variant="contained"
                onClick={handleSubmit}
                disabled={isSubmitting || Object.keys(itemsToWithdraw).length === 0 || !destinoSeleccionado}
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              >
                {isSubmitting ? 'Registrando Retiro...' : 'Confirmar Retiro Asignado'}
              </Button>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
