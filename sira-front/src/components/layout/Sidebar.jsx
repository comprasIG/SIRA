// C:\SIRA\sira-front\src\components\layout\Sidebar.jsx
// src/components/layout/Sidebar.jsx

// src/components/layout/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import clsx from "clsx";

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

  // Reestructuramos el menú en grupos y añadimos íconos
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
        { label: "Recibir Mercancía", to: "/REC_OC", permiso: "REC_OC", icon: <InventoryIcon sx={{ fontSize: 20 }} /> },
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
  
  // Estilos para los NavLink
  const linkBaseStyle = "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200";
  const linkInactiveStyle = "text-gray-300 hover:bg-gray-700 hover:text-white";
  const linkActiveStyle = "bg-indigo-600 text-white font-semibold shadow-inner";

  const renderMenuItems = (group) => {
    // Si es superusuario, muestra todos los items del grupo
    if (usuario?.es_superusuario) {
      return group.items.map(renderLink);
    }
    // Si no, filtra los items por los permisos que tiene
    return group.items
      .filter(item => funcionesPermitidas.includes(item.permiso))
      .map(renderLink);
  };
  
  const renderLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={() => setTimeout(toggleSidebar, 150)} // Pequeño delay para que se vea el click en mobile
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
    >
      <nav className="p-4 space-y-2 overflow-y-auto max-h-full">
        {/* Enlace principal al Dashboard */}
        <NavLink
          to="/dashboard"
          onClick={() => setTimeout(toggleSidebar, 150)}
          className={({ isActive }) =>
            clsx(linkBaseStyle, isActive ? linkActiveStyle : linkInactiveStyle)
          }
        >
          <DashboardIcon sx={{ fontSize: 20 }} />
          <span>Dashboard</span>
        </NavLink>

        {/* Renderizado de los grupos de menú */}
        {menuGroups.map((group) => {
          const itemsToRender = renderMenuItems(group);
          if (itemsToRender.length === 0) return null; // No renderiza el grupo si no tiene items permitidos
          
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