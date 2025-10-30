// sira-front/src/components/almacen/InventarioForm.jsx
import React, { useState } from 'react';
import { useInventario } from '../../hooks/useInventario';
import { Box, Paper, Grid, Typography, CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import KPICard from '../REC_OC/KPICard';
import FiltrosInventario from './FiltrosInventario';
import InventarioItemRow from './InventarioItemRow';
import DetalleAsignacionesModal from './DetalleAsignacionesModal';
import ApartarStockModal from './ApartarStockModal';
import MoverAsignacionModal from './MoverAsignacionModal';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CategoryIcon from '@mui/icons-material/Category';

// Helper para formatear moneda
const formatCurrency = (value, currency) => {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN', // Default a MXN si la moneda es null/undefined
    }).format(value);
  } catch (e) {
    // Fallback si la moneda no es válida (ej. 'USD', 'MXN')
    return `$${Number(value).toFixed(2)} ${currency || ''}`;
  }
};

export default function InventarioForm() {
    const {
        inventario, loading, kpis, filters, setFilters, filterOptions,
        resetFilters, getDetalleAsignaciones, apartarStock, moverAsignacion,
        isSubmittingAction
    } = useInventario();

    const [modalState, setModalState] = useState({ type: null, data: null });

    const handleOpenModal = async (type, material) => {
        setModalState({ type, data: { material, asignaciones: null } }); // Pone asignaciones en null para mostrar carga
        if (type === 'info' || type === 'mover') {
            const asignaciones = await getDetalleAsignaciones(material.material_id);
            // Actualiza el estado del modal solo si el modal sigue abierto para ese tipo y material
            setModalState(prev => {
                if (prev.type === type && prev.data.material.material_id === material.material_id) {
                    return { ...prev, data: { ...prev.data, asignaciones } };
                }
                return prev; // Si el usuario cerró el modal mientras cargaba, no hace nada
            });
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

    // --- LÓGICA DE RENDERIZADO DE KPIs ACTUALIZADA ---
    return (
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            {/* KPIs */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {/* KPI de SKUs (siempre se muestra) */}
                <Grid item xs={12} sm={4} md={3}>
                    <KPICard title="SKUs Activos" value={kpis.kpi_skus || 0} icon={<CategoryIcon />} color="#2196f3" />
                </Grid>

                {/* KPIs de Valor Disponible (iterando) */}
                {(kpis.valores_disponibles || []).map(kpi => (
                    <Grid item xs={6} sm={4} md={3} key={`disp-${kpi.moneda}`}>
                        <KPICard
                            title={`Valor Disponible (${kpi.moneda})`}
                            value={formatCurrency(kpi.valor_total, kpi.moneda)}
                            icon={<AttachMoneyIcon />}
                            color="#4caf50"
                        />
                    </Grid>
                ))}

                 {/* KPIs de Valor Apartado (iterando) */}
                 {(kpis.valores_apartados || []).map(kpi => (
                    <Grid item xs={6} sm={4} md={3} key={`apar-${kpi.moneda}`}>
                        <KPICard
                            title={`Valor Apartado (${kpi.moneda})`}
                            value={formatCurrency(kpi.valor_total, kpi.moneda)}
                            icon={<AssignmentTurnedInIcon />}
                            color="#ff9800"
                        />
                    </Grid>
                ))}
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
                            {loading && inventario.length === 0 ? ( // Muestra carga solo si la lista está vacía
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
                                        key={item.material_id} // Clave única por material_id
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
                    asignaciones={modalState.data.asignaciones} // Pasa null si está cargando, o el array
                />
             )}
            {modalState.type === 'apartar' && modalState.data && (
                 <ApartarStockModal
                    open={true}
                    onClose={handleCloseModal}
                    material={modalState.data.material}
                    filterOptions={filterOptions}
                    onSubmit={handleApartar}
                    isSubmitting={isSubmittingAction}
                 />
            )}
            {modalState.type === 'mover' && modalState.data && (
                 <MoverAsignacionModal
                    open={true}
                    onClose={handleCloseModal}
                    material={modalState.data.material}
                    filterOptions={filterOptions}
                    getDetalleAsignaciones={getDetalleAsignaciones}
                    asignaciones={modalState.data.asignaciones} // Pasa las asignaciones cargadas
                    onSubmit={handleMover}
                    isSubmitting={isSubmittingAction}
                 />
            )}
        </Box>
    );
}