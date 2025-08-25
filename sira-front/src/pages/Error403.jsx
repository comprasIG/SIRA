// C:\SIRA\sira-front\src\pages\Error403.jsx
import { Link } from "react-router-dom";

export default function Error403() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 text-center">
      <h1 className="text-6xl font-bold text-red-500 mb-4">403</h1>
      <p className="text-xl text-gray-700 mb-6">
        No tienes permiso para acceder a esta página.
      </p>
      <Link
        to="/dashboard"
        className="text-blue-600 hover:underline font-semibold"
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}