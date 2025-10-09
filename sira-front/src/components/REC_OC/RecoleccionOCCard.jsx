// sira-front/src/components/REC_OC/RecoleccionOCCard.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box, Button, Divider, Chip, Stack, Select, MenuItem, TextField, FormControl, InputLabel, RadioGroup, FormControlLabel, Radio, FormLabel } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MopedIcon from '@mui/icons-material/Moped';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function RecoleccionOCCard({ oc, onProcesar }) {
  const [step, setStep] = useState(1);
  const [metodo, setMetodo] = useState('');
  const [formData, setFormData] = useState({
    metodoRecoleccionId: '', paqueteriaId: '', numeroGuia: '',
    evidencias: [], comentarioRecoleccion: '', notificarProveedor: true,
    paqueteriaPago: 'PAGADA', // <<< NUEVO CAMPO
  });
  
  const handleMetodoSelect = (metodoId, tipo) => {
    setMetodo(tipo);
    setFormData(prev => ({ ...prev, metodoRecoleccionId: metodoId }));
    setStep(2);
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFormData(prev => ({ ...prev, evidencias: [...prev.evidencias, ...Array.from(e.target.files)] }));
    }
  };

  const handleSubmit = async () => {
    if (metodo === 'paqueteria' && (!formData.paqueteriaId || !formData.numeroGuia)) {
        alert('Debes seleccionar una paquetería y añadir un número de guía.');
        return;
    }
    
    // Añadir el comentario sobre el tipo de servicio al comentario general
    const comentarioServicio = formData.paqueteriaServicio === 'OCURRE' ? 'Servicio OCURRE. ' : '';
    const finalFormData = {
        ...formData,
        notificarRecoleccion: metodo === 'local',
        comentarioRecoleccion: `${comentarioServicio}${formData.comentarioRecoleccion}`.trim()
    };
    
    await onProcesar(oc.id, finalFormData);
  };
  
  return (
    <motion.div variants={cardVariants}>
      <Paper elevation={4} sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* --- MODIFICADO: Encabezado con MARCA y Razón Social --- */}
        <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">{oc.numero_oc}</Typography>
            <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>{oc.proveedor_marca}</Typography>
            <Typography variant="body2" color="text.secondary">{oc.proveedor_razon_social}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" icon={<WorkspacesIcon />} label={oc.proyecto_nombre} color="primary" />
            <Chip size="small" icon={<PlaceIcon />} label={oc.sitio_nombre} />
          </Stack>
        </Box>
        <Divider />

        <Box sx={{ p: 2, flexGrow: 1 }}>
          {step === 1 && (
            <Stack spacing={2} justifyContent="center" sx={{height: '100%'}}>
              <Typography variant="subtitle2" align="center">PASO 1: Método de Entrega</Typography>
              <Button variant="contained" startIcon={<MopedIcon />} onClick={() => handleMetodoSelect(1, 'local')}>Recolección Local</Button>
              <Button variant="outlined" startIcon={<LocalShippingIcon />} onClick={() => handleMetodoSelect(2, 'paqueteria')}>Paquetería</Button>
            </Stack>
          )}

          {step === 2 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{mb: 2}}>PASO 2: Completar Información</Typography>
              {metodo === 'paqueteria' && (
                <Stack spacing={2}>
                  <FormControl fullWidth><InputLabel>Paquetería</InputLabel>
                    <Select value={formData.paqueteriaId} label="Paquetería" onChange={(e) => setFormData(prev => ({ ...prev, paqueteriaId: e.target.value }))}>
                      <MenuItem value={1}>DHL</MenuItem><MenuItem value={2}>Estafeta</MenuItem><MenuItem value={3}>FedEx</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField fullWidth label="Número de Guía" value={formData.numeroGuia} onChange={(e) => setFormData(prev => ({ ...prev, numeroGuia: e.target.value }))} />
                  
                  {/* --- AÑADIDOS: Selectores de Paquetería --- */}
                  <FormControl><FormLabel>Condiciones de Envío</FormLabel>
                    <RadioGroup row value={formData.paqueteriaPago} onChange={(e) => setFormData(prev => ({...prev, paqueteriaPago: e.target.value}))}>
                      <FormControlLabel value="PAGADA" control={<Radio />} label="Pagada" />
                      <FormControlLabel value="POR_COBRAR" control={<Radio />} label="Por Cobrar" />
                    </RadioGroup>
                  </FormControl>
                  <FormControl><FormLabel>Tipo de Servicio</FormLabel>
                    <RadioGroup row value={formData.paqueteriaServicio} onChange={(e) => setFormData(prev => ({...prev, paqueteriaServicio: e.target.value}))}>
                      <FormControlLabel value="DOMICILIO" control={<Radio />} label="A Domicilio" />
                      <FormControlLabel value="OCURRE" control={<Radio />} label="Ocurre" />
                    </RadioGroup>
                  </FormControl>
                </Stack>
              )}
              <Stack spacing={1} sx={{mt: 2}}>
                <Button component="label" variant="text" size="small" startIcon={<UploadFileIcon />}>Cargar Evidencia(s)
                    <input type="file" hidden multiple onChange={handleFileChange} />
                </Button>
                {formData.evidencias.length > 0 && <Typography variant="caption" align="center">{formData.evidencias.length} archivo(s) seleccionados.</Typography>}
                <TextField label="Comentarios Adicionales" multiline rows={2} fullWidth value={formData.comentarioRecoleccion} onChange={(e) => setFormData(prev => ({...prev, comentarioRecoleccion: e.target.value}))}/>
              </Stack>
            </Box>
          )}
        </Box>

        <Box sx={{ p: 2, mt: 'auto' }}>
            {step > 1 && (
                 <Stack direction="row" spacing={1} justifyContent="space-between">
                    <Button size="small" onClick={() => setStep(1)}>Atrás</Button>
                    <Button variant="contained" color="primary" endIcon={<CheckCircleIcon />} onClick={handleSubmit}>Pasar a "En Proceso"</Button>
                 </Stack>
            )}
        </Box>
      </Paper>
    </motion.div>
  );
}