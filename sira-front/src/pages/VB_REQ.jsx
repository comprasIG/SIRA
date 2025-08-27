/*
import VB_REQForm from "../components/VB_REQForm";

export default function VB_REQ() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">VB_REQ</h1>
      <VB_REQForm />
    </div>
  );
}

*/

// src/pages/VB_REQ.jsx
import VB_REQ_List from "../components/VB_REQ_List"; // Cambiamos el nombre para que sea más descriptivo

export default function VB_REQ() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
        Visto Bueno de Requisiciones
      </h1>
      <VB_REQ_List />
    </div>
  );
}