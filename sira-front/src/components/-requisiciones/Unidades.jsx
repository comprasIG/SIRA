// sira-front/src/components/-requisiciones/Unidades.jsx
import React, { useState, useMemo } from 'react';
import { Box, Typography, CircularProgress, Grid, Alert } from '@mui/material';
// --- ¡MODIFICADO! Importamos MÁS cosas del hook ---
import { useUnidades } from '../../hooks/useUnidades';
import { useAuth } from '../../context/authContext'; 

import UnidadKPIs from './UnidadKPIs';
import UnidadFiltros from './UnidadFiltros';
import UnidadCard from './UnidadCard';
import ModalSolicitarServicio from './ModalSolicitarServicio';
import ModalVerHistorial from './ModalVerHistorial';
import ModalAgregarRegistro from './ModalAgregarRegistro';

export default function Unidades() {
  // --- ¡MODIFICADO! El hook ahora nos da todo ---
  const { 
    unidades, 
    loading, 
    refetchUnidades, 
    filters, 
    setFilters, 
    filterOptions, 
    resetFilters 
  } = useUnidades();
  
  const { usuario } = useAuth();
  
  // --- ¡MODIFICADO! El estado del modal sigue siendo local ---
  const [modalState, setModalState] = useState({ 
    servicio: false, 
    historial: false, 
    registroManual: false, 
    unidadSeleccionada: null 
  });
  
  // (Funciones de modales sin cambios)
  const handleOpenServicioModal = (unidad) => {
    setModalState({ servicio: true, historial: false, registroManual: false, unidadSeleccionada: unidad });
  };
  const handleOpenHistorialModal = (unidad) => {
    setModalState({ servicio: false, historial: true, registroManual: false, unidadSeleccionada: unidad });
  };
  const handleOpenRegistroModal = (unidad) => {
    setModalState({ servicio: false, historial: false, registroManual: true, unidadSeleccionada: unidad });
  };
  const handleCloseModal = () => {
    setModalState({ servicio: false, historial: false, registroManual: false, unidadSeleccionada: null });
  };
  const handleAccionCompletada = () => {
    refetchUnidades();
  };
  
  // Lógica para saber si el usuario puede filtrar (sin cambios)
  const puedeVerTodo = useMemo(() => {
    if (!usuario) return false;
    return usuario.es_superusuario || ['FIN', 'SSD'].includes(usuario.departamento_codigo);
  }, [usuario]);

  // --- ¡ELIMINADO! ---
  // Ya no necesitamos 'unidadesFiltradas' ni 'filterOptions'
  // La API nos da la lista ya filtrada.

  if (loading || !usuario) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, maxWidth: 1600, margin: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Flotilla Vehicular
      </Typography>

      {/* --- ¡MODIFICADO! Le pasamos 'unidades' (la lista filtrada) --- */}
      <UnidadKPIs unidades={unidades} />

      {/* --- ¡MODIFICADO! Le pasamos todas las props nuevas --- */}
      <UnidadFiltros
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
        resetFilters={resetFilters}
        usuarioPuedeVerTodo={puedeVerTodo}
      />

      {/* --- ¡MODIFICADO! Usamos 'unidades' directamente --- */}
      {loading && unidades.length === 0 && <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />}
      
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
              onAbrirServicio={() => handleOpenServicioModal(unidad)}
              onAbrirHistorial={() => handleOpenHistorialModal(unidad)}
              onAbrirRegistro={() => handleOpenRegistroModal(unidad)}
            />
          </Grid>
        ))}
      </Grid>

      {/* ... (Modales se quedan igual) ... */}
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
          />
          
          <ModalAgregarRegistro
            open={modalState.registroManual}
            onClose={handleCloseModal}
            unidad={modalState.unidadSeleccionada}
            onRegistroCreado={handleAccionCompletada}
          />
        </>
      )}
    </Box>
  );
}