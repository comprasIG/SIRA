// src/context/authContext.jsx
/*
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import api from "../api/api";
import { toast } from "react-toastify";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [funcionesPermitidas, setFuncionesPermitidas] = useState([]);
  const [cargandoUsuario, setCargandoUsuario] = useState(true);

  const logout = useCallback(async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      setUsuario(null);
      setFuncionesPermitidas([]);
      toast.info("Sesión cerrada.");
    } catch {
      toast.error("Error cerrando sesión.");
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUsuario(null);
        setFuncionesPermitidas([]);
        setCargandoUsuario(false);
        return;
      }

      setCargandoUsuario(true);
      try {
        const token = await user.getIdToken();
        const res = await api.get("/api/usuarios/self", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsuario(res);
        setFuncionesPermitidas(res.funciones || []);
        // Debug
        // console.log("AuthProvider usuario final:", res);
      } catch (err) {
        setUsuario(null);
        setFuncionesPermitidas([]);
        if (err?.response?.status === 403 || err?.response?.status === 404) {
          toast.error("Tu usuario no está autorizado o está inactivo en SIRA.");
          await logout();
        } else {
          toast.error("Error consultando usuario. Intenta de nuevo.");
        }
      } finally {
        setCargandoUsuario(false);
      }
    });

    return () => unsubscribe();
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        funcionesPermitidas,
        cargandoUsuario,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
*/

// src/context/authContext.jsx

import { createContext, useContext, useEffect, useState, useCallback } from "react";
// MODIFICADO: Se quita getAuth y se importa la instancia 'auth' directamente
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import api from "../api/api";
import { toast } from "react-toastify";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [funcionesPermitidas, setFuncionesPermitidas] = useState([]);
  const [cargandoUsuario, setCargandoUsuario] = useState(true);

  const logout = useCallback(async () => {
    try {
      // MODIFICADO: Ya no se llama a getAuth(), se usa la instancia importada
      await signOut(auth);
      setUsuario(null);
      setFuncionesPermitidas([]);
      toast.info("Sesión cerrada.");
    } catch {
      toast.error("Error cerrando sesión.");
    }
  }, []);

  useEffect(() => {
    // MODIFICADO: 'auth' ahora es la instancia importada, no es necesario volver a declararla.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUsuario(null);
        setFuncionesPermitidas([]);
        setCargandoUsuario(false);
        return;
      }

      setCargandoUsuario(true);
      try {
        const token = await user.getIdToken();
        const res = await api.get("/api/usuarios/self", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsuario(res);
        setFuncionesPermitidas(res.funciones || []);
      } catch (err) {
        setUsuario(null);
        setFuncionesPermitidas([]);
        if (err?.response?.status === 403 || err?.response?.status === 404) {
          toast.error("Tu usuario no está autorizado o está inactivo en SIRA.");
          await logout();
        } else {
          toast.error("Error consultando usuario. Intenta de nuevo.");
        }
      } finally {
        setCargandoUsuario(false);
      }
    });

    return () => unsubscribe();
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        funcionesPermitidas,
        cargandoUsuario,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);