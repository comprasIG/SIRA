import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const provider = new GoogleAuthProvider();

export default function Login({user}) {
  const navigate = useNavigate();
  
 useEffect(() => {
   if (user) navigate("/dashboard", { replace: true });
 }, [user, navigate]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      alert(`¡Hola, ${user.displayName}!`);
      // Aquí podrías redirigir al dashboard más adelante
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("Hubo un problema con el login");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-xl shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Iniciar sesión en SIRA</h1>
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Iniciar sesión con Google
        </button>
      </div>
    </div>
  );
}
