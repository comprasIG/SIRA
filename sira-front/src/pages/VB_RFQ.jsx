// C:\SIRA\sira-front\src\pages\VB_RFQ.jsx

import React, { useState } from "react";
import VB_RFQ_List from "../components/VB_RFQ_List";
import G_RFQForm from "../components/G_RFQForm"; // <-- Se importa el formulario de edición

export default function VB_RFQ() {
  const [editingRfqId, setEditingRfqId] = useState(null);

  const handleEdit = (rfqId) => {
    setEditingRfqId(rfqId);
  };

  const handleBackToList = () => {
    setEditingRfqId(null);
  };

  return (
    <div className="p-4 md:p-6">
      {editingRfqId ? (
        <G_RFQForm requisicionId={editingRfqId} onBack={handleBackToList} mode="VB" />
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
            Visto Bueno de Cotizaciones (RFQ)
          </h1>
          <VB_RFQ_List onEdit={handleEdit} />
        </>
      )}
    </div>
  );
}