// sira-front/src/components/PICK_IN/FormularioRetiroStock.jsx
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Paper, Typography, Stack, TextField, Autocomplete, Divider } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

import RetiroStock_SeccionMateriales from './RetiroStock_SeccionMateriales';
import RetiroStock_Acciones from './RetiroStock_Acciones';

/**
 * FormularioRetiroStock
 * =========================================================================================
 * Registro de salida desde STOCK (inventario_actual.stock_actual).
 *
 * Reglas:
 * - Destino (sitioDestinoId + proyectoDestinoId) lo define el componente padre (RetiroStock).
 * - Siempre se captura solicitante (empleado activo).
 * - Los materiales se seleccionan de filterOptions.materialesEnStock (solo existentes).
 *
 * Payload esperado por backend:
 * {
 *   tipoRetiro: 'STOCK',
 *   solicitanteEmpleadoId,
 *   sitioDestinoId,
 *   proyectoDestinoId,
 *   items: [{ material_id, cantidad_a_retirar }]
 * }
 */
export default function FormularioRetiroStock(props) {
  const theme = useTheme();

  const {
    sitioDestinoId,
    proyectoDestinoId,
    filterOptions,
    empleadosActivos,
    registrarRetiro,
    isSubmitting,
  } = props;

  const materialesEnStock = filterOptions?.materialesEnStock || [];

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      solicitante: null,
      items: [],
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const busy = isSubmitting || submitting;

  // ✅ Habilita el submit solo si hay solicitante + al menos 1 item válido
  const canSubmit = useMemo(() => {
    const solicitanteOk = !!watch('solicitante')?.id;

    const items = watch('items') || [];
    const hasValidItem = items.some(
      (it) => it?.material?.id && Number(it?.cantidad) > 0
    );

    return solicitanteOk && hasValidItem && !!sitioDestinoId && !!proyectoDestinoId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch('solicitante'), watch('items'), sitioDestinoId, proyectoDestinoId]);

  const onSubmit = async (formData) => {
    if (!sitioDestinoId || !proyectoDestinoId) return;

    if (!formData?.solicitante?.id) {
      // RHF no maneja required bien en Autocomplete sin Controller, por eso validamos aquí.
      alert('Selecciona el solicitante (empleado).');
      return;
    }

    const cleanItems = (formData.items || [])
      .filter((it) => it?.material?.id && Number(it?.cantidad) > 0)
      .map((it) => ({
        material_id: it.material.id,
        cantidad_a_retirar: Number(it.cantidad),
      }));

    if (cleanItems.length === 0) {
      alert('Agrega al menos un material con cantidad > 0.');
      return;
    }

    const payload = {
      tipoRetiro: 'STOCK',
      solicitanteEmpleadoId: formData.solicitante.id,
      sitioDestinoId,
      proyectoDestinoId,
      items: cleanItems,
    };

    setSubmitting(true);
    try {
      await registrarRetiro(payload);

      // reset: mantiene solicitante para capturas rápidas (opcional)
      reset({ solicitante: formData.solicitante, items: [] });
    } catch (e) {
      // toast lo maneja el hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      // ✅ CLAVE: ahora el Paper ES un form y el submit ya dispara handleSubmit(onSubmit)
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
        backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${theme.palette.background.paper} 70%)`,
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        2. Captura el retiro (Stock)
      </Typography>

      <Stack spacing={2} sx={{ mt: 2 }}>
        {/* SOLICITANTE */}
        <Autocomplete
          fullWidth
          options={empleadosActivos || []}
          getOptionLabel={(o) => o?.empleado || ''}
          value={watch('solicitante')}
          onChange={(_, v) => setValue('solicitante', v, { shouldValidate: true })}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Solicitante"
              required
              error={!!errors.solicitante}
              helperText={errors.solicitante?.message}
            />
          )}
        />

        <Divider />

        {/* MATERIALES */}
        <RetiroStock_SeccionMateriales
          control={control}
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          materialesEnStock={materialesEnStock}
        />

        {/* ✅ El botón es type="submit" y ahora sí está dentro del form */}
        <RetiroStock_Acciones isSubmitting={busy} isValid={canSubmit} />
      </Stack>
    </Paper>
  );
}
