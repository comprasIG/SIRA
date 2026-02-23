// sira-front/src/components/-requisiciones/Unidades.jsx
import React, { useState, useMemo } from 'react';
import { Box, Typography, CircularProgress, Grid, Alert, Button, Stack } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useUnidades } from '../../hooks/useUnidades';
import { useAuth } from '../../context/authContext';

import UnidadKPIs from './UnidadKPIs';
import UnidadFiltros from './UnidadFiltros';
import UnidadCard from './UnidadCard';
import ModalSolicitarServicio from './ModalSolicitarServicio';
import ModalVerHistorial from './ModalVerHistorial';
import ModalAgregarRegistro from './ModalAgregarRegistro';
import ModalVerUnidad from './ModalVerUnidad';
import ModalGestionarEventoTipos from './ModalGestionarEventoTipos';

const MODAL_INIT = {
  servicio: false,
  historial: false,
  registroManual: false,
  detalle: false,
  unidadSeleccionada: null,
};


export default function Unidades() {
  const {
    unidades, loading, refetchUnidades,
    filters, setFilters, filterOptions, resetFilters,
  } = useUnidades();

  const { usuario } = useAuth();
  const [modalState, setModalState] = useState(MODAL_INIT);
  const [modalGestionar, setModalGestionar] = useState(false);

  const openModal = (tipo, unidad) => {
    setModalState({ ...MODAL_INIT, [tipo]: true, unidadSeleccionada: unidad });
  };
  const handleCloseModal = () => setModalState(MODAL_INIT);

  const handleAccionCompletada = () => {
    refetchUnidades();
    handleCloseModal();
  };

  // Re-fetch sin cerrar el modal de historial cuando se cierra una alerta
  const handleAlertaCerrada = () => {
    refetchUnidades();
  };

  const puedeVerTodo = useMemo(() => {
    if (!usuario) return false;
    // La verificacion real viene del backend; aqui solo sirve para mostrar/ocultar filtro de dpto
    return usuario.es_superusuario || usuario.puede_ver_todas_unidades === true;
  }, [usuario]);

  if (loading || !usuario) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, maxWidth: 1600, margin: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h4" fontWeight="bold">
          Flotilla Vehicular
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SettingsIcon />}
          onClick={() => setModalGestionar(true)}
        >
          Tipos de Evento
        </Button>
      </Stack>

      <UnidadKPIs unidades={unidades} />

      <UnidadFiltros
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
        resetFilters={resetFilters}
        usuarioPuedeVerTodo={puedeVerTodo}
      />

      {loading && unidades.length === 0 && (
        <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />
      )}

      {!loading && unidades.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No se encontraron unidades para tu departamento o que coincidan con los filtros.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {unidades.map((unidad) => (
          <Grid item key={unidad.id} xs={12} sm={6} md={4} lg={3}>
            <UnidadCard
              unidad={unidad}
              onAbrirServicio={() => openModal('servicio', unidad)}
              onAbrirHistorial={() => openModal('historial', unidad)}
              onAbrirRegistro={() => openModal('registroManual', unidad)}
              onAbrirDetalle={() => openModal('detalle', unidad)}
            />
          </Grid>
        ))}
      </Grid>

      {/* Modales */}
      {modalState.unidadSeleccionada && (
        <>
          <ModalSolicitarServicio
            open={modalState.servicio}
            onClose={handleCloseModal}
            unidad={modalState.unidadSeleccionada}
            onReqCreada={handleAccionCompletada}
          />

          <ModalVerHistorial
            open={modalState.historial}
            onClose={handleCloseModal}
            unidad={modalState.unidadSeleccionada}
            onAlertaCerrada={handleAlertaCerrada}
          />

          <ModalAgregarRegistro
            open={modalState.registroManual}
            onClose={handleCloseModal}
            unidad={modalState.unidadSeleccionada}
            onRegistroCreado={handleAccionCompletada}
          />

          <ModalVerUnidad
            open={modalState.detalle}
            onClose={handleCloseModal}
            unidad={modalState.unidadSeleccionada}
          />
        </>
      )}

      <ModalGestionarEventoTipos
        open={modalGestionar}
        onClose={() => setModalGestionar(false)}
      />
    </Box>
  );
}
