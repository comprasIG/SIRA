//C:\SIRA\sira-front\src\pages\Error404.jsx
import { Link } from "react-router-dom";

export default function Error404() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-600 mb-4">404</h1>
      <p className="text-xl text-gray-700 mb-6">
        La página que buscas no existe.
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