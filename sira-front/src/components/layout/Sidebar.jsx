// src/components/layout/Sidebar.jsx
export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-gray-800 text-white flex flex-col">
      <div className="p-4 text-2xl font-bold">
        SIRA
      </div>
      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          <li>
            <a href="/" className="block px-4 py-2 rounded hover:bg-gray-700">
              Dashboard
            </a>
          </li>
          <li>
            <a href="/requisiciones" className="block px-4 py-2 rounded hover:bg-gray-700">
              Requisiciones
            </a>
          </li>
          {/* Añade más enlaces aquí */}
        </ul>
      </nav>
    </aside>
  );
}
