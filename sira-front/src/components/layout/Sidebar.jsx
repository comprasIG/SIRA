// C:\SIRA\sira-front\src\components\layout\Sidebar.jsx

import React, { useEffect, useMemo, useRef } from 'react';
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import clsx from "clsx";

// Importa todos los íconos que definiste en la base de datos
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import InventoryIcon from '@mui/icons-material/Inventory';
import GroupIcon from '@mui/icons-material/Group';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import AddBusinessOutlinedIcon from '@mui/icons-material/AddBusinessOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import Warehouse from '@mui/icons-material/Warehouse'; // Ícono agregado
import HelpOutline from '@mui/icons-material/HelpOutline'; // ¡NUEVO!

// Mapa de íconos: Convierte el string de la BD al componente de React.
const iconMap = {
  DashboardIcon: <DashboardIcon sx={{ fontSize: 20 }} />,
  DescriptionIcon: <DescriptionIcon sx={{ fontSize: 20 }} />,
  CheckCircleOutlineIcon: <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />,
  ShoppingCartIcon: <ShoppingCartIcon sx={{ fontSize: 20 }} />,
  PlaylistAddCheckIcon: <PlaylistAddCheckIcon sx={{ fontSize: 20 }} />,
  FactCheckIcon: <FactCheckIcon sx={{ fontSize: 20 }} />,
  PriceCheckIcon: <PriceCheckIcon sx={{ fontSize: 20 }} />,
  InventoryIcon: <InventoryIcon sx={{ fontSize: 20 }} />,
  GroupIcon: <GroupIcon sx={{ fontSize: 20 }} />,
  RequestQuoteIcon: <RequestQuoteIcon sx={{ fontSize: 20 }} />,
  AddBusinessOutlinedIcon: <AddBusinessOutlinedIcon sx={{ fontSize: 20 }} />,
  FactCheckOutlinedIcon: <FactCheckOutlinedIcon sx={{ fontSize: 20 }} />,
  AdminPanelSettingsIcon: <AdminPanelSettingsIcon sx={{ fontSize: 20 }} />,
  Warehouse: <Warehouse sx={{ fontSize: 20 }} />, // Ícono agregado
  HelpOutline: <HelpOutline sx={{ fontSize: 20, color: '#fdd835' }} />, 
};

export default function Sidebar({ isOpen, toggleSidebar }) {
  // 'funcionesPermitidas' ahora es un array de objetos completos.
  const { funcionesPermitidas } = useAuth();
  const timerRef = useRef(null);

  // Lógica del temporizador para cerrar el sidebar (sin cambios)
  const startTimer = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isOpen) toggleSidebar();
    }, 5000);
  };
  const stopTimer = () => clearTimeout(timerRef.current);

  useEffect(() => {
    if (isOpen) startTimer(); else stopTimer();
    return () => clearTimeout(timerRef.current);
  }, [isOpen, toggleSidebar]);

  // Agrupamos dinámicamente las funciones por 'módulo' usando useMemo para optimizar.
  const menuGroups = useMemo(() => {
    if (!funcionesPermitidas || funcionesPermitidas.length === 0) {
      return {};
    }
    return funcionesPermitidas.reduce((acc, func) => {
      const { modulo = 'General' } = func; // Módulo por defecto si alguno no lo tuviera
      if (!acc[modulo]) {
        acc[modulo] = [];
      }
      acc[modulo].push(func);
      return acc;
    }, {});
  }, [funcionesPermitidas]);

  const handleLinkClick = () => {
    if (isOpen) toggleSidebar();
  };

  const linkBaseStyle = "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200";
  const linkInactiveStyle = "text-gray-300 hover:bg-gray-700 hover:text-white";
  const linkActiveStyle = "bg-indigo-600 text-white font-semibold shadow-inner";

  // Función reutilizable para renderizar un enlace
  const renderLink = (item) => (
    <NavLink
      key={item.codigo}
      to={item.ruta}
      onClick={handleLinkClick}
      className={({ isActive }) =>
        clsx(linkBaseStyle, isActive ? linkActiveStyle : linkInactiveStyle)
      }
    >
      {/* Usamos el mapa para obtener el componente del ícono. Ponemos un fallback por si acaso. */}
      {iconMap[item.icono] || <DashboardIcon sx={{ fontSize: 20 }} />}
      <span>{item.nombre}</span>
    </NavLink>
  );

  // Separamos los módulos para renderizarlos en el orden deseado
  const dashboardItems = menuGroups['Dashboard'] || [];
  const configItems = menuGroups['Configuracion'] || [];
  
  const processModules = Object.keys(menuGroups).filter(
    (modulo) => modulo !== 'Dashboard' && modulo !== 'Configuracion'
  );

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-full w-64 bg-gray-800 text-white shadow-lg z-40 transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      onMouseEnter={stopTimer}
      onMouseLeave={isOpen ? startTimer : undefined}
    >
      <div className="h-16 flex items-center px-4" /> {/* Espacio para header */}
      
      <nav className="p-4 space-y-2 overflow-y-auto" style={{ height: 'calc(100vh - 4rem)' }}>
        
        {/* Sección 1: Dashboard (siempre al principio) */}
        {dashboardItems.map(renderLink)}

        {/* Sección 2: Módulos de Procesos (generados dinámicamente) */}
        {processModules.map((modulo) => (
          <div key={modulo} className="pt-4">
            <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {modulo}
            </h3>
            <div className="space-y-1">
              {menuGroups[modulo].map(renderLink)}
            </div>
          </div>
        ))}

        {/* Sección 3: Módulo de Configuración (siempre al final) */}
        {configItems.length > 0 && (
          <div className="pt-4">
            <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Configuración
            </h3>
            <div className="space-y-1">
              {configItems.map(renderLink)}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}