// C:\SIRA\sira-front\src\pages\VB_REQ.jsx

import React, { useState, useCallback } from 'react';
import VB_REQ_List from "../components/VB_REQ_List";
import G_REQForm from '../components/G_REQForm';
import ModalEditarRequisicionVehicular from '../components/-requisiciones/ModalEditarRequisicionVehicular';

export default function VB_REQ() {
  // Para edición de requisiciones normales (reemplaza la vista con el formulario completo)
  const [editingReqId, setEditingReqId] = useState(null);

  // Para edición de requisiciones vehiculares (modal sobre la lista)
  const [editingVehicularId, setEditingVehicularId] = useState(null);

  // VB_REQ_List llama a onEdit con { id, esVehicular }
  const handleEdit = useCallback(({ id, esVehicular }) => {
    if (esVehicular) {
      setEditingVehicularId(id);
    } else {
      setEditingReqId(id);
    }
  }, []);

  const handleFinishEditing = () => setEditingReqId(null);

  const handleCloseVehicular = () => setEditingVehicularId(null);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
        {editingReqId ? 'Editando Requisición' : 'Visto Bueno de Requisiciones'}
      </h1>

      {editingReqId ? (
        // Requisición normal: formulario completo (reemplaza la vista)
        <G_REQForm
          requisicionId={editingReqId}
          onFinish={handleFinishEditing}
        />
      ) : (
        // Lista de requisiciones pendientes
        <VB_REQ_List onEdit={handleEdit} />
      )}

      {/* Modal para edición vehicular (se muestra sobre la lista, no la reemplaza) */}
      <ModalEditarRequisicionVehicular
        open={Boolean(editingVehicularId)}
        requisicionId={editingVehicularId}
        onClose={handleCloseVehicular}
        onGuardado={handleCloseVehicular}
      />
    </div>
  );
}