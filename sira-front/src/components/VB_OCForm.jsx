// C:\SIRA\sira-front\src\components\VB_OCForm.jsx
/**
 * =================================================================================================
 * VB_OCForm.jsx — Formulario de Creación Directa de OC (3 pasos)
 * =================================================================================================
 * Paso 1: Datos Generales (sitio, proyecto, fecha, lugar entrega, comentario)
 * Paso 2: Materiales + Proveedores + Precios
 * Paso 3: Resumen financiero por proveedor + Generar OC
 * =================================================================================================
 */
import React, { useState } from 'react';
import {
  Stepper, Step, StepLabel, Button, Box, Typography, Paper, CircularProgress,
  Divider, List, ListItem, ListItemText, Alert, IconButton, Tooltip,
  Checkbox, FormControlLabel, TextField
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import SendIcon from '@mui/icons-material/Send';
import FullScreenLoader from './ui/FullScreenLoader';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { toast } from 'react-toastify';
import api from '../api/api';
import useVbOcForm from '../hooks/useVbOcForm';
import FilaMaterialOC from './VB_OC/FilaMaterialOC';
import ConfigPopover from './rfq/ConfigPopover';

const steps = ['Datos Generales', 'Materiales y Precios', 'Resumen y Confirmar'];

const inputStyle = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-300";
const ALMACEN_ID = '21';

export default function VB_OCForm() {
  const {
    control, register, errors, watch, setValue, handleSubmit,
    fields, addItem, removeItem,
    sitios, sitiosUnidades, proyectosFiltrados, lugarEntregaOptions,
    isLoading, isSubmitting,
    activeStep, handleNext, handleBack,
    resumenPorProveedor, providerConfigs, setProviderConfigs, defaultConfig,
    onSubmit,
  } = useVbOcForm();

  // Estado para ConfigPopover
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentProviderId, setCurrentProviderId] = useState(null);

  // Estado de éxito
  const [ocsCreadas, setOcsCreadas] = useState(null);

  const handleConfigClick = (event, providerId) => {
    setCurrentProviderId(providerId);
    setAnchorEl(event.currentTarget);
  };

  const handleConfigClose = () => {
    setAnchorEl(null);
    setCurrentProviderId(null);
  };

  const setConfigForProvider = (valueOrFunction) => {
    if (!currentProviderId) return;
    setProviderConfigs(prev => {
      const prevConfig = prev[currentProviderId] || defaultConfig;
      const newConfig = typeof valueOrFunction === 'function' ? valueOrFunction(prevConfig) : valueOrFunction;
      return { ...prev, [currentProviderId]: newConfig };
    });
  };

  const handleSitioChange = (e) => {
    const val = e.target.value;
    setValue('sitio_id', val);
    setValue('proyecto_id', '');
    // Si el sitio es almacén, setear lugar entrega a almacén
    setValue('lugar_entrega', ALMACEN_ID);
  };

  const handleProyectoChange = (e) => {
    setValue('proyecto_id', e.target.value);
  };

  const doSubmit = async (formData) => {
    try {
      const result = await onSubmit(formData);
      if (result?.ocs) {
        setOcsCreadas(result.ocs);
        for (const oc of result.ocs) {
          try {
            toast.info(`Preparando descarga de ${oc.numero_oc}...`);
            const resp = await api.get(`/api/ocs/${oc.id}/pdf`, { responseType: 'blob' });
            const blob = resp.data;
            const cd = resp.headers?.get?.('content-disposition') ?? '';
            const match = cd.match(/filename="(.+?)"/i);
            const filename = match?.[1] || `${oc.numero_oc}.pdf`;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`${oc.numero_oc} descargada.`);
          } catch {
            toast.error(`No se pudo descargar el PDF de ${oc.numero_oc}.`);
          }
        }
      }
    } catch {
      // Error ya manejado por el hook con toast
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Cargando formulario...</Typography>
      </Box>
    );
  }

  // Si ya se crearon OCs, mostrar pantalla de éxito
  if (ocsCreadas) {
    return (
      <Paper sx={{ p: 4, mt: 2, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          ¡Orden(es) de Compra creada(s) exitosamente!
        </Typography>
        <Box sx={{ my: 3 }}>
          {ocsCreadas.map(oc => (
            <Typography key={oc.id} variant="h6" color="primary">
              {oc.numero_oc}
            </Typography>
          ))}
        </Box>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Las OCs han sido enviadas para autorización y los PDF se generaron automáticamente.
        </Typography>
        <Button
          variant="contained"
          sx={{ mt: 3 }}
          onClick={() => window.location.reload()}
        >
          Crear otra OC
        </Button>
      </Paper>
    );
  }

  return (
    <>
      <FullScreenLoader isOpen={isSubmitting} message="Generando Orden de Compra, por favor espera..." />
      <form onSubmit={handleSubmit(doSubmit)}>
        {/* Stepper Header */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ===================== PASO 1: Datos Generales ===================== */}
        {activeStep === 0 && (
          <Paper sx={{ p: 3 }} className="bg-white rounded-xl shadow-lg">
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, pb: 1, borderBottom: '2px solid #e5e7eb' }}>
              Datos Generales
            </Typography>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Sitio */}
              <div>
                <label htmlFor="sitio_id" className="block text-sm font-medium text-gray-700">Sitio</label>
                <select
                  id="sitio_id"
                  {...register('sitio_id', { required: 'Selecciona un sitio' })}
                  className={inputStyle}
                  onChange={handleSitioChange}
                >
                  <option value="">Selecciona un sitio...</option>
                  {sitios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  {sitiosUnidades.map(s => (
                    <option key={s.id} value="" disabled>{s.nombre} — gestionar desde la página Unidades</option>
                  ))}
                </select>
                {errors.sitio_id && <span className="text-red-600 text-xs mt-1">{errors.sitio_id.message}</span>}
                {sitiosUnidades.length > 0 && (
                  <p className="text-xs text-blue-500 mt-1">
                    ℹ️ Las requisiciones de servicio y refacciones para <strong>Unidades</strong> deben gestionarse desde la{' '}
                    <a href="/unidades" className="underline font-medium hover:text-blue-700">página Unidades</a>.
                  </p>
                )}
              </div>

              {/* Proyecto */}
              <div>
                <label htmlFor="proyecto_id" className="block text-sm font-medium text-gray-700">Proyecto</label>
                <select
                  id="proyecto_id"
                  {...register('proyecto_id', { required: 'Selecciona un proyecto' })}
                  className={inputStyle}
                  onChange={handleProyectoChange}
                >
                  <option value="">Selecciona un proyecto...</option>
                  {proyectosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                {errors.proyecto_id && <span className="text-red-600 text-xs mt-1">{errors.proyecto_id.message}</span>}
              </div>

              {/* Fecha Requerida */}
              <div>
                <label htmlFor="fecha_requerida" className="block text-sm font-medium text-gray-700">Fecha Requerida</label>
                <input
                  id="fecha_requerida"
                  type="date"
                  {...register('fecha_requerida', { required: 'La fecha es obligatoria' })}
                  className={inputStyle}
                />
                {errors.fecha_requerida && <span className="text-red-600 text-xs mt-1">{errors.fecha_requerida.message}</span>}
              </div>

              {/* Lugar Entrega */}
              <div>
                <label htmlFor="lugar_entrega" className="block text-sm font-medium text-gray-700">Lugar de Entrega</label>
                <select
                  id="lugar_entrega"
                  {...register('lugar_entrega', { required: 'Selecciona el lugar' })}
                  className={inputStyle}
                >
                  <option value="">Selecciona el lugar...</option>
                  {lugarEntregaOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.nombre}</option>)}
                </select>
                {errors.lugar_entrega && <span className="text-red-600 text-xs mt-1">{errors.lugar_entrega.message}</span>}
              </div>

              {/* Comentario */}
              <div className="md:col-span-2">
                <label htmlFor="comentario" className="block text-sm font-medium text-gray-700">
                  Comentario General (Opcional)
                </label>
                <input
                  id="comentario"
                  placeholder="Instrucciones especiales..."
                  {...register('comentario')}
                  className={inputStyle}
                  autoComplete="off"
                />
              </div>

              {/* Urgente */}
              <div className="md:col-span-2">
                <FormControlLabel
                  control={
                    <Checkbox
                      {...register('es_urgente')}
                      checked={watch('es_urgente')}
                      onChange={(e) => setValue('es_urgente', e.target.checked)}
                    />
                  }
                  label="🔴 Marcar como URGENTE"
                />
              </div>

              {/* Comentarios Finanzas */}
              <div className="md:col-span-2">
                <label htmlFor="comentarios_finanzas" className="block text-sm font-medium text-gray-700">
                  Comentarios para Finanzas (Opcional)
                </label>
                <input
                  id="comentarios_finanzas"
                  placeholder="Notas adicionales para el área de finanzas..."
                  {...register('comentarios_finanzas')}
                  className={inputStyle}
                  autoComplete="off"
                />
              </div>
            </div>
          </Paper>
        )}

        {/* ===================== PASO 2: Materiales + Precios ===================== */}
        {activeStep === 1 && (
          <Paper sx={{ p: 3 }} className="bg-white rounded-xl shadow-lg">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 1, borderBottom: '2px solid #e5e7eb' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Materiales y Precios
              </Typography>
              <Button
                onClick={addItem}
                startIcon={<AddCircleOutlineIcon />}
                variant="contained"
                size="small"
              >
                Agregar Material
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Para cada material, selecciona el material del catálogo, indica la cantidad, asigna un proveedor e ingresa el precio unitario.
            </Typography>

            {fields.map((field, index) => (
              <FilaMaterialOC
                key={field.id}
                index={index}
                control={control}
                setValue={setValue}
                remove={removeItem}
                totalFields={fields.length}
              />
            ))}
          </Paper>
        )}

        {/* ===================== PASO 3: Resumen ===================== */}
        {activeStep === 2 && (
          <Paper sx={{ p: 3 }} className="bg-white rounded-xl shadow-lg">
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, pb: 1, borderBottom: '2px solid #e5e7eb' }}>
              Resumen de Compra
            </Typography>

            {resumenPorProveedor.length === 0 ? (
              <Alert severity="warning">
                No hay materiales válidos para generar la OC. Regresa al paso anterior y completa todos los campos.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {resumenPorProveedor.map((bloque, idx) => (
                  <Paper key={`${bloque.proveedorId}-${idx}`} variant="outlined" sx={{ p: 2 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {bloque.proveedorNombre}
                        {bloque.proveedorMarca && bloque.proveedorMarca !== bloque.proveedorNombre && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({bloque.proveedorMarca})
                          </Typography>
                        )}
                      </Typography>
                      <Tooltip title="Configurar cálculo (IVA, ISR, Moneda)">
                        <IconButton onClick={e => handleConfigClick(e, bloque.proveedorId)} size="small">
                          <SettingsIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Items */}
                    <List dense sx={{ p: 0 }}>
                      {bloque.items.map((item, i) => (
                        <ListItem key={i} disableGutters sx={{ p: 0 }}>
                          <ListItemText
                            primary={`${item.cantidad} ${item.unidad} de ${item.material}`}
                            secondary={`@ $${item.precioUnitario.toFixed(4)} c/u`}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            ${item.itemSubtotal.toFixed(2)}
                          </Typography>
                        </ListItem>
                      ))}
                    </List>

                    <Divider sx={{ my: 1 }} />

                    {bloque.esCompraImportacion && (
                      <Alert severity="info" sx={{ mb: 1 }}>Compra de Importación.</Alert>
                    )}

                    {/* Totales */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Sub Total:</Typography>
                      <Typography variant="body2">${bloque.subTotal.toFixed(2)}</Typography>
                    </Box>
                    {bloque.iva > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">IVA ({Math.round(100 * parseFloat(bloque.config.ivaRate))}%):</Typography>
                        <Typography variant="body2">${bloque.iva.toFixed(2)}</Typography>
                      </Box>
                    )}
                    {bloque.retIsr > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'error.main' }}>
                        <Typography variant="body2">Ret. ISR (-):</Typography>
                        <Typography variant="body2">-${bloque.retIsr.toFixed(2)}</Typography>
                      </Box>
                    )}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        Total ({bloque.config?.moneda || 'MXN'}):
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        ${bloque.total.toFixed(2)}
                      </Typography>
                    </Box>
                    {bloque.config?.isForcedTotalActive && (
                      <Alert severity="warning" sx={{ mt: 1 }}>¡Total Forzado!</Alert>
                    )}
                  </Paper>
                ))}
              </Box>
            )}
          </Paper>
        )}

        {/* ===================== Navigation buttons ===================== */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, gap: 2 }}>
          <Button
            onClick={handleBack}
            disabled={activeStep === 0}
            startIcon={<NavigateBeforeIcon />}
            variant="outlined"
          >
            Anterior
          </Button>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {activeStep < 2 && (
              <Button
                onClick={handleNext}
                endIcon={<NavigateNextIcon />}
                variant="contained"
              >
                Siguiente
              </Button>
            )}

            {activeStep === 2 && (
              <Button
                type="submit"
                variant="contained"
                color="success"
                endIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                disabled={isSubmitting || resumenPorProveedor.length === 0}
                size="large"
              >
                {isSubmitting ? 'Generando OC...' : 'Generar Orden de Compra'}
              </Button>
            )}
          </Box>
        </Box>

        {/* Config Popover */}
        <ConfigPopover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleConfigClose}
          config={providerConfigs[currentProviderId] || defaultConfig}
          setConfig={setConfigForProvider}
        />
      </form>
    </>
  );
}
