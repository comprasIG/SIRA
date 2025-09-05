// C:\SIRA\sira-front\src\components\rfq\RFQFormHeader.jsx
/**
 * Componente: RFQFormHeader
 * * Propósito:
 * Muestra el encabezado de la página de cotización, incluyendo un botón para
 * volver, el código del RFQ que se está cotizando y datos del proyecto/sitio.
 * * Props:
 * - onBack (function): Función para volver a la lista de RFQs.
 * - rfq_code (string): El código del RFQ.
 * - proyecto (string): Nombre del proyecto asociado.
 * - sitio (string): Nombre del sitio asociado.
 */
import React from 'react';
import { IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function RFQFormHeader({ onBack, rfq_code, proyecto, sitio }) {
  return (
    <div className="flex items-center gap-4 mb-4 border-b pb-4">
      <IconButton onClick={onBack} aria-label="Volver a la lista">
        <ArrowBackIcon />
      </IconButton>
      <div>
          <Typography variant="h5" component="h1" className="font-bold text-gray-800">
                 Cotizando: {rfq_code}
          </Typography>
          <Typography variant="body2" className="text-gray-500">
              {proyecto} / {sitio}
          </Typography>
      </div>
    </div>
  );
}