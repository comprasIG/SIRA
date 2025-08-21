// src/components/layout/MainLayout.jsx
import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function MainLayout({ children, userName }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 1. Creamos la función para cerrar el sidebar
  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen">
      {/* 2. Pasamos la función como la prop 'onClose' */}
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      <div className="flex flex-col flex-1">
        <Header
          userName={userName}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <main className="pt-16 p-6 bg-gray-100 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}