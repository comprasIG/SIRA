// C:\SIRA\sira-front\src\components\layout\Sidebar.jsx

import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import clsx from "clsx";
import React, { useEffect, useRef } from 'react'; // <-- Se importa useEffect y useRef

// Importamos los íconos de Material-UI
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

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { funcionesPermitidas, usuario } = useAuth();
  const timerRef = useRef(null); // <-- Referencia para guardar el ID del temporizador

  // Lógica para el cierre automático
  const startTimer = () => {
    clearTimeout(timerRef.current); // Limpia cualquier temporizador anterior
    timerRef.current = setTimeout(() => {
      toggleSidebar();
    }, 5000); // 5000 milisegundos = 5 segundos
  };

  const stopTimer = () => {
    clearTimeout(timerRef.current);
  };

  useEffect(() => {
    if (isOpen) {
      startTimer(); // Inicia el temporizador cuando el sidebar se abre
    } else {
      stopTimer(); // Detiene el temporizador si el sidebar se cierra por otra razón
    }

    // Limpieza al desmontar el componente
    return () => clearTimeout(timerRef.current);
  }, [isOpen]); // Este efecto se ejecuta cada vez que 'isOpen' cambia

  const menuGroups = [
    {
      title: "Procesos",
      items: [
        { label: "Generar Requisición", to: "/G_REQ", permiso: "G_REQ", icon: <DescriptionIcon sx={{ fontSize: 20 }} /> },
        { label: "Validar Requisición", to: "/VB_REQ", permiso: "VB_REQ", icon: <CheckCircleOutlineIcon sx={{ fontSize: 20 }} /> },
        { label: "Generar Cotización (RFQ)", to: "/G_RFQ", permiso: "G_RFQ", icon: <RequestQuoteIcon sx={{ fontSize: 20 }} /> },
        { label: "Validar Cotización (RFQ)", to: "/VB_RFQ", permiso: "VB_RFQ", icon: <PlaylistAddCheckIcon sx={{ fontSize: 20 }} /> },
        { label: "Generar Orden Compra", to: "/G_OC", permiso: "G_OC", icon: <ShoppingCartIcon sx={{ fontSize: 20 }} /> },
        { label: "Validar Orden Compra", to: "/VB_OC", permiso: "VB_OC", icon: <FactCheckIcon sx={{ fontSize: 20 }} /> },
        { label: "Recolectar OC", to: "/REC_OC", permiso: "REC_OC", icon: <InventoryIcon sx={{ fontSize: 20 }} /> },
        { label: "Registrar Pago", to: "/PAY_OC", permiso: "PAY_OC", icon: <PriceCheckIcon sx={{ fontSize: 20 }} /> },
      ],
    },
    {
      title: "Administración",
      items: [
        { label: "Usuarios", to: "/USUARIOS", permiso: "USUARIOS", icon: <GroupIcon sx={{ fontSize: 20 }} /> },
      ],
    },
  ];

  const linkBaseStyle = "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200";
  const linkInactiveStyle = "text-gray-300 hover:bg-gray-700 hover:text-white";
  const linkActiveStyle = "bg-indigo-600 text-white font-semibold shadow-inner";
  
  const handleLinkClick = () => {
    stopTimer(); // Detiene el timer de cierre automático
    setTimeout(toggleSidebar, 150); // Cierra el sidebar después de un breve delay
  };

  const renderMenuItems = (group) => {
    if (usuario?.es_superusuario) {
      return group.items.map(renderLink);
    }
    return group.items
      .filter(item => funcionesPermitidas.includes(item.permiso))
      .map(renderLink);
  };
  
  const renderLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={handleLinkClick} // <-- Se usa la nueva función
      className={({ isActive }) =>
        clsx(linkBaseStyle, isActive ? linkActiveStyle : linkInactiveStyle)
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <aside
      className={clsx(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-gray-800 text-white shadow-lg z-40 transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      // <-- Se añaden los manejadores de eventos del mouse -->
      onMouseEnter={stopTimer} // Detiene el temporizador si el mouse está encima
      onMouseLeave={startTimer} // Reinicia el temporizador cuando el mouse sale
    >
      <nav className="p-4 space-y-2 overflow-y-auto max-h-full">
        <NavLink
          to="/dashboard"
          onClick={handleLinkClick} // <-- Se usa la nueva función
          className={({ isActive }) =>
            clsx(linkBaseStyle, isActive ? linkActiveStyle : linkInactiveStyle)
          }
        >
          <DashboardIcon sx={{ fontSize: 20 }} />
          <span>Dashboard</span>
        </NavLink>
        
        {menuGroups.map((group) => {
          const itemsToRender = renderMenuItems(group);
          if (itemsToRender.length === 0) return null;
          
          return (
            <div key={group.title} className="pt-4">
              <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="space-y-1">
                {itemsToRender}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}