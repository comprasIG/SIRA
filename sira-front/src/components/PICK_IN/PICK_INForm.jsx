// sira-front/src/components/PICK_IN/PICK_INForm.jsx
import React, { useState } from 'react';
import { Box, Tabs, Tab, Paper, CircularProgress } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useRetiro } from '../../hooks/useRetiro';
import RetiroAsignado from './RetiroAsignado';
import RetiroStock from './RetiroStock';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import InventoryIcon from '@mui/icons-material/Inventory';

/**
 * TabPanel
 *
 * Componente auxiliar para renderizar el contenido de cada pestaña del
 * formulario de retiro de stock. Sólo muestra el contenido de la pestaña
 * activa.
 */
function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

/**
 * PICK_INForm
 *
 * Formulario principal para la funcionalidad de retiro de materiales. Se
 * compone de dos pestañas: retiro de material asignado y retiro de stock
 * general. Este componente se ha actualizado para tener una apariencia
 * consistente con el resto de la aplicación, utilizando un contenedor
 * `Paper` sin elevación, bordes redondeados y un fondo degradado. Además,
 * se añade padding interno para que el contenido respire mejor.
 */
export default function PICK_INForm() {
    const theme = useTheme();
    const [tabValue, setTabValue] = useState(0);
    const retiroHookData = useRetiro(); // Carga de datos y funciones del hook

    const handleTabChange = (_event, newValue) => {
        setTabValue(newValue);
    };

    if (retiroHookData.loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper
            elevation={0}
            sx={{
                m: { xs: 1, sm: 2, md: 3 },
                p: { xs: 2, md: 3 },
                borderRadius: 4,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 60%)`,
                boxShadow: `0 12px 26px ${alpha(theme.palette.primary.main, 0.08)}`,
            }}
        >
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
                    <Tab icon={<AssignmentIndIcon />} iconPosition="start" label="Retirar Material Asignado" />
                    <Tab icon={<InventoryIcon />} iconPosition="start" label="Retirar de Stock General" />
                </Tabs>
            </Box>
            <TabPanel value={tabValue} index={0}>
                {/* Pasamos los datos y funciones del hook al componente hijo */}
                <RetiroAsignado {...retiroHookData} />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
                {/* Pasamos los datos y funciones del hook al componente hijo */}
                <RetiroStock {...retiroHookData} />
            </TabPanel>
        </Paper>
    );
}