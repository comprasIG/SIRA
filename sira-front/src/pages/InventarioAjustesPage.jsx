// sira-front/src/pages/InventarioAjustesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Divider,
} from "@mui/material";
import { toast } from "react-toastify";

import api from "../api/api";
import { useAuth } from "../context/authContext";
import { useInventario } from "../hooks/useInventario";
import InventarioItemRow from "../components/almacen/InventarioItemRow";
import FiltrosInventario from "../components/almacen/FiltrosInventario";

export default function InventarioAjustesPage() {
  const { usuario } = useAuth();
  const isSuper = Boolean(usuario?.es_superusuario);

  const {
    inventario,
    loading,
    error,
    filters,
    setFilters,
    filterOptions,
    refreshInventario,
  } = useInventario();

  // Monedas desde backend (tu endpoint existe)
  const [monedas, setMonedas] = useState([]);
  const [loadingMonedas, setLoadingMonedas] = useState(false);

  // Form
  const [selected, setSelected] = useState(null); // row inventario_actual
  const [delta, setDelta] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [ubicacionId, setUbicacionId] = useState("");
  const [precio, setPrecio] = useState("");
  const [moneda, setMoneda] = useState("");

  const [guardando, setGuardando] = useState(false);

  // Ubicaciones de almacén: en tu proyecto viene en datos iniciales del inventario
  const ubicaciones = useMemo(() => {
    return filterOptions?.ubicacionesAlmacen || filterOptions?.ubicaciones || [];
  }, [filterOptions]);

  useEffect(() => {
    // cargar monedas
    const load = async () => {
      try {
        setLoadingMonedas(true);
        const res = await api.get("/api/monedas");
        setMonedas(res || []);
      } catch (e) {
        toast.error(e?.error || "No se pudo cargar monedas.");
        setMonedas([]);
      } finally {
        setLoadingMonedas(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;

    // por default: usa ubicación de la fila si existe
    setUbicacionId(selected.ubicacion_id ?? "");

    // resetea inputs secundarios
    setDelta("");
    setObservaciones("");
    setPrecio("");
    setMoneda("");
  }, [selected]);

  const totalAntes = useMemo(() => {
    if (!selected) return 0;
    const stock = Number(selected.stock_actual || 0);
    const asignado = Number(selected.asignado || 0);
    return stock + asignado;
  }, [selected]);

  const deltaNum = useMemo(() => {
    const n = Number(delta);
    return Number.isFinite(n) ? n : NaN;
  }, [delta]);

  const puedeEditarPrecio = useMemo(() => {
    return selected && totalAntes === 0 && Number.isFinite(deltaNum) && deltaNum > 0;
  }, [selected, totalAntes, deltaNum]);

  const handleGuardar = async () => {
    if (!isSuper) {
      toast.error("No autorizado.");
      return;
    }
    if (!selected) {
      toast.error("Selecciona un material de la tabla.");
      return;
    }
    if (!ubicacionId) {
      toast.error("Selecciona una ubicación de almacén.");
      return;
    }
    if (!Number.isFinite(deltaNum) || deltaNum === 0) {
      toast.error("Delta debe ser un número distinto de 0.");
      return;
    }
    if (!observaciones.trim()) {
      toast.error("Observaciones es obligatorio.");
      return;
    }

    // Regla precio/moneda
    const payload = {
      material_id: selected.material_id,
      delta: deltaNum,
      ubicacion_id: Number(ubicacionId),
      observaciones: observaciones.trim(),
    };

    if (puedeEditarPrecio) {
      // Solo mandamos si el user llenó ambos (en backend no permitimos moneda sola)
      if (precio !== "" || moneda !== "") {
        const p = Number(precio);
        if (!Number.isFinite(p) || p <= 0) {
          toast.error("Precio inválido.");
          return;
        }
        if (!moneda) {
          toast.error("Moneda es obligatoria si capturas precio.");
          return;
        }
        payload.ultimo_precio_entrada = p;
        payload.moneda = moneda;
      }
    }

    setGuardando(true);
    try {
      await api.post("/api/inventario/ajustes", payload);
      toast.success("Ajuste aplicado.");

      // refrescar inventario
      await refreshInventario();

      // limpiar
      setSelected(null);
      setDelta("");
      setObservaciones("");
      setPrecio("");
      setMoneda("");
      setUbicacionId("");

    } catch (e) {
      toast.error(e?.error || "Error al guardar ajuste.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box sx={{ px: 3, pb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: "bold" }}>
        Ajustes de Inventario
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 13, opacity: 0.8 }}>
          Ajustes manuales (delta) solo sobre <b>stock disponible</b>. Requiere observaciones.
          Precio/moneda solo se habilita cuando <b>(disponible + asignado) = 0</b> y el delta es positivo.
        </Typography>
      </Paper>

      {/* Formulario */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              label="Material seleccionado"
              value={selected ? `#${selected.material_id} - ${selected.material_descripcion || ""}` : ""}
              fullWidth
              size="small"
              disabled
              placeholder="Selecciona una fila abajo"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Ubicación (almacén)"
              value={ubicacionId}
              onChange={(e) => setUbicacionId(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">Seleccionar...</MenuItem>
              {ubicaciones.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              label="Delta"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              fullWidth
              size="small"
              placeholder="Ej: 5 o -2"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleGuardar}
              disabled={guardando || !selected}
              fullWidth
            >
              {guardando ? "Guardando..." : "Guardar ajuste"}
            </Button>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Observaciones (obligatorio)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
              placeholder="Ej: Corrección por conteo físico"
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              label="Precio unitario (solo si permitido)"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              fullWidth
              size="small"
              disabled={!puedeEditarPrecio}
              placeholder={puedeEditarPrecio ? "Ej: 55.1234" : "No permitido"}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Moneda"
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              fullWidth
              size="small"
              disabled={!puedeEditarPrecio || loadingMonedas}
            >
              <MenuItem value="">Seleccionar...</MenuItem>
              {monedas.map((m) => (
                <MenuItem key={m.codigo} value={m.codigo}>
                  {m.codigo} - {m.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 1.5, bgcolor: "#fafafa" }} variant="outlined">
              <Typography sx={{ fontSize: 12 }}>
                <b>Regla precio:</b> {puedeEditarPrecio ? "Habilitado" : "Bloqueado"}
              </Typography>
              {selected && (
                <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                  Stock: {selected.stock_actual} | Asignado: {selected.asignado} | Total: {totalAntes}
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* Filtros + Tabla (selección) */}
      <Paper sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: "bold", mb: 1 }}>Selecciona un material</Typography>

        <FiltrosInventario
          filters={filters}
          setFilters={setFilters}
          filterOptions={filterOptions}
          onBuscar={refreshInventario}
        />

        {error && (
          <Typography sx={{ color: "error.main", mt: 1 }}>
            {error}
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Typography>Cargando inventario...</Typography>
          ) : (
            (inventario || []).map((row) => (
              <Box
                key={row.id}
                onClick={() => setSelected(row)}
                sx={{
                  border: selected?.id === row.id ? "2px solid #1976d2" : "1px solid #e0e0e0",
                  borderRadius: 2,
                  mb: 1,
                  cursor: "pointer",
                }}
              >
                <InventarioItemRow item={row} />
              </Box>
            ))
          )}
        </Box>
      </Paper>
    </Box>
  );
}
