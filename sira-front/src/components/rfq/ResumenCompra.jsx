// C:\SIRA\sira-front\src\components\rfq\ResumenCompra.jsx
/**
 * =================================================================================================
 * COMPONENTE: ResumenCompra
 * VERSIÓN REESCRITA: 3.1 (Corrección de 'defaultConfig' y Lógica de Bloqueo)
 * =================================================================================================
 * @file ResumenCompra.jsx
 * @description Muestra el resumen de compra agrupado por proveedor.
 * - Separa visualmente los resúmenes en "Pendientes de OC" y "Bloqueados (OC ya generada)".
 * - Maneja estados separados para archivos nuevos (subidos) y existentes (desde BD).
 * - Permite la configuración de cálculo (IVA, ISR, Moneda) por proveedor.
 */

// --- SECCIÓN 1: IMPORTACIONES ---
import React, { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip, List, ListItem, ListItemText,
  Button, Divider, Alert, Chip, Link
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ConfigPopover from './ConfigPopover';
import { toast } from 'react-toastify';

// =================================================================
// --- ¡CORRECCIÓN DEL BUG 'ReferenceError'! ---
// Se define 'defaultConfig' aquí, en el ámbito superior del módulo,
// para que sea accesible por todas las funciones que lo necesitan.
// =================================================================
const defaultConfig = {
  moneda: 'MXN',
  ivaRate: '0.16',
  isIvaActive: true,
  isrRate: '0.0125',
  isIsrActive: false,
  forcedTotal: '0',
  isForcedTotalActive: false
};
// =================================================================

// =================================================================================================
// --- SECCIÓN 2: LÓGICA DE CÁLCULO (HELPER) ---
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

      // =================================================================
      // --- ¡CORRECCIÓN DEL BUG DE BLOQUEO! ---
      // Comparamos usando 'opcion.id_bd' (el ID de la Base de Datos)
      // en lugar de 'opcion.id' (el ID de React Hook Form).
      // =================================================================
      const isBlocked = (opcionesBloqueadas || []).map(Number).includes(Number(opcion.id_bd));
      // =================================================================

      const proveedorId = opcion.proveedor.id;

      // El bloque es único por proveedor + estado (bloqueado/libre)
      let bloque = bloques.find(b =>
        b.proveedorId === proveedorId &&
        b.isBlocked === isBlocked
      );

      // Si no existe un bloque para este (Proveedor + Estado), lo creamos
      if (!bloque) {
        bloque = {
          proveedorId,
          proveedorNombre: opcion.proveedor.razon_social || opcion.proveedor.nombre,
          proveedorMarca: opcion.proveedor.nombre || '',
          isBlocked, // <-- El estado de bloqueo se asigna al bloque
          items: [],
          opcionesIds: [],
        };
        bloques.push(bloque);
      }

      // Añadimos el item al bloque
      bloque.items.push({
        material: material.material,
        unidad: material.unidad,
        cantidad: Number(opcion.cantidad_cotizada) || 0,
        precioUnitario: Number(opcion.precio_unitario) || 0,
        esPrecioNeto: opcion.es_precio_neto,
        esImportacionItem: opcion.es_importacion,
        proveedorMarca: opcion.proveedor.nombre || '',
      });

      // =================================================================
      // --- ¡CORRECCIÓN DEL BUG DE BLOQUEO! ---
      // También usamos 'opcion.id_bd' aquí.
      // =================================================================
      if (opcion.id_bd) {
        bloque.opcionesIds.push(opcion.id_bd);
      }
    });
  });

  // Calcula los totales financieros para cada bloque
  return bloques.map(bloque => {
    // Ahora 'defaultConfig' es la constante global del módulo
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

    // Descuento global
    let descuento = 0;
    if (config.isDiscountActive) {
      const discountVal = parseFloat(config.discountValue) || 0;
      if (config.discountType === 'porcentaje') {
        descuento = subTotal * (discountVal / 100);
      } else {
        descuento = discountVal;
      }
    }

    let total = config.isForcedTotalActive ? forcedTotalNum : subTotal + iva - retIsr - descuento;

    return { ...bloque, subTotal, iva, retIsr, descuento, total, esCompraImportacion, config, items: itemsConSubtotal };
  });
}

