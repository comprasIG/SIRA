import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useAuth } from "../context/authContext";
import { Navigate } from "react-router-dom";

const provider = new GoogleAuthProvider();

export default function Login() {
  const { usuario } = useAuth();

  if (usuario) return <Navigate to="/dashboard" replace />;

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      alert(`¡Hola, ${user.displayName}!`);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("Hubo un problema con el login");
    }
  };

  return (
    <div
  className="relative min-h-screen w-full flex items-center justify-center bg-cover bg-center"
  style={{ backgroundImage: "url('/grupoig.jpg')" }}
>
  {/* Overlay oscuro */}
  <div className="absolute inset-0 bg-black/50"></div>

  {/* Card */}
  <div className="relative bg-white/80 backdrop-blur-md p-10 rounded-2xl shadow-2xl w-full max-w-md text-center space-y-6">
    {/* Logo */}
    <img
      src="/logo.png" // coloca tu logo en public/logo.png
      alt="Logo Grupo IG"
      className="mx-auto w-20 h-20 mb-4"
    />

    {/* Título */}
    <h1 className="text-3xl font-bold text-gray-900">
      Bienvenido a <span className="text-green-600">SIRA</span>
    </h1>

    {/* Tagline */}
    <p className="text-gray-600 text-sm">
      Sistema Administrativo Grupo IG <br />
      <span className="text-gray-500 italic">
        “Eficiencia y control en un solo lugar”
      </span>
    </p>

    {/* Botón de Google */}
    <button
      onClick={handleLogin}
      className="w-full flex items-center justify-center gap-3 border border-gray-300 bg-white text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition duration-200 shadow-sm"
      aria-label="Iniciar sesión con Google"
    >
      <img
        src="https://www.svgrepo.com/show/355037/google.svg"
        alt="Google"
        className="w-5 h-5"
      />
      <span className="font-medium">Iniciar sesión con Google</span>
    </button>

    {/* Footer */}
    <p className="text-xs text-gray-500 mt-6">
      © {new Date().getFullYear()} Grupo IG — Todos los derechos reservados
    </p>
  </div>
</div>

  );
}
