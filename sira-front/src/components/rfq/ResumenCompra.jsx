/**
 * =================================================================================================
 * COMPONENTE: ResumenCompra (agrupa por proveedor Y por estado, OC bloqueada vs pendiente)
 * =================================================================================================
 * @file ResumenCompra.jsx
 * @description Muestra el resumen de compra agrupado por proveedor y por estado (bloqueado/libre).
 * - Si un proveedor tiene opciones bloqueadas y otras libres, salen como bloques distintos.
 * - Solo los bloques bloqueados (con OC generada) aparecen inhabilitados, grises y con banner.
 * @author: gus + ChatGPT, 2025-09-14
 */

import React, { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip, List, ListItem, ListItemText,
  Button, Divider, Alert, Chip
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ConfigPopover from './ConfigPopover';
import { toast } from 'react-toastify';

// =================================================================================================
// LÓGICA DE AGRUPADO Y CÁLCULO DE BLOQUES POR PROVEEDOR/ESTADO
// =================================================================================================
/**
 * @function calcularBloquesResumenes
 * Agrupa opciones por proveedor Y por estado (bloqueado/libre).
 * Si un proveedor tiene opciones bloqueadas y otras libres, salen como bloques distintos.
 * @param {array} materiales - array de materiales (cada uno con opciones)
 * @param {object} providerConfigs - configuración por proveedor
 * @param {array} opcionesBloqueadas - ids de opciones bloqueadas (por OC generada)
 * @returns {array} bloques de resumen agrupados por proveedor y estado
 */
function calcularBloquesResumenes(materiales, providerConfigs = {}, opcionesBloqueadas = []) {
  if (!materiales || materiales.length === 0) return [];
  const bloques = [];

  materiales.forEach(material => {
    material.opciones?.forEach(opcion => {
      // Solo agrega si está seleccionada y tiene proveedor y cantidad
      if (!opcion || !opcion.proveedor?.id || Number(opcion.cantidad_cotizada) <= 0 || !opcion.seleccionado) return;

     const isBlocked = (opcionesBloqueadas || []).map(Number).includes(Number(opcion.id));
      const proveedorId = opcion.proveedor.id;

      // El bloque es único por proveedor + estado bloqueado/libre
      let bloque = bloques.find(b =>
        b.proveedorId === proveedorId &&
        b.isBlocked === isBlocked
      );
      if (!bloque) {
        bloque = {
          proveedorId,
          proveedorNombre: opcion.proveedor.razon_social || opcion.proveedor.nombre,
          proveedorMarca: opcion.proveedor.nombre || '',
          isBlocked,
          items: [],
          opcionesIds: [],
        };
        bloques.push(bloque);
      }
      bloque.items.push({
        material: material.material,
        unidad: material.unidad,
        cantidad: Number(opcion.cantidad_cotizada) || 0,
        precioUnitario: Number(opcion.precio_unitario) || 0,
        esPrecioNeto: opcion.es_precio_neto,
        esImportacionItem: opcion.es_importacion,
        proveedorMarca: opcion.proveedor.nombre || '',
      });
      bloque.opcionesIds.push(opcion.id);
    });
  });
console.log("DEBUG | opcionesBloqueadas:", opcionesBloqueadas);
console.log("DEBUG | bloques:", bloques);


  // Calcula totales y config para cada bloque
  return bloques.map(bloque => {
    const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };
    const config = providerConfigs[bloque.proveedorId] || defaultConfig;
    const ivaRateNum = parseFloat(config.ivaRate) || 0;
    const isrRateNum = parseFloat(config.isrRate) || 0;
    const forcedTotalNum = parseFloat(config.forcedTotal) || 0;
    const esCompraImportacion = bloque.items.some(item => item.esImportacionItem);

    let subTotal = 0;
    const itemsConSubtotal = bloque.items.map(item => {
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
    return { ...bloque, subTotal, iva, retIsr, total, esCompraImportacion, config, items: itemsConSubtotal };
  });
}

// =================================================================================================
// COMPONENTE PRINCIPAL
// =================================================================================================
export default function ResumenCompra({
  materiales,
  lugar_entrega,
  providerConfigs = {},
  setProviderConfigs,
  onFilesChange,
  archivosPorProveedor = {},
  opcionesBloqueadas = [],
}) {
  // Estado del popup de configuración
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentProviderId, setCurrentProviderId] = useState(null);

  // --- POPUP DE CONFIGURACIÓN ---
  const handleConfigClick = (event, providerId) => {
    setCurrentProviderId(providerId);
    setAnchorEl(event.currentTarget);
  };
  const handleConfigClose = () => {
    setAnchorEl(null);
    setCurrentProviderId(null);
  };

  // --- CONFIGURACIÓN POR PROVEEDOR ---
  const defaultConfig = { moneda: 'MXN', ivaRate: '0.16', isIvaActive: true, isrRate: '0.0125', isIsrActive: false, forcedTotal: '0', isForcedTotalActive: false };
  const setConfigForProvider = (valueOrFunction) => {
    if (!currentProviderId) return;
    setProviderConfigs(prevConfigs => {
      const prevConfigForProvider = prevConfigs[currentProviderId] || defaultConfig;
      const newConfig = typeof valueOrFunction === 'function' ? valueOrFunction(prevConfigForProvider) : valueOrFunction;
      return { ...prevConfigs, [currentProviderId]: newConfig };
    });
  };

  // --- MANEJO DE ARCHIVOS ---
  const handleFileChange = (e, proveedorId) => {
    const nuevosArchivos = Array.from(e.target.files);
    const archivosExistentes = archivosPorProveedor[proveedorId] || [];
    if (archivosExistentes.length + nuevosArchivos.length > 3) {
      toast.warn("Puedes subir un máximo de 3 archivos por proveedor.");
      return;
    }
    for (const file of nuevosArchivos) {
      if (file.size > 50 * 1024 * 1024) {
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

  // --- AGRUPADO DE BLOQUES (proveedor/estado) ---
  const bloquesResumenes = useMemo(
    () => calcularBloquesResumenes(materiales, providerConfigs, opcionesBloqueadas),
    [JSON.stringify(materiales), providerConfigs, opcionesBloqueadas]
  );

  // =============================================================================================
  // RENDER UI
  // =============================================================================================
  return (
    <Box className="space-y-4">
      {/* Lugar de entrega */}
      <Typography variant="caption" display="block" sx={{ mb: 1 }}>
        <strong>Se entrega en:</strong> {lugar_entrega}
      </Typography>

      {/* Si no hay líneas */}
      {bloquesResumenes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Selecciona un proveedor y marca "Elegir" para ver el resumen.
        </Typography>
      ) : (
        bloquesResumenes.map((bloque, idx) => {
          const isLocked = bloque.isBlocked;
          const archivos = archivosPorProveedor[bloque.proveedorId] || [];

          return (
            <Paper
            key={`${bloque.proveedorId}-${isLocked ? 'bloqueado' : 'pendiente'}-${idx}`}

              variant="outlined"
              sx={{
                p: 2,
                opacity: isLocked ? 0.7 : 1,
                background: isLocked ? 'rgba(210,210,210,0.13)' : '#fff',
                border: isLocked ? '2px solid #90a4ae' : '1px solid #e0e0e0',
                mb: 2,
                position: 'relative'
              }}
            >
              {/* Banner solo si bloqueada (OC generada) */}
              {isLocked && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Esta OC ya fue generada y no puede ser modificada. <br />
                 
                </Alert>
              )}

              {/* Header: Proveedor y marca */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Tooltip
                  title={bloque.proveedorMarca ? (<span><strong>Marca:</strong> {bloque.proveedorMarca}</span>) : ""}
                  arrow
                  placement="top"
                >
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'color 0.2s, border-bottom 0.2s',
                    
                      color: bloque.proveedorMarca ? '#1976d2' : 'inherit',
                      cursor: bloque.proveedorMarca ? 'pointer' : 'default',
                      '&:hover': {
                        color: bloque.proveedorMarca ? '#1565c0' : 'inherit',
                        borderBottom: bloque.proveedorMarca ? '2px solid #1565c0' : 'none',
                      }
                    }}
                  >
                    <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 'bold' }}>
                      {bloque.proveedorNombre}
                    </Typography>
                    {bloque.proveedorMarca && (
                      <Box component="span" sx={{ ml: 1, fontSize: 18, color: '#1976d2' }}></Box>
                    )}
                  </Box>
                </Tooltip>
                <Tooltip title={`Configurar cálculo para ${bloque.proveedorNombre}`}>
                  <span>
                    <IconButton
                      onClick={e => handleConfigClick(e, bloque.proveedorId)}
                      size="small"
                      disabled={isLocked}
                    >
                      <SettingsIcon fontSize="inherit" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* Lista de materiales en el bloque */}
              <List dense sx={{ p: 0 }}>
                {bloque.items.map((item, idx) => (
                  <ListItem key={idx} disableGutters sx={{ p: 0 }}>
                    <ListItemText
                      primary={`${item.cantidad} ${item.unidad} de ${item.material}`}
                      secondary={`@ $${item.precioUnitario.toFixed(4)} c/u`}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>${item.itemSubtotal.toFixed(2)}</Typography>
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ my: 1 }} />

              {/* IVA / ISR / Totales */}
              {bloque.esCompraImportacion && <Alert severity="info" sx={{ mb: 1 }}>Compra de Importación.</Alert>}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total ({bloque.config.moneda}):</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${bloque.total.toFixed(2)}</Typography>
              </Box>
              {bloque.config.isForcedTotalActive && <Alert severity="warning" sx={{ mt: 1 }}>¡Total Forzado!</Alert>}
              <Divider sx={{ my: 2 }} />

              {/* Adjuntar cotización solo si NO está bloqueado */}
              {!isLocked && (
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    component="label"
                    startIcon={<AttachFileIcon />}
                    disabled={archivos.length >= 3}
                  >
                    Adjuntar Cotización
                    <input type="file" multiple hidden onChange={e => handleFileChange(e, bloque.proveedorId)} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.xml" />
                  </Button>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Máx. 3 archivos, 50MB c/u.
                  </Typography>
                  {archivos.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {archivos.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.name}
                          size="small"
                          onDelete={() => handleRemoveFile(bloque.proveedorId, file.name)}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
          );
        })
      )}

      {/* Configuración de cálculo por proveedor */}
      <ConfigPopover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleConfigClose}
        config={providerConfigs[currentProviderId] || defaultConfig}
        setConfig={setConfigForProvider}
      />
    </Box>
  );
}
