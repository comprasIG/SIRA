import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";

export default function Dashboard({ user }) {
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="p-6">
  <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
  <p className="text-xl mb-4">Bienvenido, {user.displayName}</p>
  <button
    onClick={handleLogout}
    className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
  >
    Cerrar sesión
  </button>
</div>
  );
}
