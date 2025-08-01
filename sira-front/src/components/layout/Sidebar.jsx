// src/components/layout/Sidebar.jsx
import { Link } from "react-router-dom";

export default function Sidebar({ isOpen }) {
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
        </ul>
      </nav>
    </aside>
  );
}
