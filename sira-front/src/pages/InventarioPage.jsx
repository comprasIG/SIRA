// src/pages/InventarioPage.jsx
import React from 'react';
import Inventario from '../components/-almacén/Inventario';

export default function InventarioPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Módulo: Inventario</h1>
      <Inventario />
    </div>
  );
}