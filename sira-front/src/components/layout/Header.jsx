// src/components/layout/Header.jsx
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/firebase";

export default function Header({ userName, toggleSidebar }) {
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-gray-200 flex items-center justify-between px-4 shadow z-10">
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleSidebar}
          className="text-2xl text-gray-700 hover:text-blue-600"
          title="Abrir menú"
        >
          ☰
        </button>
        <h1 className="text-xl font-bold">Bienvenido, {userName}</h1>
      </div>

      <button
        onClick={handleLogout}
        className="text-gray-700 hover:text-red-600 text-2xl"
        title="Cerrar sesión"
      >
        🔓
      </button>
    </header>
  );
}
