// sira-front/src/components/REC_OC/RecoleccionOCCard.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box, Button, Divider, Chip, Stack, Select, MenuItem, TextField, FormControl, InputLabel, RadioGroup, FormControlLabel, Radio, FormLabel, Collapse, IconButton, Tooltip, Link } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MopedIcon from '@mui/icons-material/Moped';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import CommentIcon from '@mui/icons-material/Comment';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function RecoleccionOCCard({ oc, onProcesar }) {
  const [step, setStep] = useState(1);
  const [metodo, setMetodo] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [formData, setFormData] = useState({
    metodoRecoleccionId: '',
    paqueteriaId: '',
    numeroGuia: '',
    evidencias: [],
    comentarioRecoleccion: '',
    paqueteriaPago: 'PAGADA',
    entregaResponsable: 'EQUIPO_RECOLECCION', // Valor por defecto
  });
  
  const handleMetodoSelect = (metodoId, tipo) => {
    setMetodo(tipo);
    setFormData(prev => ({ ...prev, metodoRecoleccionId: metodoId }));
    setStep(2);
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFormData(prev => ({ ...prev, evidencias: [...e.target.files] }));
    }
  };

  const handleSubmit = async () => {
    if (metodo === 'paqueteria' && (!formData.paqueteriaId || !formData.numeroGuia)) {
        alert('Para paquetería, la empresa y el número de guía son obligatorios.');
        return;
    }
    
    const finalFormData = {
        ...formData,
        notificarRecoleccion: metodo === 'local' && formData.entregaResponsable === 'EQUIPO_RECOLECCION',
        notificarProveedor: true, // Siempre se notifica en el paso 3
    };
    
    await onProcesar(oc.id, finalFormData);
  };
  
  return (
    <motion.div variants={cardVariants}>
      <Paper elevation={4} sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Encabezado (sin cambios) */}
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
          {/* PASO 1: MÉTODO DE ENTREGA */}
          {step === 1 && (
            <Stack spacing={2} justifyContent="center" sx={{height: '100%'}}>
              <Typography variant="subtitle2" align="center" color="text.secondary">PASO 1: Método de Entrega</Typography>
              <Button variant="contained" startIcon={<MopedIcon />} onClick={() => handleMetodoSelect(1, 'local')}>Recolección Local</Button>
              <Button variant="outlined" startIcon={<LocalShippingIcon />} onClick={() => handleMetodoSelect(2, 'paqueteria')}>Paquetería</Button>
            </Stack>
          )}

          {/* PASO 2: COMPLETAR INFORMACIÓN */}
          {step === 2 && (
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">PASO 2: Completar Información</Typography>
              
              {/* Lógica para Recolección Local */}
              {metodo === 'local' && (
                  <FormControl>
                      <FormLabel>Responsable de la entrega</FormLabel>
                      <RadioGroup row value={formData.entregaResponsable} onChange={(e) => setFormData(prev => ({...prev, entregaResponsable: e.target.value}))}>
                          <FormControlLabel value="EQUIPO_RECOLECCION" control={<Radio />} label="Equipo de Recolección" />
                          <FormControlLabel value="PROVEEDOR" control={<Radio />} label="Proveedor Entrega" />
                      </RadioGroup>
                  </FormControl>
              )}

              {/* Lógica para Paquetería */}
              {metodo === 'paqueteria' && (
                <Stack spacing={2}>
                  <FormControl fullWidth size="small"><InputLabel>Paquetería</InputLabel>
                    <Select value={formData.paqueteriaId} label="Paquetería" onChange={(e) => setFormData(prev => ({ ...prev, paqueteriaId: e.target.value }))}>
                      <MenuItem value={1}>DHL</MenuItem><MenuItem value={2}>Estafeta</MenuItem><MenuItem value={3}>FedEx</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField fullWidth size="small" label="Número de Guía" value={formData.numeroGuia} onChange={(e) => setFormData(prev => ({ ...prev, numeroGuia: e.target.value }))} />
                  <Button component="label" variant="text" size="small" startIcon={<UploadFileIcon />}>Cargar Evidencia(s) ({formData.evidencias.length})
                    <input type="file" hidden multiple onChange={handleFileChange} />
                  </Button>
                </Stack>
              )}

              {/* Comentarios con animación */}
              <Link component="button" variant="body2" onClick={() => setShowComments(!showComments)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CommentIcon fontSize="small"/> Añadir Comentario
              </Link>
              <Collapse in={showComments}>
                <TextField label="Comentarios Adicionales" multiline rows={2} fullWidth value={formData.comentarioRecoleccion} onChange={(e) => setFormData(prev => ({...prev, comentarioRecoleccion: e.target.value}))}/>
              </Collapse>
            </Stack>
          )}

          {/* PASO 3: NOTIFICAR AL PROVEEDOR */}
          {step === 3 && (
            <Stack spacing={2} justifyContent="center" sx={{height: '100%'}}>
                <Typography variant="subtitle2" color="text.secondary" align="center">PASO 3: Notificar al Proveedor</Typography>
                <Typography variant="body2" align="center">
                    {formData.entregaResponsable === 'EQUIPO_RECOLECCION' 
                    ? 'Se notificará al proveedor que programe la recolección con nuestro equipo.' 
                    : 'Se notificará al proveedor para que proceda con la entrega del material.'}
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                    <Tooltip title="Notificar por WhatsApp (Simulado)"><IconButton color="success"><WhatsAppIcon/></IconButton></Tooltip>
                    <Tooltip title="Notificar por Correo (Simulado)"><IconButton color="primary"><EmailIcon/></IconButton></Tooltip>
                </Stack>
            </Stack>
          )}
        </Box>

        {/* FOOTER DE ACCIONES */}
        <Box sx={{ p: 2, mt: 'auto' }}>
            {step > 1 && (
                 <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                    <Button size="small" onClick={() => setStep(step - 1)}>Atrás</Button>
                    {metodo === 'local' && formData.entregaResponsable === 'EQUIPO_RECOLECCION' && step === 2 && (
                        <Tooltip title="Avisar al equipo de recolección (Simulado)">
                            <IconButton color="primary"><WhatsAppIcon /></IconButton>
                        </Tooltip>
                    )}
                    {step === 2 && (
                        <Button variant="contained" size="small" endIcon={<ArrowForwardIcon/>} onClick={() => setStep(3)}>Siguiente</Button>
                    )}
                    {step === 3 && (
                        <Button variant="contained" color="primary" endIcon={<CheckCircleIcon />} onClick={handleSubmit}>Pasar a "En Proceso"</Button>
                    )}
                 </Stack>
            )}
        </Box>
      </Paper>
    </motion.div>
  );
}