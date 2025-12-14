// src/components/-p-m-o/NuevoProyecto.jsx
import React from 'react';
import NuevoProyectoForm from './proyectos/NuevoProyectoForm';

export default function NuevoProyecto() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Crear nuevo proyecto
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          Define el responsable, sitio y datos generales del proyecto.  
          El cliente se tomará automáticamente del sitio seleccionado.
        </p>
      </header>

      <NuevoProyectoForm />
    </div>
  );
}
