// src/pages/GasolinaPage.jsx
import React from 'react';
import Gasolina from '../components/-finanzas/Gasolina';

export default function GasolinaPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Módulo: Gasolina</h1>
      <Gasolina />
    </div>
  );
}