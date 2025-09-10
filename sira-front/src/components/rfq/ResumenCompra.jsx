// C:\SIRA\sira-front\src\components\rfq\ResumenCompra.jsx
/**
 * =================================================================================================
 * COMPONENTE: ResumenCompra
 * =================================================================================================
 * @file ResumenCompra.jsx
 * @description Muestra resúmenes de compra detallados y separados por proveedor.
 * Cada resumen tiene su propio engrane de configuración para moneda e impuestos
 * y muestra la lista de materiales seleccionados para ese proveedor.
 */

// --- Importaciones ---
import React, { useMemo, useState } from 'react';
import { Paper, Typography, Box, Alert, IconButton, Tooltip, List, ListItem, ListItemText } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ConfigPopover from './ConfigPopover';

// ===============================================================================================
// --- Lógica de Cálculo Principal (Helper Function) ---
// ===============================================================================================
/**
 * @description Calcula los resúmenes de compra basándose en los materiales seleccionados
 * y las configuraciones específicas de cada proveedor.
 * @param {Array} materiales - El array de materiales del formulario.
 * @param {object} providerConfigs - El objeto con las configuraciones por proveedor.
 * @returns {Array} - Un arreglo con los objetos de resumen calculados.
 */
const calcularResumenes = (materiales, providerConfigs) => {
  if (!materiales || materiales.length === 0) return [];

  const agrupado = {};
  materiales.forEach(material => {
    material.opciones?.forEach(opcion => {
      if (opcion && opcion.seleccionado && opcion.proveedor?.id && Number(opcion.cantidad_cotizada) > 0) {
        const proveedorId = opcion.proveedor.id;
        if (!agrupado[proveedorId]) {
          agrupado[proveedorId] = {
            proveedorId,
            proveedorNombre: opcion.proveedor.razon_social || opcion.proveedor.nombre,
            items: [],
          };
        }
        agrupado[proveedorId].items.push({
          material: material.material, unidad: material.unidad,
          cantidad: Number(opcion.cantidad_cotizada) || 0,
          precioUnitario: Number(opcion.precio_unitario) || 0,
          esPrecioNeto: opcion.es_precio_neto, esImportacionItem: opcion.es_importacion,
        });
      }
    });
  });

  return Object.values(agrupado).map(grupo => {
    // --- MEJORA: Se añade 'moneda' a la configuración por defecto ---
    const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };
    const config = providerConfigs[grupo.proveedorId] || defaultConfig;
    
    const ivaRateNum = parseFloat(config.ivaRate) || 0;
    const isrRateNum = parseFloat(config.isrRate) || 0;
    const forcedTotalNum = parseFloat(config.forcedTotal) || 0;
    const esCompraImportacion = grupo.items.some(item => item.esImportacionItem);

    let subTotal = 0;
    const itemsConSubtotal = grupo.items.map(item => {
        let precioBase = item.precioUnitario;
        if (item.esPrecioNeto && config.isIvaActive && ivaRateNum > 0) {
            precioBase = item.precioUnitario / (1 + ivaRateNum);
        }
        const itemSubtotal = item.cantidad * precioBase;
        subTotal += itemSubtotal;
        return { ...item, itemSubtotal };
    });

    const iva = (esCompraImportacion || !config.isIvaActive) ? 0 : subTotal * ivaRateNum;
    const retIsr = (esCompraImportacion || !config.isIsrActive) ? 0 : subTotal * isrRateNum;
    let total = config.isForcedTotalActive ? forcedTotalNum : subTotal + iva - retIsr;

    return { ...grupo, subTotal, iva, retIsr, total, esCompraImportacion, config, items: itemsConSubtotal };
  });
};


// ===============================================================================================
// --- Componente Principal: ResumenCompra ---
// ===============================================================================================
export default function ResumenCompra({ materiales, lugar_entrega, providerConfigs, setProviderConfigs , onFilesChange, archivosPorProveedor}) {
  // --- Estados ---
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentProviderId, setCurrentProviderId] = useState(null);

  // --- Manejadores de Eventos ---
  const handleConfigClick = (event, providerId) => {
    setCurrentProviderId(providerId);
    setAnchorEl(event.currentTarget);
  };

  const handleConfigClose = () => {
    setAnchorEl(null);
    setCurrentProviderId(null);
  };
