//C:\SIRA\sira-front\src\pages\G_RFQ.jsx
// C:\SIRA\sira-front\src\pages\G_RFQ.jsx

import React, { useState } from 'react';
import G_RFQ_List from '../components/G_RFQ_List'; // El nuevo componente de lista
import G_RFQForm from '../components/G_RFQForm'; // El formulario de cotización

export default function G_RFQ() {
  const [selectedReqId, setSelectedReqId] = useState(null);

  // Función para volver a la lista desde el formulario
  const handleBackToList = () => {
    setSelectedReqId(null);
  };

  return (
    <div className="p-4 md:p-6 h-full">
      {selectedReqId ? (
        <G_RFQForm
          requisicionId={selectedReqId}
          onBack={handleBackToList}
        />
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
            Generar Cotización (RFQ)
          </h1>
          <p className="mb-4 text-gray-600">Selecciona una requisición para comenzar a cotizar.</p>
          <G_RFQ_List onSelectRequisicion={setSelectedReqId} />
        </>
      )}
    </div>
  );
}