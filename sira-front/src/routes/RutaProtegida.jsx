// C:\SIRA\sira-front\src\routes\RutaProtegida.jsx

/**
 * =================================================================================================
 * COMPONENTE: RutaProtegida (Versión Corregida)
 * =================================================================================================
 * @file RutaProtegida.jsx
 * @description Protege las rutas de la aplicación. Esta versión mejorada otorga acceso
 * inmediato si el usuario es 'superusuario', de lo contrario, verifica si el
 * permiso requerido se encuentra en la lista de funciones permitidas del usuario.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import Spinner from '../components/ui/Spinner';

export default function RutaProtegida({ children, permiso }) {
  // --- Obtenemos el contexto de autenticación completo ---
  // Necesitamos el objeto 'usuario' para verificar si es superusuario.
  const { usuario, funcionesPermitidas, cargandoUsuario } = useAuth();
  const location = useLocation();

  // 1. Muestra un spinner mientras se verifica la sesión.
  if (cargandoUsuario) {
    return <Spinner />;
  }

  // 2. Si no hay un usuario logueado, lo redirige a la página de login.
  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // --- ¡NUEVA LÓGICA DE VERIFICACIÓN DE PERMISOS! ---

  // 3. Si el usuario es superusuario, tiene acceso a TODO, sin importar el permiso.
  if (usuario.es_superusuario) {
    return children; // Le damos acceso inmediato.
  }

  // 4. Si NO es superusuario, verificamos su lista de permisos.
  // Si el permiso requerido no está en su lista, se le niega el acceso.
  if (!funcionesPermitidas || !funcionesPermitidas.includes(permiso)) {
    return <Navigate to="/403" replace />; // Error 403: Prohibido.
  }

  // 5. Si no es superusuario pero SÍ tiene el permiso, se le da acceso.
  return children;
}
/*
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";


export default function RutaProtegida({ permiso, children }) {
  const { funcionesPermitidas, cargandoUsuario } = useAuth();

  if (cargandoUsuario) {
    return <div className="p-8 text-center text-gray-500">Cargando permisos...</div>;
  }

  if (!funcionesPermitidas.includes(permiso)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}

*/