// C:\SIRA\sira-front\src\components\G_OCForm\MaterialesSection.jsx
import React from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import { Autocomplete, TextField, IconButton, CircularProgress, Tooltip, Switch, FormControlLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api/api';
import { useMaterialSearch } from './hooks/useMaterialSearch';
import { computeLineTotal } from './utils';

export default function MaterialesSection({ control, register, setValue, watch, catalogos, errors }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'materiales' });
  const { options, loading, search } = useMaterialSearch();

  const handleAdd = () => {
    append({
      material: null,
      descripcionManual: '',
      unidad: '',
      cantidad: '',
      precioUnitario: '',
      moneda: 'MXN',
      esImportacion: false,
      proveedor: null,
      proveedorManual: '',
      comentario: '',
    });
  };

  const fetchUnidad = async (materialId, index) => {
    try {
      const data = await api.get(`/api/materiales/${materialId}`);
      setValue(`materiales.${index}.unidad`, data.unidad || '');
      setValue(`materiales.${index}.descripcionManual`, data.nombre || '');
    } catch (error) {
      console.error('[ExtraOC] Error al cargar unidad del material', error);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Materiales y condiciones</h2>
          <p className="text-sm text-gray-500">Busca materiales como en G_REQ y define proveedor/precio como en G_RFQ.</p>
        </div>
        <Tooltip title="Agregar material">
          <IconButton color="primary" onClick={handleAdd}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const prefix = `materiales.${index}`;
          const lineTotal = computeLineTotal(watch(`materiales.${index}`) || {});

          return (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <Controller
                    name={`${prefix}.material`}
                    control={control}
                    render={({ field: controllerField }) => (
                      <Autocomplete
                        options={options}
                        loading={loading}
                        value={controllerField.value}
                        onChange={(_, value) => {
                          controllerField.onChange(value);
                          if (value?.id) {
                            fetchUnidad(value.id, index);
                          } else {
                            setValue(`${prefix}.unidad`, '');
                          }
                        }}
                        onInputChange={(_, value) => search(value)}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        getOptionLabel={(option) => option?.nombre || ''}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={`Material #${index + 1}`}
                            placeholder="Busca en el catálogo"
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loading ? <CircularProgress color="inherit" size={16} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    )}
                  />
                  <input
                    className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Descripción libre"
                    {...register(`${prefix}.descripcionManual`, { required: 'Indica la descripción' })}
                  />
                  {errors.materiales?.[index]?.descripcionManual && (
                    <span className="text-xs text-red-600">{errors.materiales?.[index]?.descripcionManual?.message}</span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase text-gray-500">Cantidad</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    {...register(`${prefix}.cantidad`, { required: 'Cantidad requerida', min: { value: 0.01, message: '> 0' } })}
                  />
                  {errors.materiales?.[index]?.cantidad && (
                    <span className="text-xs text-red-600">{errors.materiales?.[index]?.cantidad?.message}</span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase text-gray-500">Unidad</label>
                  <input
                    list="unidades-list"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    {...register(`${prefix}.unidad`, { required: 'Unidad requerida' })}
                  />
                  {errors.materiales?.[index]?.unidad && (
                    <span className="text-xs text-red-600">{errors.materiales?.[index]?.unidad?.message}</span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase text-gray-500">Precio unitario</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    {...register(`${prefix}.precioUnitario`, { required: 'Precio requerido', min: { value: 0, message: '>= 0' } })}
                  />
                  {errors.materiales?.[index]?.precioUnitario && (
                    <span className="text-xs text-red-600">{errors.materiales?.[index]?.precioUnitario?.message}</span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase text-gray-500">Moneda</label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2" {...register(`${prefix}.moneda`)}>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <Controller
                    name={`${prefix}.proveedor`}
                    control={control}
                    render={({ field: proveedorField }) => (
                      <Autocomplete
                        options={catalogos.proveedores}
                        value={proveedorField.value}
                        onChange={(_, value) => {
                          proveedorField.onChange(value);
                          if (value) setValue(`${prefix}.proveedorManual`, value.nombre, { shouldDirty: true });
                        }}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        getOptionLabel={(option) => option?.nombre || ''}
                        renderInput={(params) => (
                          <TextField {...params} label="Proveedor" placeholder="Busca proveedor" />
                        )}
                      />
                    )}
                  />
                  <input
                    className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Proveedor libre"
                    {...register(`${prefix}.proveedorManual`, { required: 'Indica proveedor' })}
                  />
                  {errors.materiales?.[index]?.proveedorManual && (
                    <span className="text-xs text-red-600">{errors.materiales?.[index]?.proveedorManual?.message}</span>
                  )}
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs uppercase text-gray-500">Comentario</label>
                  <textarea rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2" {...register(`${prefix}.comentario`)} />
                </div>

                <div className="md:col-span-2 flex items-center">
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={watch(`${prefix}.esImportacion`) || false}
                        onChange={(event) => setValue(`${prefix}.esImportacion`, event.target.checked, { shouldDirty: true })}
                      />
                    )}
                    label="Importación"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col justify-center">
                  <span className="text-xs uppercase text-gray-500">Total línea</span>
                  <span className="text-lg font-semibold text-gray-800">${lineTotal.toFixed(2)}</span>
                </div>

                <div className="md:col-span-1 flex items-start justify-end">
                  <Tooltip title="Eliminar material">
                    <span>
                      <IconButton color="error" disabled={fields.length === 1} onClick={() => remove(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <datalist id="unidades-list">
        {catalogos.unidades.map((unidad) => (
          <option key={unidad.id} value={unidad.simbolo || unidad.nombre} />
        ))}
      </datalist>
    </div>
  );
}
