// sira-front/src/components/PICK_IN/PICK_INForm.jsx
import React, { useState } from 'react';
import { Box, Tabs, Tab, Paper, CircularProgress } from '@mui/material';
import { useRetiro } from '../../hooks/useRetiro';
import RetiroAsignado from './RetiroAsignado'; // Crearemos este
import RetiroStock from './RetiroStock';     // Crearemos este
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import InventoryIcon from '@mui/icons-material/Inventory';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PICK_INForm() {
    const [tabValue, setTabValue] = useState(0);
    const retiroHookData = useRetiro(); // Usamos el hook aquí

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    if (retiroHookData.loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    }

    return (
        <Paper elevation={3} sx={{ margin: { xs: 1, sm: 2, md: 3 } }}>
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