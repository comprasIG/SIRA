// C:\SIRA\sira-front\src\components\layout\MainLayout.jsx

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import clsx from "clsx"; // Se necesita importar clsx

export default function MainLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-gray-100">
      {/* El Sidebar ya no necesita un div contenedor extra */}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      {/* Contenedor principal que se moverá */}
      <div className={clsx(
          "flex flex-col flex-1 transition-all duration-300 ease-in-out",
          {
            "ml-64": isSidebarOpen, // Se aplica un margen izquierdo cuando el sidebar está abierto
            "ml-0": !isSidebarOpen, // Margen cero cuando está cerrado
          }
        )}>
        <Header
          toggleSidebar={toggleSidebar}
        />
        <main className="pt-16 p-4 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}