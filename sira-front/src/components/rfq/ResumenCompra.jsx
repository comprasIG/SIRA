// C:\SIRA\sira-front\src\components\rfq\ResumenCompra.jsx
/**
 * Componente: ResumenCompra
 * Propósito:
 * Muestra resúmenes de compra detallados y separados por proveedor. Cada resumen
 * ahora tiene su propio engrane de configuración y muestra la lista de materiales.
 */
import React, { useMemo, useState } from 'react';
import { Paper, Typography, Box, Alert, IconButton, Tooltip, List, ListItem, ListItemText } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ConfigPopover from './ConfigPopover';

// --- Lógica de Cálculo Principal ---
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
          material: material.material,
          unidad: material.unidad,
          cantidad: Number(opcion.cantidad_cotizada) || 0,
          precioUnitario: Number(opcion.precio_unitario) || 0,
          esPrecioNeto: opcion.es_precio_neto,
          esImportacionItem: opcion.es_importacion,
        });
      }
    });
  });

  return Object.values(agrupado).map(grupo => {
    const defaultConfig = { ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };
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
    
    let total = subTotal + iva - retIsr;

    if (config.isForcedTotalActive) {
      total = forcedTotalNum;
    }

    return {
      proveedorId: grupo.proveedorId,
      proveedorNombre: grupo.proveedorNombre,
      subTotal,
      iva,
      retIsr,
      total,
      esCompraImportacion,
      config,
      items: itemsConSubtotal,
    };
  });
};

export default function ResumenCompra({ materiales, lugar_entrega, providerConfigs, setProviderConfigs }) {
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
  
  const defaultConfig = { ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };

  // CAMBIO: Esta función ahora puede manejar tanto un objeto directo como una función de actualización (la "receta").
  const setConfigForProvider = (valueOrFunction) => {
    if (!currentProviderId) return; // Salvaguarda
    
    setProviderConfigs(prevConfigs => {
        // Obtenemos la configuración anterior para este proveedor específico.
        const prevConfigForProvider = prevConfigs[currentProviderId] || defaultConfig;
        
        // Determinamos la nueva configuración.
        const newConfig = typeof valueOrFunction === 'function'
            ? valueOrFunction(prevConfigForProvider) // Si es una función, la ejecutamos.
            : valueOrFunction;                     // Si es un objeto, lo usamos directamente.

        // Devolvemos el estado de todas las configuraciones, con la de este proveedor actualizada.
        return {
          ...prevConfigs,
          [currentProviderId]: newConfig
        };
    });
  };


  const isConfigOpen = Boolean(anchorEl);

  // --- Memorización ---
  const resumenesPorProveedor = useMemo(
    () => calcularResumenes(materiales, providerConfigs),
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
                    primaryTypographyProps={{ fontSize: '0.875rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    ${item.itemSubtotal.toFixed(2)}
                  </Typography>
                </ListItem>
              ))}
            </List>
            
            <hr className="my-2 border-t border-gray-200" />
            
            {resumen.esCompraImportacion && (
              <Alert severity="info" sx={{ mb: 1, fontSize: '0.8rem', p: '0 8px' }}>Compra de Importación (Impuestos omitidos).</Alert>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <Typography variant="body2">Sub Total:</Typography>
              <Typography variant="body2">${resumen.subTotal.toFixed(2)}</Typography>
            </Box>

            {resumen.iva > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <Typography variant="body2">IVA ({ (parseFloat(resumen.config.ivaRate) * 100).toFixed(0) }%):</Typography>
                <Typography variant="body2">${resumen.iva.toFixed(2)}</Typography>
              </Box>
            )}

            {resumen.retIsr > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'error.main' }}>
                <Typography variant="body2">Ret. ISR (-):</Typography>
                <Typography variant="body2">-${resumen.retIsr.toFixed(2)}</Typography>
              </Box>
            )}

            <hr className="my-2 border-t border-gray-200" />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem' }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${resumen.total.toFixed(2)}</Typography>
            </Box>

            {resumen.config.isForcedTotalActive && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: '0.8rem', p: '0 8px' }}>¡Total Forzado Manualmente!</Alert>
            )}
          </Paper>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Selecciona un proveedor y marca la casilla "Elegir" para ver el resumen.
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