// sira-front/src/components/almacen/InventarioForm.jsx
import React, { useState } from 'react';
import { useInventario } from '../../hooks/useInventario';
import { Box, Paper, Grid, Typography, CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import KPICard from '../REC_OC/KPICard'; // Reutilizamos KPI Card
import FiltrosInventario from './FiltrosInventario'; // Creamos este
import InventarioItemRow from './InventarioItemRow'; // Creamos este
import DetalleAsignacionesModal from './DetalleAsignacionesModal'; // Creamos este
import ApartarStockModal from './ApartarStockModal'; // Creamos este
import MoverAsignacionModal from './MoverAsignacionModal'; // Creamos este

// Iconos para KPIs (Ejemplos)
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CategoryIcon from '@mui/icons-material/Category';

export default function InventarioForm() {
    const {
        inventario, loading, kpis, filters, setFilters, filterOptions,
        resetFilters, getDetalleAsignaciones, apartarStock, moverAsignacion,
        isSubmittingAction
    } = useInventario();

    // Estado para los modales
    const [modalState, setModalState] = useState({ type: null, data: null }); // type: 'info', 'apartar', 'mover'

    const handleOpenModal = async (type, material) => {
        if (type === 'info') {
            const asignaciones = await getDetalleAsignaciones(material.material_id);
            setModalState({ type, data: { material, asignaciones } });
        } else {
            setModalState({ type, data: { material } }); // Pasa el material a los modales de acción
        }
    };

    const handleCloseModal = () => {
        setModalState({ type: null, data: null });
    };

    const handleApartar = async (payload) => {
        const success = await apartarStock(payload);
        if (success) handleCloseModal();
    };

    const handleMover = async (payload) => {
        const success = await moverAsignacion(payload);
        if (success) handleCloseModal();
    };


    return (
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            {/* KPIs */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}><KPICard title="Valor Disponible (Est.)" value={"$ TBD"} icon={<AttachMoneyIcon />} color="#4caf50" comment="Cálculo Pendiente" /></Grid>
                <Grid item xs={12} sm={4}><KPICard title="Valor Apartado" value={"$ TBD"} icon={<AssignmentTurnedInIcon />} color="#ff9800" comment="Cálculo Pendiente" /></Grid>
                <Grid item xs={12} sm={4}><KPICard title="SKUs Activos" value={kpis.skus || 0} icon={<CategoryIcon />} color="#2196f3" /></Grid>
            </Grid>

            {/* Filtros */}
            <FiltrosInventario
                filters={filters}
                onFilterChange={setFilters}
                onReset={resetFilters}
                filterOptions={filterOptions}
            />

            {/* Lista de Inventario */}
            <Paper elevation={3}>
                <TableContainer>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Material</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Disponible</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Apartado</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center"><CircularProgress /></TableCell>
                                </TableRow>
                            ) : inventario.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center"><Typography>No hay materiales que coincidan con los filtros.</Typography></TableCell>
                                </TableRow>
                            ) : (
                                inventario.map((item) => (
                                    <InventarioItemRow
                                        key={item.material_id + '-' + item.ubicacion_id} // Clave única si agrupamos mal
                                        item={item}
                                        onOpenModal={handleOpenModal}
                                    />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

             {/* Modales */}
             {modalState.type === 'info' && modalState.data && (
                <DetalleAsignacionesModal
                    open={true}
                    onClose={handleCloseModal}
                    material={modalState.data.material}
                    asignaciones={modalState.data.asignaciones}
                />
             )}
            {modalState.type === 'apartar' && modalState.data && (
                 <ApartarStockModal
                    open={true}
                    onClose={handleCloseModal}
                    material={modalState.data.material}
                    filterOptions={filterOptions} // Pasa sitios y proyectos para seleccionar destino
                    onSubmit={handleApartar}
                    isSubmitting={isSubmittingAction}
                 />
            )}
            {modalState.type === 'mover' && modalState.data && (
                 <MoverAsignacionModal
                    open={true}
                    onClose={handleCloseModal}
                    material={modalState.data.material}
                    filterOptions={filterOptions} // Pasa sitios y proyectos
                    // Necesitamos cargar las asignaciones actuales para este modal
                    getDetalleAsignaciones={getDetalleAsignaciones}
                    onSubmit={handleMover}
                    isSubmitting={isSubmittingAction}
                 />
            )}

        </Box>
    );
}