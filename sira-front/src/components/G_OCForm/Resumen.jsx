// C:\SIRA\sira-front\src\components\G_OCForm\Resumen.jsx
import React from 'react';
import { Switch, FormControlLabel, TextField, MenuItem } from '@mui/material';
import { buildTotals } from './utils';

export default function ResumenExtra({ watch, setValue }) {
  const materiales = watch('materiales') || [];
  const configuracion = watch('configuracion') || {};

  const totales = buildTotals(materiales, configuracion);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Resumen de compra</h2>
        <p className="text-sm text-gray-500">Define impuestos y visualiza los totales como en la comparativa.</p>
      </div>

      <div className="space-y-4">
        <FormControlLabel
          control={(
            <Switch
              checked={configuracion.aplicaIva !== false}
              onChange={(event) => setValue('configuracion.aplicaIva', event.target.checked, { shouldDirty: true })}
            />
          )}
          label="Aplicar IVA"
        />

        <TextField
          label="Tasa IVA"
          type="number"
          variant="outlined"
          size="small"
          value={configuracion.ivaRate ?? 0.16}
          onChange={(event) => setValue('configuracion.ivaRate', Number(event.target.value), { shouldDirty: true })}
          helperText="Expresado en decimal (0.16 = 16%)"
        />

        <FormControlLabel
          control={(
            <Switch
              checked={configuracion.esImportacion || false}
              onChange={(event) => setValue('configuracion.esImportacion', event.target.checked, { shouldDirty: true })}
            />
          )}
          label="Compra de importación"
        />

        <TextField
          select
          label="Moneda"
          size="small"
          value={configuracion.moneda || 'MXN'}
          onChange={(event) => setValue('configuracion.moneda', event.target.value, { shouldDirty: true })}
        >
          <MenuItem value="MXN">MXN</MenuItem>
          <MenuItem value="USD">USD</MenuItem>
          <MenuItem value="EUR">EUR</MenuItem>
        </TextField>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-2 text-right">
        <div className="text-sm text-gray-600">Subtotal</div>
        <div className="text-lg font-semibold text-gray-800">${totales.subTotal.toFixed(2)} {totales.moneda}</div>
        <div className="text-sm text-gray-600">IVA</div>
        <div className="text-lg font-semibold text-gray-800">${totales.iva.toFixed(2)} {totales.moneda}</div>
        <div className="text-sm text-gray-600">Total</div>
        <div className="text-2xl font-bold text-indigo-600">${totales.total.toFixed(2)} {totales.moneda}</div>
      </div>
    </div>
  );
}
