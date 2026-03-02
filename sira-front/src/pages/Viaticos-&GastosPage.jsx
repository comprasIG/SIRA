// src/pages/Viaticos-&GastosPage.jsx
import React from 'react';
import Viaticos_Gastos from '../components/-finanzas/Viaticos-&Gastos';

export default function Viaticos_GastosPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Módulo: Viaticos & Gastos</h1>
      <Viaticos_Gastos />
    </div>
  );
}