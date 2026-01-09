// sira-front/src/pages/InventarioAjustesPage.jsx
/**
 * Página: InventarioAjustesPage (Paso 9C)
 * --------------------------------------------------------------------------------------
 * Cambios clave:
 * - ✅ Ahora usa useInventario({ mode: "catalogo" }) y consume /api/inventario/catalogo-resumen
 *   -> muestra TODO el catálogo activo (incluye ceros y materiales que aún no existen en inventario_actual)
 * - ✅ Permite crear stock para que empiece a existir en inventario_actual mediante POST /ajustes
 * - ✅ UX: delta/precio aceptan coma "1,5"
 */

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
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import { toast } from "react-toastify";

import api from "../api/api";
import { useAuth } from "../context/authContext";
import { useInventario } from "../hooks/useInventario";
import FiltrosInventario from "../components/almacen/FiltrosInventario";

/** Parser tolerante (coma -> punto) */
const parseNumberInput = (v) => {
  const s = (v ?? "").toString().trim().replace(",", ".");
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export default function InventarioAjustesPage() {
  /** ---------------------------------------------
   * Auth / permisos
   * --------------------------------------------- */
  const { usuario } = useAuth();
  const isSuper = Boolean(usuario?.es_superusuario);

  /** ---------------------------------------------
   * Hook inventario en modo catálogo (Paso 9C)
   * --------------------------------------------- */
  const {
    catalogoResumen,
    loading,
    error,
    filters,
    setFilters,
    filterOptions,
    resetFilters,
    refreshCatalogoResumen,
  } = useInventario({ mode: "catalogo" });

  /** ---------------------------------------------
   * Catálogo monedas
   * --------------------------------------------- */
  const [monedas, setMonedas] = useState([]);
  const [loadingMonedas, setLoadingMonedas] = useState(false);

  useEffect(() => {
    const loadMonedas = async () => {
      try {
        setLoadingMonedas(true);
        const res = await api.get("/api/monedas");
        setMonedas(Array.isArray(res) ? res : []);
      } catch (e) {
        toast.error(e?.error || "No se pudo cargar monedas.");
        setMonedas([]);
      } finally {
        setLoadingMonedas(false);
      }
    };
    loadMonedas();
  }, []);

  /** ---------------------------------------------
   * Form Ajustes
   * --------------------------------------------- */
  const [selected, setSelected] = useState(null);
  const [delta, setDelta] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const ubicaciones = useMemo(() => {
    return filterOptions?.ubicacionesAlmacen || [];
  }, [filterOptions]);

  const [ubicacionId, setUbicacionId] = useState("");
  const [precio, setPrecio] = useState("");
  const [moneda, setMoneda] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Al seleccionar material: reset inputs y default ubicación
  useEffect(() => {
    if (!selected) return;

    setDelta("");
    setObservaciones("");
    setPrecio("");
    setMoneda("");

    if (ubicaciones.length > 0) setUbicacionId(String(ubicaciones[0].id));
    else setUbicacionId("");
  }, [selected, ubicaciones]);

  /** ---------------------------------------------
   * Reglas precio/moneda (mismas del backend)
   * - totalAntes = disponible + apartado
   * - puedeEditarPrecio: totalAntes==0 y delta>0
   * --------------------------------------------- */
  const totalAntes = useMemo(() => {
    if (!selected) return 0;
    const stock = Number(selected.total_stock || 0);
    const asignado = Number(selected.total_asignado || 0);
    return stock + asignado;
  }, [selected]);

  const deltaNum = useMemo(() => parseNumberInput(delta), [delta]);

  const puedeEditarPrecio = useMemo(() => {
    return selected && totalAntes === 0 && Number.isFinite(deltaNum) && deltaNum > 0;
  }, [selected, totalAntes, deltaNum]);

  /** ---------------------------------------------
   * Guardar ajuste
   * --------------------------------------------- */
  const handleGuardar = async () => {
    if (!isSuper) return toast.error("No autorizado.");
    if (!selected) return toast.error("Selecciona un material de la tabla.");
    if (!ubicacionId) return toast.error("Selecciona ubicación (almacén).");
    if (!Number.isFinite(deltaNum) || deltaNum === 0) return toast.error("Delta debe ser un número distinto de 0.");
    if (!observaciones.trim()) return toast.error("Observaciones es obligatorio.");

    const payload = {
      material_id: selected.material_id,
      delta: deltaNum,
      ubicacion_id: Number(ubicacionId),
      observaciones: observaciones.trim(),
    };

    // Precio/moneda solo si permitido (backend valida igual)
    if (puedeEditarPrecio) {
      const traePrecio = precio !== "";
      const traeMoneda = moneda !== "";

      if (traePrecio || traeMoneda) {
        const p = parseNumberInput(precio);
        if (!Number.isFinite(p) || p <= 0) return toast.error("Precio inválido.");
        if (!moneda) return toast.error("Moneda es obligatoria si capturas precio.");
        payload.ultimo_precio_entrada = p;
        payload.moneda = moneda;
      }
    }

    setGuardando(true);
    try {
      await api.post("/api/inventario/ajustes", payload);
      toast.success("Ajuste aplicado.");

      // ✅ refrescar catálogo resumen y mantener selección si sigue visible
      const materialId = selected.material_id;
      const newList = await refreshCatalogoResumen();
      const updated = (newList || []).find((r) => r.material_id === materialId);

      setSelected(updated || null);

      // limpiar inputs
      setDelta("");
      setObservaciones("");
      setPrecio("");
      setMoneda("");

      if (!updated) {
        toast.info("Ajuste aplicado, pero el material ya no aparece con los filtros actuales.");
      }
    } catch (e) {
      toast.error(e?.error || "Error al guardar ajuste.");
    } finally {
      setGuardando(false);
    }
  };

  /** ---------------------------------------------
   * Render
   * --------------------------------------------- */
  return (
    <Box sx={{ px: 3, pb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: "bold" }}>
        Ajustes de Inventario
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 13, opacity: 0.8 }}>
          Ajustes manuales (delta) sobre <b>stock disponible</b>. Requiere observaciones.
          Precio/moneda se habilita cuando <b>(disponible + asignado) = 0</b> y <b>delta &gt; 0</b>.
        </Typography>
      </Paper>

      {/* Form */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              label="Material seleccionado"
              value={
                selected
                  ? `${selected.sku || ""} — ${selected.material_nombre || ""} (#${selected.material_id})`
                  : ""
              }
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
              disabled={ubicaciones.length === 0}
              helperText={ubicaciones.length === 0 ? "No hay ubicaciones_almacen cargadas." : ""}
            >
              {ubicaciones.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
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
              placeholder="Ej: 5, -2, 1.5, 1,5"
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Button variant="contained" onClick={handleGuardar} disabled={guardando || !selected} fullWidth>
              {guardando ? "Guardando..." : "Guardar"}
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
              placeholder={puedeEditarPrecio ? "Ej: 55.1234 ó 55,1234" : "No permitido"}
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
                  Disponible: {selected.total_stock} | Apartado: {selected.total_asignado} | Total: {totalAntes}
                </Typography>
              )}
              {!Number.isFinite(deltaNum) && delta !== "" && (
                <Typography sx={{ fontSize: 12, color: "error.main" }}>
                  Delta inválido (usa números; acepto coma o punto).
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <FiltrosInventario
          filters={filters}
          onFilterChange={(newFilters) => setFilters(newFilters)}
          onReset={resetFilters}
          filterOptions={filterOptions || { sitios: [], proyectos: [] }}
        />

        {error && (
          <Typography sx={{ color: "error.main", mt: 1 }}>
            {error}
          </Typography>
        )}
      </Paper>

      {/* Tabla */}
      <Paper sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: "bold", mb: 1 }}>
          Selecciona un material (catálogo activo completo)
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Material</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                Disponible
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                Apartado
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                Total
              </TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Unidad</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>Cargando catálogo...</TableCell>
              </TableRow>
            ) : (catalogoResumen || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No hay resultados con esos filtros.</TableCell>
              </TableRow>
            ) : (
              (catalogoResumen || []).map((row) => {
                const isSel = selected?.material_id === row.material_id;
                return (
                  <TableRow
                    key={row.material_id}
                    hover
                    onClick={() => setSelected(row)}
                    sx={{
                      cursor: "pointer",
                      bgcolor: isSel ? "rgba(25, 118, 210, 0.08)" : "transparent",
                    }}
                  >
                    <TableCell>{row.sku}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.material_nombre}</Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.7 }}>#{row.material_id}</Typography>
                    </TableCell>
                    <TableCell align="right">{row.total_stock}</TableCell>
                    <TableCell align="right">{row.total_asignado}</TableCell>
                    <TableCell align="right">{row.total_existencia}</TableCell>
                    <TableCell>{row.unidad_simbolo}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
