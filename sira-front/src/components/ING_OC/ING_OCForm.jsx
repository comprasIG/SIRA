// sira-front/src/components/ING_OC/ING_OCForm.jsx
import React, { useState } from 'react';
import { useIngresoOC } from '../../hooks/useIngresoOC';
import { Grid, CircularProgress, Typography, Box, Paper, Tooltip } from '@mui/material';
import IngresoOCCard from './IngresoOCCard';
import IngresoOCModal from './IngresoOCModal';
import FiltrosIngresoOC from './FiltrosIngresoOC'; // Componente de filtros específico
import KPICard from '../REC_OC/KPICard'; // Reutilizamos el KPICard de REC_OC

// Iconos para KPIs
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MopedIcon from '@mui/icons-material/Moped';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import RuleFolderIcon from '@mui/icons-material/RuleFolder';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';


export default function ING_OCForm() {
    const {
        ocsEnProceso, loading, kpis, filters, setFilters, filterOptions,
        resetFilters, getDetallesOC, registrarIngreso, refreshData
    } = useIngresoOC();

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedOc, setSelectedOc] = useState(null); // OC completa para el modal
    const [detallesOc, setDetallesOc] = useState([]); // Detalles para el modal
    const [loadingModal, setLoadingModal] = useState(false);

    const handleOpenModal = async (oc) => {
        setSelectedOc(oc);
        setLoadingModal(true);
        setModalOpen(true);
        const detalles = await getDetallesOC(oc.id);
        setDetallesOc(detalles);
        setLoadingModal(false);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedOc(null);
        setDetallesOc([]);
    };

    const handleRegistrarIngreso = async (ingresoData) => {
        await registrarIngreso(ingresoData);
        handleCloseModal(); // Cierra el modal si el registro fue exitoso
        // refreshData(); // Ya se llama dentro de registrarIngreso si tiene éxito
    };

    // Aplicar filtro de KPI si uno está activo
    const handleKpiClick = (filterCriteria) => {
        setFilters(prev => ({ ...initialFilters, ...filterCriteria }));
        // La lista se actualizará por el useEffect en el hook
    };

    // Calcula los métodos de entrega para los tooltips de KPIs
     const kpiTooltips = {
        total: `Total OCs EN PROCESO`,
        proveedorEntrega: `Proveedor entrega directamente`,
        paqueteria: `Envío por paquetería`,
        equipoRecoleccion: `Equipo interno recoge`,
        parciales: `OCs con entregas parciales pendientes`,
        incidencia: `OCs con incidencias reportadas`,
    };


    return (
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            {/* KPIs */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                 <Tooltip title={kpiTooltips.total} placement="top">
                    <Grid item xs={6} sm={4} md={2}><KPICard title="Total Proceso" value={kpis.total_en_proceso || 0} icon={<InventoryIcon />} onClick={() => handleKpiClick({})}/></Grid>
                 </Tooltip>
                 <Tooltip title={kpiTooltips.proveedorEntrega} placement="top">
                    <Grid item xs={6} sm={4} md={2}><KPICard title="Proveedor Entrega" value={kpis.kpi_proveedor_entrega || 0} icon={<PersonPinIcon color="action"/>} onClick={() => handleKpiClick({ metodo_recoleccion_id: 1, entrega_responsable: 'PROVEEDOR' })}/></Grid>
                 </Tooltip>
                 <Tooltip title={kpiTooltips.paqueteria} placement="top">
                     <Grid item xs={6} sm={4} md={2}><KPICard title="Paquetería" value={kpis.kpi_paqueteria || 0} icon={<LocalShippingIcon color="info"/>} onClick={() => handleKpiClick({ metodo_recoleccion_id: 2 })}/></Grid>
                 </Tooltip>
                 <Tooltip title={kpiTooltips.equipoRecoleccion} placement="top">
                    <Grid item xs={6} sm={4} md={2}><KPICard title="Equipo Recoge" value={kpis.kpi_equipo_recoleccion || 0} icon={<MopedIcon color="success"/>} onClick={() => handleKpiClick({ metodo_recoleccion_id: 1, entrega_responsable: 'EQUIPO_RECOLECCION' })}/></Grid>
                 </Tooltip>
                 <Tooltip title={kpiTooltips.parciales} placement="top">
                    <Grid item xs={6} sm={4} md={2}><KPICard title="Parciales" value={kpis.kpi_parciales || 0} icon={<RuleFolderIcon color="warning"/>} onClick={() => handleKpiClick({ entrega_parcial: true })}/></Grid>
                 </Tooltip>
                 <Tooltip title={kpiTooltips.incidencia} placement="top">
                    <Grid item xs={6} sm={4} md={2}><KPICard title="Incidencias" value={kpis.kpi_con_incidencia || 0} icon={<ReportProblemIcon color="error"/>} onClick={() => handleKpiClick({ con_incidencia: true })}/></Grid>
                 </Tooltip>
            </Grid>

            {/* Filtros */}
            <FiltrosIngresoOC
                filterOptions={filterOptions}
                filters={filters}
                onFilterChange={setFilters} // Pasa la función para actualizar filtros
                onReset={resetFilters}
            />

            {/* Lista de OCs */}
            {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
                : <Grid container spacing={3}>
                    {ocsEnProceso.length > 0 ? ocsEnProceso.map((oc) => (
                        <Grid item xs={12} md={6} lg={4} key={oc.id}>
                            <IngresoOCCard oc={oc} onGestionarIngreso={() => handleOpenModal(oc)} />
                        </Grid>
                    )) : <Grid item xs={12}><Typography sx={{ textAlign: 'center', p: 4 }}>No hay órdenes que coincidan con los filtros.</Typography></Grid>}
                </Grid>
            }

            {/* Modal de Ingreso */}
            {selectedOc && (
                <IngresoOCModal
                    open={modalOpen}
                    onClose={handleCloseModal}
                    oc={selectedOc}
                    detalles={detallesOc}
                    loadingDetalles={loadingModal}
                    ubicaciones={filterOptions.ubicacionesAlmacen || []}
                    tiposIncidencia={filterOptions.tiposIncidencia || []}
                    onRegistrar={handleRegistrarIngreso}
                />
            )}
        </Box>
    );
}