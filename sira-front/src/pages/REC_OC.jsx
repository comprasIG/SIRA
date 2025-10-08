// C:\SIRA\SIRA\sira-front\src\pages\REC_OC.jsx
/**
 * Página principal REC_OC
 * Renderiza el módulo de recolección de OCs con todos los componentes.
 * Autor: Juan R. + ChatGPT
 */
// src/pages/REC_OC.jsx
import React from 'react';
import REC_OCForm from '../components/REC_OC/REC_OCForm';

export default function REC_OC() {
  return  (
    <div className="container mt-4">
      <h1 className="mb-4">Recolección de OCs</h1>
      <REC_OCForm />
    </div>
  );
}

