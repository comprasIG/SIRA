// /src/components/layout/LayoutProtegido.jsx

// /src/components/layout/LayoutProtegido.jsx

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import Spinner from "../ui/Spinner"; // Asumiendo que creaste este componente

/**
 * Componente de orden superior que protege rutas.
 * Verifica si hay un usuario autenticado.
 * 1. Muestra un spinner mientras verifica la sesión.
 * 2. Si no hay usuario, redirige a /login guardando la ruta de origen.
 * 3. Si hay usuario, renderiza los componentes hijos.
 */
export default function LayoutProtegido({ children }) {
  const { usuario, cargandoUsuario } = useAuth();
  const location = useLocation();

  if (cargandoUsuario) {
    return <Spinner />;
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}