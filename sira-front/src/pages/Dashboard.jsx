// C:\SIRA\sira-front\src\pages\Dashboard.jsx
import { useAuth } from "../context/authContext";

export default function Dashboard() {
  const { usuario } = useAuth();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-xl mb-4">Bienvenido, {usuario?.nombre || "Usuario"}</p>
    </div>
  );
}
