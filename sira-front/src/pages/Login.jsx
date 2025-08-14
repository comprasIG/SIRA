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
    <div
  className="min-h-screen w-full flex items-center justify-center bg-cover bg-center"
  style={{ backgroundImage: "url('/public/grupoig.jpg')" }}
>
  <div className="bg-white bg-opacity-90 p-10 rounded-xl shadow-lg w-full max-w-md text-center space-y-6">
    <h1 className="text-2xl font-semibold text-gray-800">Iniciar sesión en SIRA</h1>

    <button
      onClick={handleLogin}
      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition duration-200 transform motion-safe:hover:scale-110"
      aria-label="Iniciar sesión con Google"
    >
      {/* Ícono de Google */}
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.35 11.1h-9.18v2.92h5.3c-.23 1.24-1.4 3.63-5.3 3.63-3.19 0-5.8-2.63-5.8-5.87s2.61-5.87 5.8-5.87c1.82 0 3.04.77 3.74 1.43l2.56-2.48C17.3 3.9 15.02 3 12.17 3 6.97 3 2.9 7.03 2.9 12s4.07 9 9.27 9c5.36 0 8.89-3.76 8.89-9 0-.61-.07-1.22-.21-1.9z" />
      </svg>
      Iniciar sesión con Google
    </button>

    <p className="text-sm text-gray-500">
      Sistema Administrativo Grupo IG
    </p>
  </div>
</div>
  );
}
