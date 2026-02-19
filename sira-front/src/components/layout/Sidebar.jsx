// C:\SIRA\sira-front\src\components\layout\Sidebar.jsx

import React, { useEffect, useMemo, useRef } from 'react';
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/authContext"; // <-- La ruta de importación ya es correcta
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
import Warehouse from '@mui/icons-material/Warehouse';
import HelpOutline from '@mui/icons-material/HelpOutline'; 
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';

// Nuevos Iconos importados aquí si es necesario
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'; //Icono Para Nuevo Proyecto
import LocationOnIcon from '@mui/icons-material/LocationOn'; //Icono Para Sitios
import CarCrashIcon from '@mui/icons-material/CarCrash'; // Icono Para Unidades de Transporte
import FingerprintIcon from '@mui/icons-material/Fingerprint'; // Icono Para Control de Acceso
import TrolleyIcon from '@mui/icons-material/Trolley'; // Icono Para Ingresar Oc almacén
import ForkliftIcon from '@mui/icons-material/Forklift'; // Icono Para Salidas OC almacén
import LocalShippingIcon from '@mui/icons-material/LocalShipping'; // Icono Para Recolección de Materiales
import ContactPageIcon from '@mui/icons-material/ContactPage'; // Icono Para contacto de proveedores
import BeachAccessIcon from '@mui/icons-material/BeachAccess'; // Icono Para Vacaciones
import WorkHistoryIcon from '@mui/icons-material/WorkHistory'; // Icono Para permisos RH

// Mapa de íconos: Convierte el string de la BD al componente de React.
// Aqui es donde se hace el mapeo de los iconos para manejarlos desde la base de datos
// Para cambiarlo en la base de datos, en la columna 'icono', coloca el nombre ejemplo: 'DashboardIcon'
const iconMap = {
  DashboardIcon: <DashboardIcon sx={{ fontSize: 20 }} />, // Icono Dashboard
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
  Warehouse: <Warehouse sx={{ fontSize: 20 }} />, 
  HelpOutline: <HelpOutline sx={{ fontSize: 20, color: '#fdd835' }} />, 
  DirectionsCarIcon: <DirectionsCarIcon sx={{ fontSize: 20 }} />,
  HowToRegIcon: <HowToRegIcon sx={{fontSize: 20}} />,
  AssignmentIndIcon: <AssignmentIndIcon sx={{fontSize:20}} />
  // Nuevos iconos mapeados aquí si es necesario
  ,CreateNewFolderIcon: <CreateNewFolderIcon sx={{ fontSize: 20 }} />, // Icono Para Nuevo Proyecto
  LocationOnIcon: <LocationOnIcon sx={{ fontSize: 20 }} />, // Icono Para Sitios
  CarCrashIcon: <CarCrashIcon sx={{ fontSize: 20 }} />, // Icono Para Unidades de Transporte
  FingerprintIcon: <FingerprintIcon sx={{ fontSize: 20 }} />, // Icono Para Control de Acceso
  TrolleyIcon: <TrolleyIcon sx={{ fontSize: 20 }} />, // Icono Para Ingresar Oc almacén
  ForkliftIcon: <ForkliftIcon sx={{ fontSize: 20 }} />, // Icono Para Salidas OC almacén
  LocalShippingIcon: <LocalShippingIcon sx={{ fontSize: 20 }} />, // Icono Para Recolección de Materiales
  ContactPageIcon: <ContactPageIcon sx={{ fontSize: 20 }} /> ,// Icono Para contacto de proveedores
  BeachAccessIcon: <BeachAccessIcon sx={{ fontSize: 20 }} />, // Icono Para Vacaciones
  WorkHistoryIcon: <WorkHistoryIcon sx={{ fontSize: 20 }} /> // Icono Para permisos RH
};

export default function Sidebar({ isOpen, toggleSidebar }) {
  // ===============================================
  // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
  // Obtenemos el objeto 'usuario' COMPLETO, que contiene la lista de OBJETOS de funciones.
  // 'funcionesPermitidas' (la lista de strings) ya no se usa aquí.
  // ===============================================
  const { usuario } = useAuth();
  const timerRef = useRef(null);

  // ... (Lógica del temporizador sin cambios) ...
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
  // ===============================================


  // Agrupamos dinámicamente las funciones por 'módulo'
  const menuGroups = useMemo(() => {
    // ===============================================
    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
    // Usamos 'usuario.funciones' (la lista de OBJETOS) 
    // en lugar de 'funcionesPermitidas' (la lista de STRINGS)
    // ===============================================
    const funciones = usuario?.funciones || [];
    if (funciones.length === 0) {
      return {};
    }
    return funciones.reduce((acc, func) => {
      const { modulo = 'General' } = func; 
      if (!acc[modulo]) {
        acc[modulo] = [];
      }
      acc[modulo].push(func);
      return acc;
    }, {});
  }, [usuario]); // <-- Ahora depende de 'usuario'

  const handleLinkClick = () => {
    if (isOpen) toggleSidebar();
  };

  // ... (Estilos y renderLink sin cambios) ...
  const linkBaseStyle = "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200";
  const linkInactiveStyle = "text-gray-300 hover:bg-gray-700 hover:text-white";
  const linkActiveStyle = "bg-indigo-600 text-white font-semibold shadow-inner";

  const renderLink = (item) => (
    <NavLink
      key={item.codigo}
      to={item.ruta}
      onClick={handleLinkClick}
      className={({ isActive }) =>
        clsx(linkBaseStyle, isActive ? linkActiveStyle : linkInactiveStyle)
      }
    >
      {iconMap[item.icono] || <DashboardIcon sx={{ fontSize: 20 }} />}
      <span>{item.nombre}</span>
    </NavLink>
  );

  // ... (Separación de módulos sin cambios) ...
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
        
        {/* ... (Renderizado de secciones sin cambios) ... */}
        {dashboardItems.map(renderLink)}

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