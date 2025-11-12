// sira-front/src/components/PICK_IN/FormularioRetiroStock.jsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { Stack } from '@mui/material'; // <-- Importación correcta
import RetiroStock_SeccionMateriales from './RetiroStock_SeccionMateriales';
import RetiroStock_Acciones from './RetiroStock_Acciones';

export default function FormularioRetiroStock(props) {
    const { 
        filterOptions, registrarRetiro, isSubmitting, 
        sitioDestinoId, proyectoDestinoId
    } = props;

    const {
        control,
        register,
        handleSubmit,
        formState: { errors, isValid },
        watch,
        setValue,
        reset,
    } = useForm({
        mode: 'onChange',
        defaultValues: {
            items: [{ material: null, cantidad: '', unidad: '', stock_disponible: 0 }]
        }
    });

    const onSubmit = (data) => {
        const itemsPayload = data.items
            .filter(item => item.material && parseFloat(item.cantidad) > 0)
            .map(item => ({
                material_id: item.material.id,
                cantidad_a_retirar: parseFloat(item.cantidad)
            }));

        if (itemsPayload.length === 0) {
            alert('Debes agregar al menos un material con cantidad mayor a 0.');
            return;
        }

        const payload = {
            tipoRetiro: 'STOCK',
            items: itemsPayload,
            proyectoDestinoId: proyectoDestinoId,
            sitioDestinoId: sitioDestinoId,
        };
        
        registrarRetiro(payload).then((success) => {
            if (success) {
                reset({
                    items: [{ material: null, cantidad: '', unidad: '', stock_disponible: 0 }]
                });
            }
        });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={3}>
                <RetiroStock_SeccionMateriales
                    control={control}
                    register={register}
                    errors={errors}
                    watch={watch}
                    setValue={setValue}
                    // Pasamos la lista completa de materiales en stock
                    materialesEnStock={filterOptions.materialesEnStock || []}
                />
                <RetiroStock_Acciones
                    isSubmitting={isSubmitting}
                    isValid={isValid}
                />
            </Stack>
        </form>
    );
}