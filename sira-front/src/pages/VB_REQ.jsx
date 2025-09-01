// C:\SIRA\SIRA\sira-front\src\pages\VB_REQ.jsx
// C:\SIRA\sira-front\src\pages\VB_REQ.jsx

import React, { useState } from 'react';
import VB_REQ_List from "../components/VB_REQ_List";
import G_REQForm from '../components/G_REQForm'; // <-- Se importa el formulario que reutilizaremos

export default function VB_REQ() {
  // --- LÓGICA PARA CONTROLAR LA VISTA ---
  // Estado para saber qué requisición se está editando. Si es null, se muestra la lista.
  const [editingReqId, setEditingReqId] = useState(null);

  // Función que se pasará a la lista para iniciar la edición
  const handleEdit = (reqId) => {
    setEditingReqId(reqId);
  };

  // Función que se pasará al formulario para volver a la lista
  const handleFinishEditing = () => {
    setEditingReqId(null);
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
        {/* El título cambia dinámicamente dependiendo de la vista */}
        {editingReqId ? 'Editando Requisición' : 'Visto Bueno de Requisiciones'}
      </h1>

      {/* --- RENDERIZADO CONDICIONAL --- */}
      {editingReqId ? (
        // Si estamos editando, muestra el formulario
        <G_REQForm 
          requisicionId={editingReqId} 
          onFinish={handleFinishEditing} 
        />
      ) : (
        // Si no, muestra la lista
        <VB_REQ_List onEdit={handleEdit} />
      )}
    </div>
  );
}