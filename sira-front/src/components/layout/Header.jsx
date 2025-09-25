// src/components/layout/Header.jsx

import { useAuth } from "../../context/authContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import WbSunnyIcon from '@mui/icons-material/WbSunny';      // Mañana
import WbTwilightIcon from '@mui/icons-material/WbTwilight';// Tarde
import NightsStayIcon from '@mui/icons-material/NightsStay';// Noche

export default function Header({ toggleSidebar }) {
  const { usuario, logout } = useAuth(); 
  const navigate = useNavigate();

  const handleLogout = async () => {
      await logout();
      navigate("/login");
  };

  // Estado para la fecha y hora
  const [fechaHora, setFechaHora] = useState(new Date());

  // Actualizar cada segundo
  useEffect(() => {
    const interval = setInterval(() => setFechaHora(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fechaHoraFormateada = fechaHora.toLocaleString('es-MX', {
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Función para obtener color según hora
  const getBadgeColor = () => {
    const hour = fechaHora.getHours();
    if (hour >= 6 && hour < 12) return "bg-yellow-100 text-yellow-800"; // Mañana
    if (hour >= 12 && hour < 18) return "bg-blue-100 text-blue-800";     // Tarde
    return "bg-gray-800 text-white";                                     // Noche
  };

  // Función para obtener icono según hora
  const getDayIcon = () => {
    const hour = fechaHora.getHours();
    if (hour >= 6 && hour < 12) return <WbSunnyIcon className="w-5 h-5" />;
    if (hour >= 12 && hour < 18) return <WbTwilightIcon className="w-5 h-5" />;
    return <NightsStayIcon className="w-5 h-5" />;
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
        <span className="text-2xl font-bold text-indigo-600">SIRA</span>
      </div>

      {/* Lado Derecho: Fecha, Usuario y Logout */}
      <div className="flex items-center gap-3">
        {/* Badge de fecha y hora con color dinámico e icono */}
        <span className={`hidden sm:inline text-sm px-3 py-1 rounded-full shadow-sm font-medium flex items-center gap-2 ${getBadgeColor()}`}>
          {getDayIcon()}
          <span>{fechaHoraFormateada}</span>
        </span>

        {/* Nombre de usuario */}
        <span className="text-gray-700 font-medium hidden sm:inline">
          {usuario?.nombre || "Usuario"}
        </span>

        {/* Botón de logout */}
        <button
          onClick={handleLogout}
          className="text-gray-600 p-2 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
          title="Cerrar sesión"
        >
          <LogoutIcon />
        </button>
      </div>

    </header>
  );
}