// =================================================================================================
// --- SECCIÓN 3: COMPONENTE PRINCIPAL ---
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

  // --- SECCIÓN 3.1: ESTADO Y HOOKS ---
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentProviderId, setCurrentProviderId] = useState(null);

  /**
   * @memo {bloquesResumenes}
   * Calcula los bloques de resumen y se actualiza solo si los datos cambian.
   * [JSON.stringify] es una dependencia clave para forzar el recálculo
   * cuando los valores *dentro* del array de materiales cambian.
   */
  const bloquesResumenes = useMemo(
    () => calcularBloquesResumenes(materiales, providerConfigs, opcionesBloqueadas),
    [JSON.stringify(materiales), providerConfigs, opcionesBloqueadas]
  );

  // --- SECCIÓN 3.2: MANEJADORES DE EVENTOS (POPOVER) ---

  const handleConfigClick = (event, providerId) => {
    setCurrentProviderId(providerId);
    setAnchorEl(event.currentTarget);
  };

  const handleConfigClose = () => {
    setAnchorEl(null);
    setCurrentProviderId(null);
  };

  /**
   * @handler
   * Actualiza el estado de la configuración para un proveedor específico.
   */
  const setConfigForProvider = (valueOrFunction) => {
    if (!currentProviderId) return;
    setProviderConfigs(prevConfigs => {
      // Ahora 'defaultConfig' es la constante global del módulo
      const prevConfigForProvider = prevConfigs[currentProviderId] || defaultConfig;
      const newConfig = typeof valueOrFunction === 'function' ? valueOrFunction(prevConfigForProvider) : valueOrFunction;
      return { ...prevConfigs, [currentProviderId]: newConfig };
    });
  };

  // =============================================================================================
  // --- SECCIÓN 3.3: RENDERIZADO DEL COMPONENTE ---
  // =============================================================================================
  return (
    <Box className="space-y-4">
      <Typography variant="caption" display="block" sx={{ mb: 1 }}>
        <strong>Se entrega en:</strong> {lugar_entrega}
      </Typography>

      {/* --- A: Estado Vacío --- */}
      {bloquesResumenes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Selecciona un proveedor y marca "Elegir" para ver el resumen.
        </Typography>
      ) : (

        // --- B: Iteración de Bloques de Resumen ---
        bloquesResumenes.map((bloque, idx) => {
          const isLocked = bloque.isBlocked; // <-- La lógica de bloqueo viene de la función helper
          const archivosNuevos = archivosNuevosPorProveedor[bloque.proveedorId] || [];
          const archivosExistentes = archivosExistentesPorProveedor[bloque.proveedorId] || [];
          const totalArchivos = archivosNuevos.length + archivosExistentes.length;

          return (
            <Paper
              key={`${bloque.proveedorId}-${isLocked ? 'bloqueado' : 'pendiente'}-${idx}`}
              variant="outlined"
              sx={{
                p: 2,
                opacity: isLocked ? 0.7 : 1, // <-- Se atenúa si está bloqueado
                background: isLocked ? 'rgba(210,210,210,0.13)' : '#fff', // <-- Fondo gris si está bloqueado
                border: isLocked ? '2px solid #90a4ae' : '1px solid #e0e0e0',
                mb: 2,
                position: 'relative'
              }}
            >
              {/* --- B.1: Alerta de Bloqueo (Solo si 'isLocked' es true) --- */}
              {isLocked && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Esta OC ya fue generada y no puede ser modificada.
                </Alert>
              )}

              {/* --- B.2: Encabezado del Bloque (Proveedor y Config) --- */}
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
                      disabled={isLocked} // <-- Botón deshabilitado si está bloqueado
                    >
                      <SettingsIcon fontSize="inherit" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* --- B.3: Lista de Items y Totales (Finanzas) --- */}
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
              {bloque.descuento > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'success.main' }}>
                  <Typography variant="body2">
                    Descuento {bloque.config.discountType === 'porcentaje' ? `(${bloque.config.discountValue}%)` : '(Fijo)'}:
                  </Typography>
                  <Typography variant="body2">-${bloque.descuento.toFixed(2)}</Typography>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total ({bloque.config.moneda}):</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${bloque.total.toFixed(2)}</Typography>
              </Box>

              {bloque.config.isForcedTotalActive && <Alert severity="warning" sx={{ mt: 1 }}>¡Total Forzado!</Alert>}

              <Divider sx={{ my: 2 }} />

              {/* --- B.4: Sección de Archivos Adjuntos --- */}
              {/* Esta sección se oculta si el bloque está bloqueado */}
              {!isLocked && (
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    component="label"
                    startIcon={<AttachFileIcon />}
                    disabled={totalArchivos >= 3}
                  >
                    Adjuntar Cotización
                    <input
                      type="file"
                      multiple
                      hidden
                      accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.xml"
                      onChange={e => onFileChange(bloque.proveedorId, e)}
                    />
                  </Button>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Máx. 3 archivos, 50MB c/u. ({totalArchivos} / 3)
                  </Typography>

                  {totalArchivos > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {/* 1. Renderizar archivos EXISTENTES (links) */}
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
                      {/* 2. Renderizar archivos NUEVOS (solo nombre) */}
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

      {/* --- C: Popover de Configuración (fuera del map) --- */}
      <ConfigPopover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleConfigClose}
        // Ahora 'defaultConfig' es la constante global del módulo y es accesible aquí
        config={providerConfigs[currentProviderId] || defaultConfig}
        setConfig={setConfigForProvider}
      />
    </Box>
  );
}
