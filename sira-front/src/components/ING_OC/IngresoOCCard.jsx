// sira-front/src/components/ING_OC/IngresoOCCard.jsx
import React from 'react';
import { Paper, Typography, Box, Button, Divider, Chip, Stack, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import PlaceIcon from '@mui/icons-material/Place';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MopedIcon from '@mui/icons-material/Moped';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import RuleFolderIcon from '@mui/icons-material/RuleFolder';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import InputIcon from '@mui/icons-material/Input';

const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function IngresoOCCard({ oc, onGestionarIngreso }) {

    // Determina el icono y texto del método de entrega
    let metodoEntregaIcon = null;
    let metodoEntregaTexto = oc.metodo_recoleccion_nombre || 'No especificado';
    if (oc.metodo_recoleccion_id === 1) { // Local
        if (oc.entrega_responsable === 'PROVEEDOR') {
            metodoEntregaIcon = <PersonPinIcon fontSize="small" />;
            metodoEntregaTexto = 'Proveedor Entrega';
        } else {
            metodoEntregaIcon = <MopedIcon fontSize="small" />;
            metodoEntregaTexto = 'Equipo Recoge';
        }
    } else if (oc.metodo_recoleccion_id === 2) { // Paquetería
        metodoEntregaIcon = <LocalShippingIcon fontSize="small" />;
        metodoEntregaTexto = 'Paquetería';
    }

    return (
        <motion.div variants={cardVariants}>
            <Paper elevation={3} sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Encabezado */}
                <Box sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                            <Typography variant="caption" color="text.secondary">{oc.numero_oc}</Typography>
                            <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>{oc.proveedor_marca}</Typography>
                            <Typography variant="body2" color="text.secondary">{oc.proveedor_razon_social}</Typography>
                        </Box>
                        {/* Indicadores de estado */}
                        <Stack direction="column" spacing={0.5} alignItems="flex-end">
                            {oc.entrega_parcial && (
                                <Tooltip title="Entrega Parcial pendiente"><Chip icon={<RuleFolderIcon />} size="small" color="warning" label="Parcial" /></Tooltip>
                            )}
                             {oc.con_incidencia && (
                                <Tooltip title="Incidencia Reportada"><Chip icon={<ReportProblemIcon />} size="small" color="error" label="Incidencia" /></Tooltip>
                            )}
                        </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                         <Chip size="small" icon={metodoEntregaIcon} label={metodoEntregaTexto} variant="outlined" />
                         <Chip size="small" icon={<WorkspacesIcon />} label={oc.proyecto_nombre} color="primary" />
                         <Chip size="small" icon={<PlaceIcon />} label={oc.sitio_nombre} />
                    </Stack>
                </Box>
                <Divider />
                {/* Footer con acción */}
                <Box sx={{ p: 2, mt: 'auto', textAlign: 'right' }}>
                    <Button
                        variant="contained"
                        startIcon={<InputIcon />}
                        onClick={onGestionarIngreso}
                    >
                        Gestionar Ingreso
                    </Button>
                </Box>
            </Paper>
        </motion.div>
    );
}