// C:\SIRA\sira-front\src\components\rfq\MaterialCotizacionRow.jsx
/**
 * =================================================================================================
 * MaterialCotizacionRow.jsx
 * =================================================================================================
 * - Renderiza un material y sus opciones de proveedor.
 *
 * FASE 1:
 * - showSku: mostrar SKU discretamente debajo del nombre.
 * - applyDownFrom: aplicar configuración hacia abajo desde una opción.
 * - dragHandleProps: handle para reordenar (dnd-kit) sin interferir con inputs.
 * =================================================================================================
 */

import React, { useMemo } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import {
  Button,
  Tooltip,
  Typography,
  Paper,
  Box,
  IconButton,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import clsx from "clsx";
import { toast } from "react-toastify";

import OpcionProveedorForm from "./OpcionProveedorForm";

export default function MaterialCotizacionRow({
  control,
  materialIndex,
  setValue,
  lastUsedProvider,
  setLastUsedProvider,
  opcionesBloqueadas = [],
  showSku = false,

  // ✅ FASE 1 (aplicar hacia abajo)
  applyDownFrom,

  // ✅ FASE 1 (drag handle)
  dragHandleProps,
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `materiales.${materialIndex}.opciones`,
    keyName: "key",
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

  // SKU puede venir como sku (backend), pero dejamos fallback por robustez
  const skuValue = useMemo(() => {
    return material.sku ?? material.material_sku ?? material.sku_material ?? null;
  }, [material]);

  const handleSplitPurchase = () => {
    if (fields.length < 3) {
      append({
        id_bd: null,
        proveedor: null,
        proveedor_id: null,
        precio_unitario: "",
        cantidad_cotizada: cantidadRestante > 0 ? Number(cantidadRestante.toFixed(2)) : 0,
        seleccionado: false,
        es_entrega_inmediata: true,
        es_precio_neto: false,
        es_importacion: false,
      });
    } else {
      toast.warn("Se permite un máximo de 3 proveedores por material.");
    }
  };

  return (
    <Paper elevation={1} sx={{ bgcolor: "grey.50", p: 2, borderRadius: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
          {/* ✅ Drag Handle: SOLO desde aquí se puede arrastrar */}
          <Tooltip title="Arrastra para reordenar">
            <span>
              <IconButton
                size="small"
                sx={{
                  mt: 0.2,
                  cursor: dragHandleProps ? "grab" : "default",
                  opacity: dragHandleProps ? 0.8 : 0.3,
                }}
                // dnd-kit props
                {...(dragHandleProps?.listeners || {})}
                {...(dragHandleProps?.attributes || {})}
              >
                <DragIndicatorIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Box>
            <Typography variant="h6" component="h3" sx={{ fontWeight: "bold", color: "primary.main" }}>
              {material.material}
            </Typography>

            {/* ✅ SKU discreto */}
            {showSku && skuValue && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                SKU: <span style={{ fontWeight: 600 }}>{skuValue}</span>
              </Typography>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Cantidad Requerida:{" "}
              <span style={{ fontWeight: "bold" }}>
                {material.cantidad} {material.unidad}
              </span>{" "}
              | Restante por asignar:{" "}
              <span className={clsx("font-bold", cantidadRestante < 0 ? "text-red-500" : "text-green-600")}>
                {Number.isFinite(cantidadRestante) ? cantidadRestante.toFixed(2) : "0.00"}
              </span>
            </Typography>

            {cantidadRestante < 0 && (
              <Typography variant="caption" color="error">
                La cantidad asignada supera la requerida.
              </Typography>
            )}
          </Box>
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

      {/* Opciones */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
            onApplyDownFrom={applyDownFrom}
          />
        ))}
      </Box>
    </Paper>
  );
}
