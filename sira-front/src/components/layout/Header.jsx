// src/components/layout/Header.jsx

import { useAuth } from "../../context/authContext";
import { useNavigate } from "react-router-dom";
// Íconos de Material UI para un look más profesional
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';

export default function Header({ toggleSidebar }) {
  const { usuario } = useAuth(); // Ya no necesitamos 'logout' directamente aquí
  const navigate = useNavigate();

  // La función logout ahora está dentro del contexto, pero la navegación se maneja aquí
  const handleLogout = async () => {
    // La lógica de signOut y limpieza de estado está en el contexto
    // Aquí solo llamamos a la función del contexto y luego navegamos
    const { logout } = useAuth.getAuth(); // Esta es una forma de obtener la función sin desestructurarla arriba
    if (logout) {
        await logout();
    }
    navigate("/login");
  };

  // Corrección: Obtenemos logout directamente del hook
  const { logout: performLogout } = useAuth();
  const handleLogoutCorrected = async () => {
      await performLogout();
      navigate("/login");
  };


  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-white flex items-center justify-between px-4 border-b border-gray-200 z-50">
      
      {/* Lado Izquierdo: Menú y Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
          title="Abrir menú"
        >
          <MenuIcon />
        </button>
        <span className="text-2xl font-bold text-indigo-600">
          SIRA
        </span>
      </div>

      {/* Lado Derecho: Info de Usuario y Logout */}
      <div className="flex items-center gap-4">
        <span className="text-gray-700 font-medium hidden sm:inline">
          {usuario?.nombre || "Usuario"}
        </span>
        <button
          onClick={handleLogoutCorrected} // Usamos la función corregida
          className="text-gray-600 p-2 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
          title="Cerrar sesión"
        >
          <LogoutIcon />
        </button>
      </div>

    </header>
  );
}