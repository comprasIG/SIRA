// src/components/layout/Sidebar.jsx
import { Link } from "react-router-dom";
import { useEffect } from "react"; // 1. Importamos useEffect

// 2. Recibimos la nueva prop 'onClose'
export default function Sidebar({ isOpen, onClose }) {
  
  // 3. Hook para manejar el cierre automático
  useEffect(() => {
    let timer;
    // Si el sidebar está abierto, iniciamos el temporizador
    if (isOpen) {
      timer = setTimeout(() => {
        console.log("Cerrando sidebar por tiempo...");
        onClose(); // Llama a la función de cierre después de 10 segundos
      }, 10000); // 10000 milisegundos = 10 segundos
    }

    // Función de limpieza: se ejecuta si el sidebar se cierra antes de los 10s
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, onClose]); // Se ejecuta cada vez que 'isOpen' o 'onClose' cambian

  return (
    <aside
      className={`${
        isOpen ? "w-64" : "w-0"
      } overflow-hidden bg-gray-800 text-white transition-all duration-300 ease-in-out`}
    >
      <div className="p-4 text-2xl font-bold">SIRA</div>
      <nav className="px-2">
        <ul className="space-y-1">
          <li>
            {/* 4. Añadimos el evento onClick para cerrar el menú */}
            <Link
              to="/dashboard"
              className="block px-4 py-2 rounded hover:bg-gray-700"
              onClick={onClose}
            >
              Dashboard
            </Link>
          </li>
          <li>
            {/* 4. Añadimos el evento onClick para cerrar el menú */}
            <Link
              to="/requisiciones"
              className="block px-4 py-2 rounded hover:bg-gray-700"
              onClick={onClose}
            >
              Requisiciones
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
