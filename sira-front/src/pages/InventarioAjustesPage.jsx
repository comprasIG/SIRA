// sira-front/src/pages/InventarioAjustesPage.jsx
/**
 * InventarioAjustesPage - UX mejorada para ajustes masivos (batch)
 * --------------------------------------------------------------------------------------
 * Objetivo:
 * - Permitir capturar DELTA (y OBS) por fila, en la misma tabla, con paginación.
 * - Guardar todos los cambios en un solo POST /api/inventario/ajustes
 * - Mantener ajustes "pendientes" aunque el usuario cambie de página o filtros.
 *
 * Reglas (alineadas con backend):
 * - observaciones: obligatorias (por fila o global).
 * - delta: número distinto de 0.
 * - precio/moneda solo si (disponible + asignado) == 0 y delta > 0.
 * - moneda default: MXN (si existe en catálogo de monedas).
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
  TablePagination,
  FormControlLabel,
  Switch,
  Stack,
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
  const { usuario } = useAuth();
  const isSuper = Boolean(usuario?.es_superusuario);

  /** Hook inventario en modo catálogo */
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

  /** Monedas */
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

  /** Ubicaciones (almacén) */
  const ubicaciones = useMemo(() => filterOptions?.ubicacionesAlmacen || [], [filterOptions]);
  const [ubicacionId, setUbicacionId] = useState("");

  // default ubicación: la primera disponible
  useEffect(() => {
    if (!ubicacionId && ubicaciones.length > 0) setUbicacionId(String(ubicaciones[0].id));
  }, [ubicaciones, ubicacionId]);

  /** Observaciones globales (obligatorias si la fila no trae obs propia) */
  const [observacionesGlobales, setObservacionesGlobales] = useState("");

  /**
   * Pending adjustments (persisten aunque cambies de página):
   * pendingById[material_id] = {
   *   delta: "1,5",
   *   observaciones: "",
   *   precio: "12.34",
   *   moneda: "MXN"
   * }
   */
  const [pendingById, setPendingById] = useState({});

  /** UI: paginación */
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(300);
  const [showOnlyPendings, setShowOnlyPendings] = useState(false);
  const rowsPerPageOptions = [50, 100, 300, 500, 1000];

  /** Mapa de filas por material_id para validaciones rápidas al guardar */
  const catalogoById = useMemo(() => {
    const m = new Map();
    (catalogoResumen || []).forEach((r) => m.set(r.material_id, r));
    return m;
  }, [catalogoResumen]);

  /** Moneda default (MXN si existe) */
  const defaultMoneda = useMemo(() => {
    const hasMXN = (monedas || []).some((m) => String(m.codigo).toUpperCase() === "MXN");
    if (hasMXN) return "MXN";
    // fallback: si no existe MXN, dejamos vacío (o primera moneda)
    return (monedas?.[0]?.codigo || "").toUpperCase();
  }, [monedas]);

  /** Cantidad de pendientes "reales" (delta != 0 y numérico) */
  const pendingCount = useMemo(() => {
    let c = 0;
    for (const v of Object.values(pendingById)) {
      const dn = parseNumberInput(v?.delta);
      if (Number.isFinite(dn) && dn !== 0) c++;
    }
    return c;
  }, [pendingById]);

  /** Lista base a renderizar (con opción "solo pendientes") */
  const listToRender = useMemo(() => {
    const list = catalogoResumen || [];
    if (!showOnlyPendings) return list;

    return list.filter((r) => {
      const p = pendingById[r.material_id];
      const dn = parseNumberInput(p?.delta);
      return Number.isFinite(dn) && dn !== 0;
    });
  }, [catalogoResumen, pendingById, showOnlyPendings]);

  /** Paginación (client-side) */
  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return listToRender.slice(start, end);
  }, [listToRender, page, rowsPerPage]);

  /** Helpers de regla de precio por fila */
  const rowTotalAntes = (row) => Number(row?.total_stock || 0) + Number(row?.total_asignado || 0);

  const canEditPriceForRow = (row, deltaStr) => {
    const totalAntes = rowTotalAntes(row);
    const dn = parseNumberInput(deltaStr);
    return totalAntes === 0 && Number.isFinite(dn) && dn > 0;
  };

  /** Handlers por fila */
  const setPendingField = (materialId, patch) => {
    setPendingById((prev) => ({
      ...prev,
      [materialId]: {
        delta: prev?.[materialId]?.delta ?? "",
        observaciones: prev?.[materialId]?.observaciones ?? "",
        precio: prev?.[materialId]?.precio ?? "",
        moneda: prev?.[materialId]?.moneda ?? "",
        ...patch,
      },
    }));
  };

  const handleDeltaChange = (row, value) => {
    const id = row.material_id;
    // set delta
    setPendingById((prev) => {
      const curr = prev[id] || { delta: "", observaciones: "", precio: "", moneda: "" };
      const next = { ...curr, delta: value };

      // Si ya no cumple regla, limpiar precio/moneda (y se bloquean inputs)
      const allowed = canEditPriceForRow(row, value);
      if (!allowed) {
        next.precio = "";
        next.moneda = "";
      } else {
        // si ahora sí cumple, setear moneda default si está vacía
        if (!next.moneda) next.moneda = defaultMoneda || "MXN";
      }

      return { ...prev, [id]: next };
    });
  };

  const handleClearPendings = () => {
    setPendingById({});
    toast.info("Pendientes limpiados.");
  };

  /** Guardar lote */
  const [guardando, setGuardando] = useState(false);

  const handleGuardarLote = async () => {
    if (!isSuper) return toast.error("No autorizado.");
    if (!ubicacionId) return toast.error("Selecciona ubicación (almacén).");

    const obsGlobal = (observacionesGlobales || "").trim();
    if (!obsGlobal) {
      // OJO: obs global es obligatoria SOLO cuando una fila no tenga obs propia.
      // Pero en la práctica, para masivo conviene forzar que exista, así garantizamos auditoría.
      // Si prefieres permitir obs solo por fila, dímelo y lo ajusto.
      return toast.error("Observaciones globales es obligatorio (se aplicará a filas sin observación propia).");
    }

    const errores = [];
    const ajustes = [];

    for (const [materialIdStr, p] of Object.entries(pendingById)) {
      const material_id = Number(materialIdStr);
      const row = catalogoById.get(material_id);

      // Si por alguna razón ya no existe en catálogo, lo saltamos con error visible
      if (!row) {
        const dn0 = parseNumberInput(p?.delta);
        if (Number.isFinite(dn0) && dn0 !== 0) {
          errores.push(`Material #${materialIdStr}: ya no está en catálogo visible. Refresca filtros.`);
        }
        continue;
      }

      const dn = parseNumberInput(p?.delta);
      if (!Number.isFinite(dn) || dn === 0) continue; // no se envía si no hay delta válido

      const obs = (p?.observaciones || "").trim() || obsGlobal;
      if (!obs) {
        errores.push(`SKU ${row.sku}: falta observación (fila o global).`);
        continue;
      }

      const payload = {
        material_id,
        delta: dn,
        ubicacion_id: Number(ubicacionId),
        observaciones: obs,
      };

      const allowedPrice = canEditPriceForRow(row, p?.delta);

      // precio/moneda solo si permitido
      const traePrecio = (p?.precio ?? "").toString().trim() !== "";
      const traeMoneda = (p?.moneda ?? "").toString().trim() !== "";

      if (traePrecio || traeMoneda) {
        if (!allowedPrice) {
          errores.push(`SKU ${row.sku}: precio/moneda no permitido (requiere total=0 y delta>0).`);
          continue;
        }
        const precioNum = parseNumberInput(p?.precio);
        if (!Number.isFinite(precioNum) || precioNum <= 0) {
          errores.push(`SKU ${row.sku}: precio inválido.`);
          continue;
        }

        const monedaStr = (p?.moneda || defaultMoneda || "").toString().trim().toUpperCase();
        if (!monedaStr || monedaStr.length !== 3) {
          errores.push(`SKU ${row.sku}: moneda inválida (ej. MXN).`);
          continue;
        }

        payload.ultimo_precio_entrada = precioNum;
        payload.moneda = monedaStr;
      }

      ajustes.push(payload);
    }

    if (errores.length > 0) {
      const top = errores.slice(0, 8).join("\n• ");
      toast.error(`Corrige antes de guardar:\n• ${top}${errores.length > 8 ? `\n… (${errores.length - 8} más)` : ""}`);
      return;
    }

    if (ajustes.length === 0) {
      return toast.info("No hay ajustes pendientes (delta válido ≠ 0).");
    }

    setGuardando(true);
    try {
      // el backend soporta tanto array directo como {ajustes:[...]}.
      await api.post("/api/inventario/ajustes", { ajustes });
      toast.success(`Ajustes aplicados: ${ajustes.length}`);

      // refrescar y mantener pendientes limpios (recomendado)
      await refreshCatalogoResumen();
      setPendingById({});
    } catch (e) {
      toast.error(e?.error || "Error al guardar ajustes.");
    } finally {
      setGuardando(false);
    }
  };

  /** Si cambian filtros, normalmente conviene volver a page 0 */
  useEffect(() => {
    setPage(0);
  }, [filters, showOnlyPendings, rowsPerPage]);

  return (
    <Box sx={{ px: 3, pb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: "bold" }}>
        Ajustes de Inventario (Batch)
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
          Captura <b>delta</b> por fila y guarda en lote.{" "}
          <b>Precio/moneda</b> se habilita solo si <b>(disponible + asignado) = 0</b> y <b>delta &gt; 0</b>.
        </Typography>
        {!isSuper && (
          <Typography sx={{ fontSize: 13, mt: 1, color: "error.main" }}>
            No autorizado: solo superusuario puede realizar ajustes.
          </Typography>
        )}
      </Paper>

      {/* Controles globales */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Ubicación (almacén) - Global"
              value={ubicacionId}
              onChange={(e) => setUbicacionId(e.target.value)}
              fullWidth
              size="small"
              disabled={ubicaciones.length === 0 || !isSuper}
              helperText={ubicaciones.length === 0 ? "No hay ubicaciones_almacen cargadas." : ""}
            >
              {ubicaciones.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={7}>
            <TextField
              label="Observaciones globales (obligatorio)"
              value={observacionesGlobales}
              onChange={(e) => setObservacionesGlobales(e.target.value)}
              fullWidth
              size="small"
              disabled={!isSuper}
              placeholder="Ej: Corrección por conteo físico"
            />
            <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.5 }}>
              Se aplicará a las filas que no tengan observación propia.
            </Typography>
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              onClick={handleGuardarLote}
              disabled={!isSuper || guardando || pendingCount === 0}
              fullWidth
            >
              {guardando ? "Guardando..." : `Guardar (${pendingCount})`}
            </Button>
            <Button
              variant="text"
              onClick={handleClearPendings}
              disabled={!isSuper || guardando || Object.keys(pendingById).length === 0}
              fullWidth
              sx={{ mt: 1 }}
            >
              Limpiar pendientes
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <FormControlLabel
                control={
                  <Switch
                    checked={showOnlyPendings}
                    onChange={(e) => setShowOnlyPendings(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Mostrar solo pendientes"
              />
              <Typography sx={{ fontSize: 13, opacity: 0.8 }}>
                Pendientes: <b>{pendingCount}</b> | Filas visibles: <b>{listToRender.length}</b> | Página:{" "}
                <b>{page + 1}</b>
              </Typography>
            </Stack>
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

      {/* Tabla editable */}
      <Paper sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: "bold", mb: 1 }}>
          Catálogo activo (edita delta/obs por fila y guarda en lote)
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

              <TableCell sx={{ fontWeight: "bold", width: 140 }}>Delta</TableCell>
              <TableCell sx={{ fontWeight: "bold", minWidth: 220 }}>Obs (opcional)</TableCell>
              <TableCell sx={{ fontWeight: "bold", width: 160 }}>Precio</TableCell>
              <TableCell sx={{ fontWeight: "bold", width: 120 }}>Moneda</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10}>Cargando catálogo...</TableCell>
              </TableRow>
            ) : listToRender.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10}>No hay resultados con esos filtros.</TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row) => {
                const p = pendingById[row.material_id] || { delta: "", observaciones: "", precio: "", moneda: "" };
                const allowedPrice = canEditPriceForRow(row, p.delta);

                return (
                  <TableRow key={row.material_id} hover sx={{ verticalAlign: "top" }}>
                    <TableCell>{row.sku}</TableCell>

                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.material_nombre}</Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.7 }}>#{row.material_id}</Typography>
                    </TableCell>

                    <TableCell align="right">{row.total_stock}</TableCell>
                    <TableCell align="right">{row.total_asignado}</TableCell>
                    <TableCell align="right">{row.total_existencia}</TableCell>
                    <TableCell>{row.unidad_simbolo}</TableCell>

                    {/* Delta */}
                    <TableCell>
                      <TextField
                        value={p.delta}
                        onChange={(e) => handleDeltaChange(row, e.target.value)}
                        size="small"
                        fullWidth
                        disabled={!isSuper}
                        placeholder="Ej: 5, -2, 1.5"
                      />
                    </TableCell>

                    {/* Obs por fila (opcional; si vacío usa global) */}
                    <TableCell>
                      <TextField
                        value={p.observaciones}
                        onChange={(e) => setPendingField(row.material_id, { observaciones: e.target.value })}
                        size="small"
                        fullWidth
                        disabled={!isSuper}
                        placeholder="(si vacío, usa obs global)"
                      />
                    </TableCell>

                    {/* Precio (bloqueado si no cumple regla) */}
                    <TableCell>
                      <TextField
                        value={p.precio}
                        onChange={(e) => setPendingField(row.material_id, { precio: e.target.value })}
                        size="small"
                        fullWidth
                        disabled={!isSuper || !allowedPrice}
                        placeholder={allowedPrice ? "Ej: 55.12 ó 55,12" : "No permitido"}
                      />
                      {!allowedPrice && (p.precio || p.moneda) ? (
                        <Typography sx={{ fontSize: 11, color: "error.main", mt: 0.5 }}>
                          Precio/moneda bloqueado.
                        </Typography>
                      ) : null}
                    </TableCell>

                    {/* Moneda (default MXN) */}
                    <TableCell>
                      <TextField
                        select
                        value={(p.moneda || (allowedPrice ? defaultMoneda || "MXN" : "")).toUpperCase()}
                        onChange={(e) => setPendingField(row.material_id, { moneda: e.target.value })}
                        size="small"
                        fullWidth
                        disabled={!isSuper || !allowedPrice || loadingMonedas}
                      >
                        <MenuItem value="">---</MenuItem>
                        {monedas.map((m) => (
                          <MenuItem key={m.codigo} value={String(m.codigo).toUpperCase()}>
                            {String(m.codigo).toUpperCase()}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Paginación */}
        <TablePagination
          component="div"
          count={listToRender.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={rowsPerPageOptions}
          labelRowsPerPage="Filas por página"
        />
      </Paper>
    </Box>
  );
}