// --- MANEJADOR DE ARCHIVOS: Validaciones ---
  const handleFileChange = (e, proveedorId) => {
    const nuevosArchivos = Array.from(e.target.files);
    const archivosExistentes = archivosPorProveedor[proveedorId] || [];

    
    if (archivosExistentes.length + nuevosArchivos.length > 3) {
      toast.warn("Puedes subir un máximo de 3 archivos por proveedor.");
      return;
    }
    for (const file of nuevosArchivos) {
      if (file.size > 50 * 1024 * 1024) { // 50 MB
        toast.warn(`El archivo "${file.name}" es demasiado grande (Máx. 50MB).`);
        return;
      }
    }

    const listaFinal = [...archivosExistentes, ...nuevosArchivos];
    onFilesChange(proveedorId, listaFinal);
  };
  
  const handleRemoveFile = (proveedorId, fileName) => {
    const archivosActuales = archivosPorProveedor[proveedorId] || [];
    const listaFinal = archivosActuales.filter(f => f.name !== fileName);
    onFilesChange(proveedorId, listaFinal);
  };
//fin manejador de archivos
  
  // --- MEJORA: Se añade 'moneda' a la configuración por defecto ---
  const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };

  const setConfigForProvider = (valueOrFunction) => {
    if (!currentProviderId) return;
    setProviderConfigs(prevConfigs => {
        const prevConfigForProvider = prevConfigs[currentProviderId] || defaultConfig;
        const newConfig = typeof valueOrFunction === 'function' ? valueOrFunction(prevConfigForProvider) : valueOrFunction;
        return { ...prevConfigs, [currentProviderId]: newConfig };
    });
  };

  const isConfigOpen = Boolean(anchorEl);

  // --- Memorización de Cálculos ---
  const resumenesPorProveedor = useMemo(
    () => calcularResumenes(materiales, providerConfigs),
    // Usar JSON.stringify es una forma eficaz de detectar cambios profundos en los objetos.
    [JSON.stringify(materiales), providerConfigs]
  );

  // --- Renderizado ---
  return (
    <Box className="space-y-4">
      <Typography variant="caption" display="block">
        <strong>Se entrega en:</strong> {lugar_entrega}
      </Typography>

      {resumenesPorProveedor.length > 0 ? (
        resumenesPorProveedor.map((resumen) => (
          <Paper key={resumen.proveedorId} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 'bold' }}>
                {resumen.proveedorNombre}
              </Typography>
              <Tooltip title={`Configurar cálculo para ${resumen.proveedorNombre}`}>
                <IconButton onClick={(e) => handleConfigClick(e, resumen.proveedorId)} size="small">
                  <SettingsIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>

            <List dense sx={{ width: '100%', bgcolor: 'background.paper', p: 0 }}>
              {resumen.items.map((item, idx) => (
                <ListItem key={idx} disableGutters sx={{ p: 0 }}>
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
            
            <hr className="my-2" />
             <Box>
              <Button
                variant="outlined"
                size="small"
                component="label"
                startIcon={<AttachFileIcon />}
                disabled={archivos.length >= 3}
              >
                Adjuntar Cotización
                <input type="file" multiple hidden onChange={(e) => handleFileChange(e, resumen.proveedorId)} />
              </Button>
              <Typography variant="caption" display="block" sx={{mt: 1}}>Máx. 3 archivos, 50MB c/u.</Typography>
              
              {archivos.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {archivos.map((file, index) => (
                    <Chip key={index} label={file.name} size="small" onDelete={() => handleRemoveFile(resumen.proveedorId, file.name)} />
                  ))}
                </Box>
              )}
            </Box>
            {resumen.esCompraImportacion && <Alert severity="info" sx={{ mb: 1 }}>Compra de Importación.</Alert>}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Sub Total:</Typography>
              <Typography variant="body2">${resumen.subTotal.toFixed(2)}</Typography>
            </Box>
            {resumen.iva > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">IVA ({ (parseFloat(resumen.config.ivaRate) * 100).toFixed(0) }%):</Typography>
                <Typography variant="body2">${resumen.iva.toFixed(2)}</Typography>
              </Box>
            )}
            {resumen.retIsr > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'error.main' }}>
                <Typography variant="body2">Ret. ISR (-):</Typography>
                <Typography variant="body2">-${resumen.retIsr.toFixed(2)}</Typography>
              </Box>
            )}

            <hr className="my-2" />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              {/* --- MEJORA: Se muestra la moneda junto al Total --- */}
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total ({resumen.config.moneda}):</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${resumen.total.toFixed(2)}</Typography>
            </Box>

            {resumen.config.isForcedTotalActive && <Alert severity="warning" sx={{ mt: 1 }}>¡Total Forzado!</Alert>}
          </Paper>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary">
          Selecciona un proveedor y marca "Elegir" para ver el resumen.
        </Typography>
      )}

      <ConfigPopover 
        open={isConfigOpen}
        anchorEl={anchorEl}
        onClose={handleConfigClose}
        config={providerConfigs[currentProviderId] || defaultConfig}
        setConfig={setConfigForProvider}
      />
    </Box>
  );
}