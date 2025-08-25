// src/App.jsx
import React, { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/firebase";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import G_REQ from "./pages/G_REQ";
import VB_REQ from "./pages/VB_REQ";
import G_RFQ from "./pages/G_RFQ";
import VB_RFQ from "./pages/VB_RFQ";
import G_OC from "./pages/G_OC";
import VB_OC from "./pages/VB_OC";
import PAY_OC from "./pages/PAY_OC";
import REC_OC from "./pages/REC_OC";
import ING_OC from "./pages/ING_OC";
import USUARIOS from "./pages/USUARIOS";
import Error403 from "./pages/Error403";
import Error404 from "./pages/Error404";

// Layout y protección
import MainLayout from "./components/layout/MainLayout";
import RutaProtegida from "./routes/RutaProtegida";

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
      <div className="flex items-center justify-center h-screen">Cargando...</div>
    );
  }

  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<Login user={user} />} />

          <Route
            path="/dashboard"
            element={
              <MainLayout>
                <Dashboard />
              </MainLayout>
            }
          />
          <Route
            path="/G_REQ"
            element={
              <RutaProtegida permiso="G_REQ">
                <MainLayout>
                  <G_REQ />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/VB_REQ"
            element={
              <RutaProtegida permiso="VB_REQ">
                <MainLayout>
                  <VB_REQ />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/G_RFQ"
            element={
              <RutaProtegida permiso="G_RFQ">
                <MainLayout>
                  <G_RFQ />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/VB_RFQ"
            element={
              <RutaProtegida permiso="VB_RFQ">
                <MainLayout>
                  <VB_RFQ />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/G_OC"
            element={
              <RutaProtegida permiso="G_OC">
                <MainLayout>
                  <G_OC />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/VB_OC"
            element={
              <RutaProtegida permiso="VB_OC">
                <MainLayout>
                  <VB_OC />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/PAY_OC"
            element={
              <RutaProtegida permiso="PAY_OC">
                <MainLayout>
                  <PAY_OC />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/REC_OC"
            element={
              <RutaProtegida permiso="REC_OC">
                <MainLayout>
                  <REC_OC />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/ING_OC"
            element={
              <RutaProtegida permiso="ING_OC">
                <MainLayout>
                  <ING_OC />
                </MainLayout>
              </RutaProtegida>
            }
          />
          <Route
            path="/USUARIOS"
            element={
              <RutaProtegida permiso="USUARIOS">
                <MainLayout>
                  <USUARIOS />
                </MainLayout>
              </RutaProtegida>
            }
          />

          <Route path="/403" element={<Error403 />} />
          <Route path="*" element={<Error404 />} />
          <Route
            path="/"
            element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
          />
        </Routes>
      </Router>

      <ToastContainer position="top-right" autoClose={5000} />
    </>
  );
}