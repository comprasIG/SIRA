// C:\SIRA\sira-front\src\components\layout\MainLayout.jsx

import { useState, useRef, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import clsx from "clsx"; // Se necesita importar clsx

const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);
const SCROLL_STEP = 220;

export default function MainLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mainRef = useRef(null);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Scroll horizontal con flechas del teclado (solo cuando no hay foco en inputs)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (SKIP_TAGS.has(tag)) return;
      if (document.activeElement?.isContentEditable) return;

      const el = mainRef.current;
      if (!el) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        el.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        el.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative flex h-screen overflow-hidden bg-gray-100">
      {/* El Sidebar ya no necesita un div contenedor extra */}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      {/* Contenedor principal que se moverá */}
      <div className={clsx(
          "flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out",
          {
            "ml-64": isSidebarOpen, // Se aplica un margen izquierdo cuando el sidebar está abierto
            "ml-0": !isSidebarOpen, // Margen cero cuando está cerrado
          }
        )}>
        <Header
          toggleSidebar={toggleSidebar}
        />
        <main ref={mainRef} className="pt-16 p-4 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}