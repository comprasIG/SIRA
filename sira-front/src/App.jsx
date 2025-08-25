// src/App.jsx
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/firebase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import G_REQ from "./pages/G_REQ";
import MainLayout from "./components/layout/MainLayout";
import PrivateRoute from "./components/routing/PrivateRoute";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Cargando...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Ruta pública de login */}
        <Route path="/login" element={<Login user={user} />} />

        {/* Dashboard protegido */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute user={user}>
              <MainLayout userName={user?.displayName || user?.email || ""}>
                <Dashboard user={user} />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* Requisiciones protegido */}
        <Route
          path="/G_REQ"
          element={
            <PrivateRoute user={user}>
              <MainLayout userName={user?.displayName || user?.email || ""}>
                <G_REQ />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* Redirecciones */}
        <Route
          path="/"
          element={
            user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="*"
          element={
            user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </Router>
  );
}
