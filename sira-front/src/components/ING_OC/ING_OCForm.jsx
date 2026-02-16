// sira-front/src/components/ING_OC/ING_OCForm.jsx
import React, { useMemo, useState } from 'react';
import { useIngresoOC } from '../../hooks/useIngresoOC';
import { Grid, CircularProgress, Typography, Box, Paper, Tooltip, Stack, Divider } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import IngresoOCCard from './IngresoOCCard';
import IngresoOCModal from './IngresoOCModal';
import FiltrosIngresoOC from './FiltrosIngresoOC'; // Componente de filtros específico
import KPICard from '../REC_OC/KPICard'; // Reutilizamos el KPICard de REC_OC
import { useOcPreview } from '../../hooks/useOcPreview';
import OCInfoModal from '../common/OCInfoModal';

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

    const theme = useTheme();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedOc, setSelectedOc] = useState(null); // OC completa para el modal de ingreso
    const [detallesOc, setDetallesOc] = useState([]); // Detalles para el modal de ingreso
    const [loadingModal, setLoadingModal] = useState(false);

    // --- Hook de Preview (sustituye infoDialog manual) ---
    const {
        previewOpen, previewOc: infoOc, previewItems: infoItems, previewMetadata: infoMetadata, loading: infoLoading,
        openPreview, closePreview
    } = useOcPreview();

    const [activeKpi, setActiveKpi] = useState(null);

    const handleOpenModal = (oc) => {
        setSelectedOc(oc);
        setLoadingModal(true);
        setModalOpen(true);

        getDetallesOC(oc.id)
            .then((detalles) => {
                setDetallesOc(detalles);
            })
            .catch(() => {
                setDetallesOc([]);
            })
            .finally(() => {
                setLoadingModal(false);
            });
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

    const handleKpiClick = (filterCriteria, key) => {
        if (activeKpi === key) {
            setActiveKpi(null);
            resetFilters();
            return;
        }

        setActiveKpi(key);

        if (!filterCriteria || Object.keys(filterCriteria).length === 0) {
            resetFilters();
            return;
        }

        setFilters(prev => {
            const cleared = Object.keys(prev).reduce((acc, filterKey) => ({
                ...acc,
                [filterKey]: '',
            }), {});
            return { ...cleared, ...filterCriteria };
        });
    };

    const kpiCards = useMemo(() => ([
        {
            key: 'total',
            title: 'Total Proceso',
            value: kpis.total_en_proceso || 0,
            icon: <InventoryIcon sx={{ fontSize: 28 }} />,
            tooltip: 'Total OCs EN PROCESO',
            filter: {},
            color: '#1A73E8',
        },
        {
            key: 'proveedorEntrega',
            title: 'Proveedor Entrega',
            value: kpis.kpi_proveedor_entrega || 0,
            icon: <PersonPinIcon sx={{ fontSize: 28 }} />,
            tooltip: 'Proveedor entrega directamente',
            filter: { metodo_recoleccion_id: 1, entrega_responsable: 'PROVEEDOR' },
            color: '#6C63FF',
        },
        {
            key: 'paqueteria',
            title: 'Paquetería',
            value: kpis.kpi_paqueteria || 0,
            icon: <LocalShippingIcon sx={{ fontSize: 28 }} />,
            tooltip: 'Envío por paquetería',
            filter: { metodo_recoleccion_id: 2 },
            color: '#00A7E1',
        },
        {
            key: 'equipoRecoleccion',
            title: 'Equipo Recoge',
            value: kpis.kpi_equipo_recoleccion || 0,
            icon: <MopedIcon sx={{ fontSize: 28 }} />,
            tooltip: 'Equipo interno recoge',
            filter: { metodo_recoleccion_id: 1, entrega_responsable: 'EQUIPO_RECOLECCION' },
            color: '#2BB673',
        },
        {
            key: 'parciales',
            title: 'Parciales',
            value: kpis.kpi_parciales || 0,
            icon: <RuleFolderIcon sx={{ fontSize: 28 }} />,
            tooltip: 'OCs con entregas parciales pendientes',
            filter: { entrega_parcial: true },
            color: '#FFA000',
        },
        {
            key: 'incidencia',
            title: 'Incidencias',
            value: kpis.kpi_con_incidencia || 0,
            icon: <ReportProblemIcon sx={{ fontSize: 28 }} />,
            tooltip: 'OCs con incidencias reportadas',
            filter: { con_incidencia: true },
            color: '#E53935',
        },
    ]), [kpis]);


    return (
        <Box
            sx={{
                p: { xs: 1.5, sm: 3 },
                background: alpha(theme.palette.primary.main, 0.02),
                minHeight: '100%',
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    mb: 4,
                    p: { xs: 2, md: 3 },
                    borderRadius: 4,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${theme.palette.background.paper} 60%)`,
                    boxShadow: `0 18px 40px ${alpha(theme.palette.primary.main, 0.08)}`,
                }}
            >
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h5" fontWeight={700} gutterBottom>
                            Estado del Ingreso de Órdenes de Compra
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Visualiza rápidamente el estado de las OCs y aplica filtros inteligentes con un solo clic.
                        </Typography>
                    </Box>
                    <Divider sx={{ borderColor: alpha(theme.palette.primary.main, 0.08) }} />
                    <Grid container spacing={2.5}>
                        {kpiCards.map((card) => (
                            <Grid key={card.key} item xs={12} sm={6} md={4} lg={2}>
                                <Tooltip title={card.tooltip} placement="top" arrow>
                                    <Box>
                                        <KPICard
                                            title={card.title}
                                            value={card.value}
                                            icon={card.icon}
                                            color={card.color}
                                            onClick={() => handleKpiClick(card.filter, card.key)}
                                            active={activeKpi === card.key}
                                        />
                                    </Box>
                                </Tooltip>
                            </Grid>
                        ))}
                    </Grid>
                </Stack>
            </Paper>

            {/* Filtros */}
            <FiltrosIngresoOC
                filterOptions={filterOptions}
                filters={filters}
                onFilterChange={setFilters} // Pasa la función para actualizar filtros
                onReset={resetFilters}
            />

            {/* Lista de OCs */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
                    <CircularProgress size={48} />
                </Box>
            ) : (
                <Grid container spacing={3.5}>
                    {ocsEnProceso.length > 0 ? (
                        ocsEnProceso.map((oc) => (
                            <Grid item xs={12} md={6} lg={4} key={oc.id}>
                                <IngresoOCCard
                                    oc={oc}
                                    onGestionarIngreso={() => handleOpenModal(oc)}
                                    onPreview={() => openPreview(oc)}
                                />
                            </Grid>
                        ))
                    ) : (
                        <Grid item xs={12}>
                            <Paper
                                elevation={0}
                                sx={{
                                    textAlign: 'center',
                                    py: 6,
                                    borderRadius: 4,
                                    border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.03),
                                }}
                            >
                                <Typography variant="h6" gutterBottom>
                                    No hay órdenes que coincidan con los filtros actuales
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Ajusta los filtros o selecciona otro KPI para seguir trabajando.
                                </Typography>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            )}

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

            {/* Modal de Información de OC */}
            {infoOc && (
                <OCInfoModal
                    open={previewOpen}
                    onClose={closePreview}
                    oc={infoOc}
                    items={infoItems}
                    metadata={infoMetadata}
                    loading={infoLoading}
                />
            )}
        </Box>
    );
}
