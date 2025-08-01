// src/components/layout/Sidebar.jsx
import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="h-screen w-64 bg-gray-800 text-white">
      <div className="p-4 text-2xl font-bold">SIRA</div>
      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          <li>
            <Link
              to="/dashboard"
              className="block px-4 py-2 rounded hover:bg-gray-700"
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to="/requisiciones"
              className="block px-4 py-2 rounded hover:bg-gray-700"
            >
              Requisiciones
            </Link>
          </li>
          {/* Añade más enlaces aquí */}
        </ul>
      </nav>
    </aside>
  );
}
