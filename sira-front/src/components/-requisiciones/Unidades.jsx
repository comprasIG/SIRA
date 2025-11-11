// sira-front/src/components/-requisiciones/Unidades.jsx
import React, { useState, useMemo } from 'react';
import { Box, Typography, CircularProgress, Grid, Alert } from '@mui/material';
import { useUnidades } from '../../hooks/useUnidades';
import { useAuth } from '../../context/authContext'; 

// Importamos los nuevos componentes
import UnidadKPIs from './UnidadKPIs';
import UnidadFiltros from './UnidadFiltros';
import UnidadCard from './UnidadCard';
// ======== ¡NUEVO! Importamos el Modal ========
import ModalSolicitarServicio from './ModalSolicitarServicio';
// =============================================

export default function Unidades() {
  // ======== ¡CAMBIO! Obtenemos la función de recarga ========
  const { unidades, loading, refetchUnidades } = useUnidades();
  const { usuario } = useAuth();
  
  // Estado para los filtros
  const [filters, setFilters] = useState({ departamentoId: '' });

  // ======== ¡NUEVO! Estado para manejar los modales ========
  const [modalState, setModalState] = useState({ 
    servicio: false, 
    historial: false, 
    unidadSeleccionada: null 
  });
  
  // Funciones para abrir y cerrar modales
  const handleOpenServicioModal = (unidad) => {
    setModalState({ servicio: true, historial: false, unidadSeleccionada: unidad });
  };
  
  const handleOpenHistorialModal = (unidad) => {
    // (Aún no lo implementamos, pero ya dejamos la función lista)
    alert(`TODO: Abrir historial de ${unidad.unidad}`);
    // setModalState({ servicio: false, historial: true, unidadSeleccionada: unidad });
  };

  const handleCloseModal = () => {
    setModalState({ servicio: false, historial: false, unidadSeleccionada: null });
  };

  // Función que se pasa al modal para recargar las "cards"
  const handleRequisicionCreada = () => {
    refetchUnidades();
  };
  // =========================================================

  // Lógica para saber si el usuario puede filtrar (sin cambios)
  const puedeVerTodo = useMemo(() => {
    if (!usuario) return false;
    return usuario.es_superusuario || ['FIN', 'SSD'].includes(usuario.departamento_codigo);
  }, [usuario]);

  // Lógica para filtrar las unidades (sin cambios)
  const unidadesFiltradas = useMemo(() => {
    if (!usuario || !unidades) return [];
    
    return unidades.filter(unidad => {
      if (puedeVerTodo && filters.departamentoId) {
        return unidad.departamento_codigo === filters.departamentoId;
      }
      if (!puedeVerTodo) {
        return unidad.departamento_codigo === usuario.departamento_codigo;
      }
      return true;
    });
  }, [unidades, filters, puedeVerTodo, usuario]);

  // Opciones de departamento para el filtro (sin cambios)
  const filterOptions = useMemo(() => {
    const departamentos = new Map();
    unidades.forEach(u => {
      if (u.departamento_codigo && u.departamento_nombre) {
        departamentos.set(u.departamento_codigo, u.departamento_nombre);
      }
    });
    return Array.from(departamentos, ([codigo, nombre]) => ({ codigo, nombre }));
  }, [unidades]);


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

      <UnidadKPIs unidades={unidadesFiltradas} />

      {puedeVerTodo && (
        <UnidadFiltros
          filters={filters}
          setFilters={setFilters}
          options={filterOptions}
        />
      )}

      {loading && unidadesFiltradas.length === 0 && <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />}
      
      {!loading && unidadesFiltradas.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No se encontraron unidades para tu departamento o que coincidan con los filtros.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {unidadesFiltradas.map((unidad) => (
          <Grid item key={unidad.id} xs={12} sm={6} md={4} lg={3}>
            {/* ======== ¡CAMBIO! Pasamos las funciones a la Card ======== */}
            <UnidadCard 
              unidad={unidad} 
              onAbrirServicio={() => handleOpenServicioModal(unidad)}
              onAbrirHistorial={() => handleOpenHistorialModal(unidad)}
            />
          </Grid>
        ))}
      </Grid>

      {/* ======== ¡NUEVO! Renderizamos el Modal (se mostrará cuando 'open' sea true) ======== */}
      {modalState.unidadSeleccionada && (
        <ModalSolicitarServicio
          open={modalState.servicio}
          onClose={handleCloseModal}
          unidad={modalState.unidadSeleccionada}
          onReqCreada={handleRequisicionCreada}
        />
      )}

      {/* (Aquí irá el ModalVerHistorial en el futuro) */}

    </Box>
  );
}