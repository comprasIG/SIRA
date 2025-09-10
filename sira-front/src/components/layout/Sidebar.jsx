// C:\SIRA\sira-front\src\components\layout\Sidebar.jsx

import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import clsx from "clsx";
import React, { useEffect, useRef } from 'react';


// Iconos de Material-UI
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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'; // Icono para la nueva opción


export default function Sidebar({ isOpen, toggleSidebar }) {
  const { funcionesPermitidas, usuario } = useAuth();
  const timerRef = useRef(null);

  // Lógica de temporizador mejorada
  const startTimer = () => {
    // Siempre limpia el temporizador anterior antes de iniciar uno nuevo
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Solo cierra si todavía está abierto
      if (isOpen) {
        toggleSidebar();
      }
    }, 5000); // 5 segundos
  };

  const stopTimer = () => {
    clearTimeout(timerRef.current);
  };

  useEffect(() => {
    // Este efecto ahora solo reacciona a la apertura del sidebar
    if (isOpen) {
      startTimer();
    } else {
      stopTimer(); // Si se cierra por cualquier motivo, se detiene el timer.
    }

    // Limpieza al desmontar el componente
    return () => clearTimeout(timerRef.current);
  }, [isOpen]); // Dependencia explícita en isOpen

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
        { label: "Agregar Producto", to: "/agregar-producto", permiso: "AGREGAR_PRODUCTO", icon: <AddBusinessOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: "Ver Productos", to: "/lista-producto", permiso: "AGREGAR_PRODUCTO", icon: <FactCheckOutlinedIcon sx={{ fontSize: 20 }} /> },
         { 
          label: "Grupos de Notificación", 
          to: "/config/notificaciones", 
          permiso: "SUPERUSUARIO", // Usamos un permiso especial que solo el superusuario tendrá
          icon: <AdminPanelSettingsIcon sx={{ fontSize: 20 }} /> 
        },
      ],
    },
  ];


  const linkBaseStyle = "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200";
  const linkInactiveStyle = "text-gray-300 hover:bg-gray-700 hover:text-white";
  const linkActiveStyle = "bg-indigo-600 text-white font-semibold shadow-inner";
  
  const handleLinkClick = () => {
    // Al hacer clic, simplemente cierra el sidebar (si está abierto)
    if (isOpen) {
      toggleSidebar();
    }
  };

   const renderMenuItems = (group) => {
    if (usuario?.es_superusuario) {
      // El superusuario ve todos los ítems que no tengan un permiso específico o que tengan el permiso SUPERUSUARIO
      return group.items
        .filter(item => !item.permiso || funcionesPermitidas.includes(item.permiso) || item.permiso === "SUPERUSUARIO")
        .map(renderLink);
    }
    // Los usuarios normales ven solo los ítems a los que tienen permiso explícito
    return group.items
      .filter(item => funcionesPermitidas.includes(item.permiso))
      .map(renderLink);
  };
  
  const renderLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={handleLinkClick}
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
        "fixed left-0 top-0 h-full w-64 bg-gray-800 text-white shadow-lg z-40 transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      onMouseEnter={stopTimer}
      onMouseLeave={isOpen ? startTimer : undefined} // Solo inicia el timer si el sidebar está abierto
    >
      <div className="h-16 flex items-center px-4">
        {/* Espacio para el header que ahora es parte del layout principal */}
      </div>
      <nav className="p-4 space-y-2 overflow-y-auto" style={{height: 'calc(100vh - 4rem)'}}>
        <NavLink
          to="/dashboard"
          onClick={handleLinkClick}
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