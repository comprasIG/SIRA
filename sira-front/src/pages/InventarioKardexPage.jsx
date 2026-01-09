// sira-front/src/pages/InventarioKardexPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { toast } from "react-toastify";
import api from "../api/api";
import { useAuth } from "../context/authContext";
import { useInventario } from "../hooks/useInventario";

const TIPOS = [
  "",
  "ENTRADA",
  "SALIDA",
  "APARTADO",
  "LIBERADO",
  "TRASPASO",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
];

function formatDateTime(value) {
  try {
    return new Date(value).toLocaleString("es-MX");
  } catch {
    return value;
  }
}

export default function InventarioKardexPage() {
  const { usuario } = useAuth();
  const isSuper = Boolean(usuario?.es_superusuario);

  // Reusamos el hook SOLO para opciones de proyectos/sitios (sin tocar la lista principal)
  const { filterOptions } = useInventario();

  const proyectos = useMemo(() => {
    // en tu hook vienen todosProyectos / proyectos
    const arr = filterOptions?.todosProyectos?.length ? filterOptions.todosProyectos : (filterOptions?.proyectos || []);
    return arr || [];
  }, [filterOptions]);

  const [filters, setFilters] = useState({
    materialId: "",
    proyectoId: "",
    tipoMovimiento: "",
    fechaInicio: "",
    fechaFin: "",
    includeAnulados: false,
    q: "",
  });

  const [data, setData] = useState({ rows: [], total: 0, limit: 100, offset: 0 });
  const [loading, setLoading] = useState(false);

  // Reversa modal
  const [openRev, setOpenRev] = useState(false);
  const [revMotivo, setRevMotivo] = useState("");
  const [revRow, setRevRow] = useState(null);
  const [reversando, setReversando] = useState(false);

  const canRevertRow = useCallback(
    (row) => {
      if (!isSuper) return false;
      if (!row) return false;
      if (row.estado && row.estado !== "ACTIVO") return false;
      if (row.reversa_de_movimiento_id) return false;
      return ["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "SALIDA"].includes(row.tipo_movimiento);
    },
    [isSuper]
  );

  const buildQuery = useCallback((offset = 0) => {
    const params = new URLSearchParams();
    if (filters.materialId) params.set("materialId", filters.materialId);
    if (filters.proyectoId) params.set("proyectoId", filters.proyectoId);
    if (filters.tipoMovimiento) params.set("tipoMovimiento", filters.tipoMovimiento);
    if (filters.fechaInicio) params.set("fechaInicio", filters.fechaInicio);
    if (filters.fechaFin) params.set("fechaFin", filters.fechaFin);
    if (filters.q) params.set("q", filters.q);
    if (filters.includeAnulados) params.set("includeAnulados", "true");
    params.set("limit", String(data.limit || 100));
    params.set("offset", String(offset));
    return params.toString();
  }, [filters, data.limit]);

  const fetchKardex = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const query = buildQuery(offset);
      const res = await api.get(`/api/inventario/kardex?${query}`);
      setData(res);
    } catch (err) {
      toast.error(err?.error || "Error al cargar Kardex.");
      setData({ rows: [], total: 0, limit: 100, offset: 0 });
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchKardex(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleBuscar = () => fetchKardex(0);

  const handlePrev = () => {
    const newOffset = Math.max((data.offset || 0) - (data.limit || 100), 0);
    fetchKardex(newOffset);
  };

  const handleNext = () => {
    const newOffset = (data.offset || 0) + (data.limit || 100);
    if (newOffset >= (data.total || 0)) return;
    fetchKardex(newOffset);
  };

  const openReversa = (row) => {
    setRevRow(row);
    setRevMotivo("");
    setOpenRev(true);
  };

  const closeReversa = () => {
    setOpenRev(false);
    setRevRow(null);
    setRevMotivo("");
  };

  const confirmarReversa = async () => {
    if (!revRow) return;
    if (!revMotivo.trim()) {
      toast.error("Motivo es requerido.");
      return;
    }
    setReversando(true);
    try {
      await api.post(`/api/inventario/movimientos/${revRow.id}/reversar`, { motivo: revMotivo.trim() });
      toast.success(`Movimiento #${revRow.id} reversado.`);
      closeReversa();
      // recargar la misma página
      fetchKardex(data.offset || 0);
    } catch (err) {
      toast.error(err?.error || "Error al reversar movimiento.");
    } finally {
      setReversando(false);
    }
  };

  return (
    <Box sx={{ px: 3, pb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: "bold" }}>
        Kardex
      </Typography>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Material ID"
              value={filters.materialId}
              onChange={handleChange("materialId")}
              fullWidth
              size="small"
              placeholder="Ej: 123"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Proyecto"
              value={filters.proyectoId}
              onChange={handleChange("proyectoId")}
              fullWidth
              size="small"
            >
              <MenuItem value="">Todos</MenuItem>
              {proyectos.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              select
              label="Tipo"
              value={filters.tipoMovimiento}
              onChange={handleChange("tipoMovimiento")}
              fullWidth
              size="small"
            >
              {TIPOS.map((t) => (
                <MenuItem key={t || "ALL"} value={t}>
                  {t ? t : "Todos"}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={6} sm={2}>
            <TextField
              label="Desde"
              type="date"
              value={filters.fechaInicio}
              onChange={handleChange("fechaInicio")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={6} sm={2}>
            <TextField
              label="Hasta"
              type="date"
              value={filters.fechaFin}
              onChange={handleChange("fechaFin")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Buscar (texto)"
              value={filters.q}
              onChange={handleChange("q")}
              fullWidth
              size="small"
              placeholder="Busca por observaciones (por ahora)"
            />
          </Grid>

          <Grid item xs={12} sm={6} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField
              select
              label="Incluir anulados"
              value={filters.includeAnulados ? "SI" : "NO"}
              onChange={(e) => setFilters((p) => ({ ...p, includeAnulados: e.target.value === "SI" }))}
              size="small"
              sx={{ width: 180 }}
            >
              <MenuItem value="NO">No</MenuItem>
              <MenuItem value="SI">Sí</MenuItem>
            </TextField>

            <Button variant="contained" onClick={handleBuscar} disabled={loading}>
              Buscar
            </Button>

            <Typography sx={{ ml: "auto", fontSize: 13, opacity: 0.8 }}>
              Total: {data.total || 0}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabla */}
      <Paper>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Material</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Cantidad</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Proyecto Origen</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Proyecto Destino</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Ubicación</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Obs.</TableCell>
                <TableCell align="center" sx={{ fontWeight: "bold" }}>Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Box sx={{ py: 3 }}>
                      <CircularProgress size={22} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (data.rows || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Box sx={{ py: 3 }}>
                      <Typography>No hay movimientos con esos filtros.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                (data.rows || []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{formatDateTime(row.fecha)}</TableCell>
                    <TableCell>{row.tipo_movimiento}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                        #{row.material_id}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                        {row.material_descripcion || ""}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{row.cantidad}</TableCell>
                    <TableCell>{row.proyecto_origen_nombre || "-"}</TableCell>
                    <TableCell>{row.proyecto_destino_nombre || "-"}</TableCell>
                    <TableCell>{row.ubicacion_nombre || row.ubicacion_id || "-"}</TableCell>
                    <TableCell>{row.estado || "ACTIVO"}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, maxWidth: 260 }} noWrap title={row.observaciones || ""}>
                        {row.observaciones || ""}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {canRevertRow(row) ? (
                        <Button size="small" color="warning" variant="outlined" onClick={() => openReversa(row)}>
                          Reversar
                        </Button>
                      ) : (
                        <Typography sx={{ fontSize: 12, opacity: 0.6 }}>-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Paginación */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5 }}>
          <Typography sx={{ fontSize: 13, opacity: 0.8 }}>
            Mostrando {Math.min((data.offset || 0) + 1, data.total || 0)} -{" "}
            {Math.min((data.offset || 0) + (data.limit || 100), data.total || 0)}
          </Typography>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={handlePrev} disabled={loading || (data.offset || 0) === 0}>
              Anterior
            </Button>
            <Button
              variant="outlined"
              onClick={handleNext}
              disabled={loading || ((data.offset || 0) + (data.limit || 100)) >= (data.total || 0)}
            >
              Siguiente
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Modal reversa */}
      <Dialog open={openRev} onClose={closeReversa} maxWidth="sm" fullWidth>
        <DialogTitle>Reversar movimiento</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 13, opacity: 0.8 }}>
            Movimiento #{revRow?.id} ({revRow?.tipo_movimiento}) — Cantidad: {revRow?.cantidad}
          </Typography>

          <TextField
            label="Motivo"
            value={revMotivo}
            onChange={(e) => setRevMotivo(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Ej: Captura incorrecta"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReversa} disabled={reversando}>Cancelar</Button>
          <Button onClick={confirmarReversa} variant="contained" color="warning" disabled={reversando}>
            {reversando ? "Reversando..." : "Confirmar reversa"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
