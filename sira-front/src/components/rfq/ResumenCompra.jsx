// C:\SIRA\sira-front\src\components\rfq\ResumenCompra.jsx
/**
 * =================================================================================================
 * COMPONENTE: ResumenCompra (v2.2 - Corrección Typo)
 * =================================================================================================
 * @file ResumenCompra.jsx
 * @description Muestra el resumen de compra agrupado por proveedor y por estado (bloqueado/libre).
 * - Maneja estados separados para archivos nuevos (subidos) y existentes (desde BD).
 */

import React, { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip, List, ListItem, ListItemText,
  Button, Divider, Alert, Chip, Link
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ConfigPopover from './ConfigPopover';
import { toast } from 'react-toastify';

// Lógica de cálculo (sin cambios)
function calcularBloquesResumenes(materiales, providerConfigs = {}, opcionesBloqueadas = []) {
  if (!materiales || materiales.length === 0) return [];
  const bloques = [];

  materiales.forEach(material => {
    material.opciones?.forEach(opcion => {
      // Usar id_bd para bloquear, pero id (de RHF) para la opción
      const opcionId = opcion.id_bd || opcion.id;
      if (!opcion || !opcion.proveedor?.id || Number(opcion.cantidad_cotizada) <= 0 || !opcion.seleccionado) return;

      // Bloquear si el ID de la BD está en la lista de bloqueadas
      const isBlocked = (opcionesBloqueadas || []).map(Number).includes(Number(opcion.id_bd));
      const proveedorId = opcion.proveedor.id;

      let bloque = bloques.find(b => b.proveedorId === proveedorId && b.isBlocked === isBlocked);
      if (!bloque) {
        bloque = {
          proveedorId,
          proveedorNombre: opcion.proveedor.razon_social || opcion.proveedor.nombre,
          proveedorMarca: opcion.proveedor.nombre || '',
          isBlocked,
          items: [],
          opcionesIds: [], // Rastreador de IDs de opciones de BD
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
      // Solo guardar el ID de BD si existe
      if (opcion.id_bd) {
        bloque.opcionesIds.push(opcion.id_bd);
      }
    });
  });

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
  archivosNuevosPorProveedor = {},
  archivosExistentesPorProveedor = {},
  onFileChange,
  onRemoveNewFile,
  onRemoveExistingFile,
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

  // --- AGRUPADO DE BLOQUES (proveedor/estado) ---
  const bloquesResumenes = useMemo(
    () => calcularBloquesResumenes(materiales, providerConfigs, opcionesBloqueadas),
    [JSON.stringify(materiales), providerConfigs, opcionesBloqueadas] // Corregido en v1.3
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
          const archivosNuevos = archivosNuevosPorProveedor[bloque.proveedorId] || [];
          const archivosExistentes = archivosExistentesPorProveedor[bloque.proveedorId] || [];
          const totalArchivos = archivosNuevos.length + archivosExistentes.length;

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
              {isLocked && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Esta OC ya fue generada y no puede ser modificada.
                </Alert>
              )}

              {/* Header: Proveedor y marca (sin cambios) */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Tooltip
                  title={bloque.proveedorMarca ? (<span><strong>Marca:</strong> {bloque.proveedorMarca}</span>) : ""}
                  arrow
                  placement="top"
                >
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 'bold' }}>
                      {bloque.proveedorNombre}
                    </Typography>
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

              {/* Lista de materiales y totales (sin cambios) */}
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
              {bloque.esCompraImportacion && <Alert severity="info" sx={{ mb: 1 }}>Compra de Importación.</Alert>}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Sub Total:</Typography>
                {/* ================================================================== */}
                {/* --- CORRECCIÓN DE TYPO --- */}
                <Typography variant="body2">${bloque.subTotal.toFixed(2)}</Typography>
                {/* ================================================================== */}
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

              {/* Lógica de adjuntar archivos (sin cambios) */}
              {!isLocked && (
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    component="label"
                    startIcon={<AttachFileIcon />}
                    disabled={totalArchivos >= 3}
                    onChange={e => onFileChange(e, bloque.proveedorId)}
                  >
                    Adjuntar Cotización
                    <input type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.xml" />
                  </Button>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Máx. 3 archivos, 50MB c/u. ({totalArchivos} / 3)
                  </Typography>

                  {totalArchivos > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {/* 1. Renderizar archivos EXISTENTES */}
                      {archivosExistentes.map((file) => (
                        <Chip
                          key={file.id}
                          label={file.name}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          component={Link}
                          href={file.ruta_archivo}
                          target="_blank"
                          clickable
                          onDelete={() => onRemoveExistingFile(bloque.proveedorId, file.id)}
                        />
                      ))}
                      {/* 2. Renderizar archivos NUEVOS */}
                      {archivosNuevos.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.name}
                          size="small"
                          color="primary"
                          onDelete={() => onRemoveNewFile(bloque.proveedorId, file.name)}
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