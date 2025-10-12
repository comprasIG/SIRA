// sira-front/src/components/REC_OC/REC_OCForm.jsx
import React, { useState, useMemo } from 'react';
import { useRecoleccion } from '../../hooks/useRecoleccion';
import { Grid, CircularProgress, Typography, Box, Paper, Modal, Button, Stack, TextField, Autocomplete, List, ListItem, ListItemText, Divider } from '@mui/material';
import KPICard from './KPICard';
import RecoleccionOCCard from './RecoleccionOCCard';
import FiltrosRecoleccion from './FiltrosRecoleccion';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CancelScheduleSendIcon from '@mui/icons-material/CancelScheduleSend';

const styleModal = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%', maxWidth: 500, bgcolor: 'background.paper',
  boxShadow: 24, p: 4, borderRadius: 2,
};

export default function REC_OCForm() {
  const { 
      ocsAprobadas, ocsEnProceso, loading, kpis, 
      filters, setFilters, filterOptions, resetFilters, // <<< OBTENER NUEVOS DATOS DEL HOOK
      cancelarOC, procesarOC, fetchOcsEnProcesoList 
  } = useRecoleccion();

  // --- Estados para los modales ---
 const [cancelModal, setCancelModal] = useState(false);
  const [kpiModal, setKpiModal] = useState({ open: false, title: '', data: [] });
  const [cancelData, setCancelData] = useState({ id: null, motivo: '' });

  // --- Lógica para el modal de proveedores (KPI 1) ---
  const proveedoresPendientes = useMemo(() => {
    const marcas = new Set(ocsAprobadas.map(oc => oc.proveedor_marca));
    return Array.from(marcas).sort();
  }, [ocsAprobadas]);

  const handleOpenKpiModal = (type) => {
    if (type === 'pendientes') {
      setKpiModal({ open: true, title: 'Proveedores con Recolecciones Pendientes', data: proveedoresPendientes });
    }
    if (type === 'enRecoleccion') {
      fetchOcsEnProcesoList(); // Cargar datos bajo demanda
      setKpiModal({ open: true, title: 'Órdenes en Proceso de Recolección', data: ocsEnProceso });
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelData.id || !cancelData.motivo.trim()) {
        toast.error("Debes seleccionar una OC y escribir un motivo.");
        return;
    }
    await cancelarOC(cancelData.id, cancelData.motivo);
    setCancelModal(false);
    setCancelData({ id: null, motivo: '' });
  };
  
  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      {/* SECCIÓN DE KPIs y ACCIONES */}
      <Grid container spacing={2} sx={{ mb: 3 }} alignItems="stretch">
        <Grid item xs={12} sm={4}><KPICard title="Pendientes" value={kpis.pendientes} icon={<AssignmentTurnedInIcon />} color="#1976d2" onClick={() => handleOpenKpiModal('pendientes')} /></Grid>
        <Grid item xs={12} sm={4}><KPICard title="En Recolección" value={kpis.enRecoleccion} icon={<LocalShippingIcon />} color="#f57c00" onClick={() => handleOpenKpiModal('enRecoleccion')} /></Grid>
        <Grid item xs={12} sm={4}>
          <Button variant="outlined" color="error" sx={{ height: '100%', width: '100%', flexDirection: 'column' }} onClick={() => setCancelModal(true)}>
            <CancelScheduleSendIcon sx={{ fontSize: 40 }}/>
            <Typography>Cancelar OC Global</Typography>
          </Button>
        </Grid>
      </Grid>
      
      {/* SECCIÓN DE FILTROS */}
       <FiltrosRecoleccion
        filterOptions={filterOptions}
        filters={filters}
        onFilterChange={setFilters} // <<< ¡CAMBIO CLAVE! Pasamos la función correcta.
        onReset={resetFilters}
      />


      {/* LISTA DE OCs */}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
        : <Grid container spacing={3}>
          {ocsAprobadas.length > 0 ? ocsAprobadas.map((oc) => (
            <Grid item xs={12} md={6} lg={4} key={oc.id}><RecoleccionOCCard oc={oc} onProcesar={procesarOC} /></Grid>
          )) : <Grid item xs={12}><Typography sx={{textAlign: 'center', p: 4}}>No hay órdenes que coincidan con los filtros.</Typography></Grid>}
        </Grid>
      }
      
      {/* MODAL DE CANCELACIÓN GLOBAL */}
      <Modal open={cancelModal} onClose={() => setCancelModal(false)}>
        <Box sx={styleModal}>
            <Typography variant="h6">Cancelar Orden de Compra Aprobada</Typography>
            <Autocomplete
                options={ocsAprobadas}
                getOptionLabel={(option) => `${option.numero_oc} - ${option.proveedor_marca}`}
                onChange={(_event, newValue) => { setCancelData(prev => ({ ...prev, id: newValue?.id || null })) }}
                renderInput={(params) => <TextField {...params} label="Selecciona la OC a cancelar" margin="normal" />}
            />
            <TextField label="Motivo de la cancelación" required fullWidth multiline rows={3} value={cancelData.motivo} onChange={(e) => setCancelData(prev => ({...prev, motivo: e.target.value}))} sx={{mt: 2}}/>
            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{mt: 3}}>
                <Button onClick={() => setCancelModal(false)}>Cerrar</Button>
                <Button variant="contained" color="error" onClick={handleCancelSubmit}>Confirmar Cancelación</Button>
            </Stack>
        </Box>
      </Modal>

      {/* MODAL PARA KPIs */}
      <Modal open={kpiModal.open} onClose={() => setKpiModal({ open: false, title: '', data: [] })}>
          <Box sx={styleModal}>
              <Typography variant="h6">{kpiModal.title}</Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {kpiModal.data.map((item, index) => (
                      <React.Fragment key={index}>
                          <ListItem>
                              <ListItemText primary={typeof item === 'object' ? `${item.numero_oc} (${item.proveedor_marca})` : item} />
                          </ListItem>
                          <Divider component="li" />
                      </React.Fragment>
                  ))}
              </List>
          </Box>
      </Modal>
    </Box>
  );
}