// C:\SIRA\sira-front\src\components\G_OCForm\Acciones.jsx
import React from 'react';
import { Button } from '@mui/material';

export default function AccionesExtra({ onGuardar, onEnviar, loading }) {
  return (
    <div className="flex flex-col md:flex-row justify-end gap-3">
      <Button variant="outlined" color="primary" disabled={loading} onClick={onGuardar}>
        Guardar borrador
      </Button>
      <Button variant="contained" color="secondary" disabled={loading} onClick={onEnviar}>
        Enviar a revisión
      </Button>
    </div>
  );
}
