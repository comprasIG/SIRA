// C:\SIRA\sira-front\src\routes\RutaProtegida.jsx
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