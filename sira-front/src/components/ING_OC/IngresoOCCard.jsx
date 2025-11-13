// sira-front/src/components/ING_OC/IngresoOCCard.jsx
import React from 'react';
import { Paper, Typography, Box, Button, Divider, Chip, Stack, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import { alpha, useTheme } from '@mui/material/styles';
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
    const theme = useTheme();

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
    const subtleBorder = alpha(theme.palette.primary.main, 0.12);
    const badgeBg = alpha(theme.palette.primary.main, 0.08);

    return (
        <motion.div variants={cardVariants}>
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden',
                    border: `1px solid ${subtleBorder}`,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: `0 16px 36px ${alpha(theme.palette.primary.main, 0.08)}`,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: `0 22px 48px ${alpha(theme.palette.primary.main, 0.15)}`,
                    },
                }}
            >
                {/* Encabezado */}
                <Box
                    sx={{
                        p: 3,
                        backgroundImage: `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 60%, ${theme.palette.background.paper} 100%)`,
                    }}
                >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                            <Chip
                                size="small"
                                label={oc.numero_oc}
                                sx={{
                                    mb: 1,
                                    fontWeight: 600,
                                    letterSpacing: 0.4,
                                    backgroundColor: badgeBg,
                                    borderRadius: 1.5,
                                }}
                            />
                            <Typography variant="h6" fontWeight={700} lineHeight={1.2} color="text.primary">
                                {oc.proveedor_marca}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {oc.proveedor_razon_social}
                            </Typography>
                        </Box>
                        {/* Indicadores de estado */}
                        <Stack direction="column" spacing={0.75} alignItems="flex-end">
                            {oc.entrega_parcial && (
                                <Tooltip title="Entrega parcial pendiente" arrow>
                                    <Chip
                                        icon={<RuleFolderIcon fontSize="small" />}
                                        size="small"
                                        label="Parcial"
                                        sx={{ backgroundColor: alpha(theme.palette.warning.main, 0.12), color: theme.palette.warning.dark }}
                                    />
                                </Tooltip>
                            )}
                            {oc.con_incidencia && (
                                <Tooltip title="Incidencia reportada" arrow>
                                    <Chip
                                        icon={<ReportProblemIcon fontSize="small" />}
                                        size="small"
                                        label="Incidencia"
                                        sx={{ backgroundColor: alpha(theme.palette.error.main, 0.12), color: theme.palette.error.dark }}
                                    />
                                </Tooltip>
                            )}
                        </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                        <Chip
                            size="small"
                            icon={metodoEntregaIcon}
                            label={metodoEntregaTexto}
                            sx={{
                                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                color: theme.palette.primary.darker ?? theme.palette.primary.main,
                            }}
                        />
                        <Chip
                            size="small"
                            icon={<WorkspacesIcon fontSize="small" />}
                            label={oc.proyecto_nombre}
                            color="primary"
                            variant="outlined"
                        />
                        <Chip
                            size="small"
                            icon={<PlaceIcon fontSize="small" />}
                            label={oc.sitio_nombre}
                            variant="outlined"
                        />
                    </Stack>
                </Box>
                <Divider sx={{ borderColor: alpha(theme.palette.primary.main, 0.08) }} />
                {/* Footer con acción */}
                <Box sx={{ p: 3, mt: 'auto' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<InputIcon />}
                        onClick={onGestionarIngreso}
                        sx={{
                            py: 1.2,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            boxShadow: 'none',
                            backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${theme.palette.primary.main} 100%)`,
                            '&:hover': {
                                boxShadow: `0 14px 30px ${alpha(theme.palette.primary.main, 0.28)}`,
                                backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark || theme.palette.primary.main, 0.95)} 100%)`,
                            },
                        }}
                    >
                        Gestionar Ingreso
                    </Button>
                </Box>
            </Paper>
        </motion.div>
    );
}