// sira-front/src/pages/InventarioPage.jsx
import React, { useMemo } from "react";
import { Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Box, Typography, Tabs, Tab } from "@mui/material";
import { useAuth } from "../context/authContext";

import InventarioForm from "../components/almacen/InventarioForm";
import InventarioKardexPage from "./InventarioKardexPage";
import InventarioAjustesPage from "./InventarioAjustesPage";

export default function InventarioPage() {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const tabValue = useMemo(() => {
    const path = location.pathname.toUpperCase();
    if (path.includes("/INV/KARDEX")) return "KARDEX";
    if (path.includes("/INV/AJUSTES")) return "AJUSTES";
    return "CONSULTA";
  }, [location.pathname]);

  const handleTabChange = (_, newValue) => {
    if (newValue === "CONSULTA") navigate("/INV");
    if (newValue === "KARDEX") navigate("/INV/KARDEX");
    if (newValue === "AJUSTES") navigate("/INV/AJUSTES");
  };

  const showAjustes = Boolean(usuario?.es_superusuario);

  return (
    <Box>
      <Typography variant="h4" sx={{ p: 3, fontWeight: "bold" }}>
        Inventario
      </Typography>

      <Box sx={{ px: 3, pb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Consulta" value="CONSULTA" />
          <Tab label="Kardex" value="KARDEX" />
          {showAjustes && <Tab label="Ajustes" value="AJUSTES" />}
        </Tabs>
      </Box>

      <Routes>
        <Route
          index
          element={
            <>
              <Typography variant="h6" sx={{ px: 3, pb: 1, fontWeight: "bold" }}>
                Consulta de Inventario
              </Typography>
              <InventarioForm />
            </>
          }
        />

        <Route path="KARDEX" element={<InventarioKardexPage />} />

        {/* Ajustes: por ahora placeholder, solo superuser */}
        <Route
          path="AJUSTES"
          element={
            showAjustes ? <InventarioAjustesPage /> : <Navigate to="/403" replace />
          }
        />

        {/* Si alguien cae en /INV/loquesea */}
        <Route path="*" element={<Navigate to="/INV" replace />} />
      </Routes>
    </Box>
  );
}
