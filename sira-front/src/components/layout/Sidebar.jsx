// C:\SIRA\sira-front\src\components\layout\Sidebar.jsx
// src/components/layout/Sidebar.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import clsx from "clsx";

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { funcionesPermitidas, usuario } = useAuth();

  const menuItems = [
    { label: "Generar Requisición", to: "/G_REQ", permiso: "G_REQ" },
    { label: "Orden de Compra", to: "/G_OC", permiso: "G_OC" },
    { label: "Registrar Ingreso", to: "/ING_OC", permiso: "ING_OC" },
    { label: "Validar OC", to: "/VB_OC", permiso: "VB_OC" },
    { label: "Registrar Pago", to: "/PAY_OC", permiso: "PAY_OC" },
    { label: "Recibir OC", to: "/REC_OC", permiso: "REC_OC" },
    { label: "Validar Requisición", to: "/VB_REQ", permiso: "VB_REQ" },
    { label: "Generar RFQ", to: "/G_RFQ", permiso: "G_RFQ" },
    { label: "Validar RFQ", to: "/VB_RFQ", permiso: "VB_RFQ" },
    { label: "Usuarios", to: "/USUARIOS", permiso: "USUARIOS" },
  ];

  return (
    <aside
      className={clsx(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-gray-800 text-white shadow-lg z-40 transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <nav className="p-4 space-y-2 overflow-y-auto max-h-full">

          <Link
    to="/dashboard"
    onClick={() => setTimeout(toggleSidebar, 100)}
    className="block px-4 py-2 rounded hover:bg-gray-700 transition duration-200 font-bold text-indigo-300"
  >
    🏠 Dashboard
  </Link>


        {funcionesPermitidas.map((codigo) => {
          const item = menuItems.find((i) => i.permiso === codigo);
          return (
            item && (
              <Link
                key={item.permiso}
                to={item.to}
                onClick={() => setTimeout(toggleSidebar, 100)}
                className="block px-4 py-2 rounded hover:bg-gray-700 transition duration-200"
              >
                {item.label}
              </Link>
            )
          );
        })}
      </nav>
    </aside>
  );
}