// src/context/authContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import api from "../api/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [funcionesPermitidas, setFuncionesPermitidas] = useState([]);
  const [cargandoUsuario, setCargandoUsuario] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.warn("No hay usuario autenticado en Firebase.");
        setCargandoUsuario(false);
        return;
      }

      try {
        const token = await user.getIdToken(); // solo para asegurar consistencia
        const usuarioDesdeAPI = await api.get("/api/usuarios/self");
        setUsuario(usuarioDesdeAPI);
        setFuncionesPermitidas(usuarioDesdeAPI.funciones || []);
      } catch (err) {
        console.error("Error al obtener usuario desde API:", err);
      } finally {
        setCargandoUsuario(false);
      }
    });

    return () => unsubscribe(); // limpiamos el listener al desmontar
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, funcionesPermitidas, cargandoUsuario }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);