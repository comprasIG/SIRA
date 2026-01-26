// C:\SIRA\sira-front\src\components\rfq\MaterialCotizacionRow.jsx
/**
 * =================================================================================================
 * COMPONENTE: MaterialCotizacionRow
 * =================================================================================================
 * - Contenedor para un material específico y sus opciones.
 *
 * FASE 1:
 * - showSku: mostrar SKU (solo UI, preferencia por usuario)
 * - onApplyDownFrom: aplicar configuración desde esta fila hacia abajo (sobrescribe)
 */

import React from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { Button, Tooltip, Typography, Paper, Box } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import clsx from 'clsx';
import { toast } from 'react-toastify';
import OpcionProveedorForm from './OpcionProveedorForm';

export default function MaterialCotizacionRow({
  control,
  materialIndex,
  setValue,
  lastUsedProvider,
  setLastUsedProvider,
  opcionesBloqueadas = [],
  showSku = false,
  // ✅ NUEVO
  onApplyDownFrom,
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `materiales.${materialIndex}.opciones`,
    keyName: 'key',
  });

  const material = useWatch({
    control,
    name: `materiales.${materialIndex}`,
  });

  if (!material) return null;

  const cantidadAsignada = (material.opciones || []).reduce((acc, opt) => {
    return opt?.seleccionado ? acc + Number(opt.cantidad_cotizada || 0) : acc;
  }, 0);

  const cantidadRestante = Number(material.cantidad || 0) - cantidadAsignada;

  const skuValue = material.sku ?? material.material_sku ?? material.sku_material ?? null;

  const handleSplitPurchase = () => {
    if (fields.length < 3) {
      append({
        id_bd: null,
        proveedor: null,
        proveedor_id: null,
        precio_unitario: '',
        cantidad_cotizada: cantidadRestante > 0 ? cantidadRestante.toFixed(2) : 0,
        seleccionado: false,
        es_entrega_inmediata: true,
        es_precio_neto: false,
        es_importacion: false,
      });
    } else {
      toast.warn('Se permite un máximo de 3 proveedores por material.');
    }
  };

  return (
    <Paper elevation={1} sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            {material.material}
          </Typography>

          {showSku && skuValue && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              SKU: <span style={{ fontWeight: 600 }}>{skuValue}</span>
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary">
            Cantidad Requerida:{' '}
            <span style={{ fontWeight: 'bold' }}>
              {material.cantidad} {material.unidad}
            </span>{' '}
            | Restante por asignar:{' '}
            <span className={clsx('font-bold', cantidadRestante < 0 ? 'text-red-500' : 'text-green-600')}>
              {Number.isFinite(cantidadRestante) ? cantidadRestante.toFixed(2) : '0.00'}
            </span>
          </Typography>

          {cantidadRestante < 0 && (
            <Typography variant="caption" color="error">
              La cantidad asignada supera la requerida.
            </Typography>
          )}
        </Box>

        <Tooltip title="Dividir compra entre otro proveedor">
          <span>
            <Button
              onClick={handleSplitPurchase}
              startIcon={<AddCircleOutlineIcon />}
              disabled={fields.length >= 3}
              size="small"
            >
              Añadir Opción
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {fields.map((field, index) => (
          <OpcionProveedorForm
            key={field.key}
            fieldId={field.id_bd}
            materialIndex={materialIndex}
            opcionIndex={index}
            control={control}
            setValue={setValue}
            removeOpcion={remove}
            totalOpciones={fields.length}
            lastUsedProvider={lastUsedProvider}
            onProviderSelect={setLastUsedProvider}
            opcionesBloqueadas={opcionesBloqueadas}
            // ✅ NUEVO: callback para aplicar ↓ desde esta línea
            onApplyDownFrom={onApplyDownFrom}
          />
        ))}
      </Box>
    </Paper>
  );
}
