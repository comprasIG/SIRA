// sira-front/src/pages/InventarioKardexPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
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
  Autocomplete,
  Chip,
  Divider,
  Tooltip,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { toast } from "react-toastify";
import api from "../api/api";
import { useAuth } from "../context/authContext";

/* ─── Constantes ─── */
const TIPO_LABELS = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  APARTADO: "Apartado",
  TRASPASO: "Traspaso",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (−)",
};

const TIPO_COLORS = {
  ENTRADA: "#2e7d32",
  SALIDA: "#c62828",
  APARTADO: "#e65100",
  TRASPASO: "#1565c0",
  AJUSTE_POSITIVO: "#00695c",
  AJUSTE_NEGATIVO: "#ad1457",
};

const INITIAL_FILTERS = {
  materialId: "",
  proyectoId: "",
  sitioId: "",
  tipoMovimiento: "",
  ordenCompraId: "",
  requisicionId: "",
  proveedorId: "",
  usuarioId: "",
  fechaInicio: "",
  fechaFin: "",
  includeAnulados: false,
  q: "",
};

const EMPTY_OPTIONS = {
  proyectos: [],
  sitios: [],
  materiales: [],
  proveedores: [],
  usuarios: [],
  tipos: [],
  ocs: [],
  requisiciones: [],
};

/* ─── Helpers ─── */
function formatDateTime(value) {
  try {
    return new Date(value).toLocaleString("es-MX");
  } catch {
    return value;
  }
}

/* ─── Component ─── */
export default function InventarioKardexPage() {
  const { usuario } = useAuth();
  const isSuper = Boolean(usuario?.es_superusuario);

  /* ─── State ─── */
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [data, setData] = useState({ rows: [], total: 0, limit: 100, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [dynOptions, setDynOptions] = useState(EMPTY_OPTIONS);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Autocomplete display values
  const [materialValue, setMaterialValue] = useState(null);
  const [proveedorValue, setProveedorValue] = useState(null);
  const [solicitanteValue, setSolicitanteValue] = useState(null);
  const [ocValue, setOcValue] = useState(null);
  const [reqValue, setReqValue] = useState(null);

  // Reversa modal
  const [openRev, setOpenRev] = useState(false);
  const [revMotivo, setRevMotivo] = useState("");
  const [revRow, setRevRow] = useState(null);
  const [reversando, setReversando] = useState(false);

  // Ref to track debounce timer
  const debounceRef = useRef(null);
  const isFirstRender = useRef(true);

  /* ─── Build query params ─── */
  const buildParams = useCallback(
    (overrideFilters, offset = 0) => {
      const f = overrideFilters || filters;
      const params = new URLSearchParams();
      if (f.materialId) params.set("materialId", f.materialId);
      if (f.proyectoId) params.set("proyectoId", f.proyectoId);
      if (f.sitioId) params.set("sitioId", f.sitioId);
      if (f.tipoMovimiento) params.set("tipoMovimiento", f.tipoMovimiento);
      if (f.ordenCompraId) params.set("ordenCompraId", f.ordenCompraId);
      if (f.requisicionId) params.set("requisicionId", f.requisicionId);
      if (f.proveedorId) params.set("proveedorId", f.proveedorId);
      if (f.usuarioId) params.set("usuarioId", f.usuarioId);
      if (f.fechaInicio) params.set("fechaInicio", f.fechaInicio);
      if (f.fechaFin) params.set("fechaFin", f.fechaFin);
      if (f.q) params.set("q", f.q);
      if (f.includeAnulados) params.set("includeAnulados", "true");
      params.set("limit", String(data.limit || 100));
      params.set("offset", String(offset));
      return params.toString();
    },
    [filters, data.limit]
  );

  /* ─── Fetch data + options (combined) ─── */
  const fetchAll = useCallback(
    async (overrideFilters, offset = 0) => {
      const f = overrideFilters || filters;
      setLoading(true);
      setOptionsLoading(true);
      try {
        const qs = buildParams(f, offset);
        const filterQs = buildParams(f, 0); // no pagination for options

        const [kardexRes, optsRes] = await Promise.all([
          api.get(`/api/inventario/kardex?${qs}`),
          api.get(`/api/inventario/kardex/opciones-filtros?${filterQs}`),
        ]);

        setData(kardexRes);
        setDynOptions(optsRes || EMPTY_OPTIONS);
      } catch (err) {
        toast.error(err?.error || "Error al cargar Kardex.");
        setData({ rows: [], total: 0, limit: 100, offset: 0 });
      } finally {
        setLoading(false);
        setOptionsLoading(false);
      }
    },
    [buildParams, filters]
  );

  /* ─── Initial load ─── */
  useEffect(() => {
    fetchAll(INITIAL_FILTERS, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Auto-apply on filter change (debounced) ─── */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAll(filters, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  /* ─── Filter setters ─── */
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setMaterialValue(null);
    setProveedorValue(null);
    setSolicitanteValue(null);
    setOcValue(null);
    setReqValue(null);
  }, []);

  /* ─── Pagination ─── */
  const handlePrev = () => {
    const newOffset = Math.max((data.offset || 0) - (data.limit || 100), 0);
    fetchAll(filters, newOffset);
  };
  const handleNext = () => {
    const newOffset = (data.offset || 0) + (data.limit || 100);
    if (newOffset >= (data.total || 0)) return;
    fetchAll(filters, newOffset);
  };

  /* ─── Reversa ─── */
  const canRevertRow = useCallback(
    (row) => {
      if (!isSuper || !row) return false;
      if (row.estado && row.estado !== "ACTIVO") return false;
      if (row.reversa_de_movimiento_id) return false;
      return ["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "SALIDA"].includes(row.tipo_movimiento);
    },
    [isSuper]
  );

  const openReversa = (row) => { setRevRow(row); setRevMotivo(""); setOpenRev(true); };
  const closeReversa = () => { setOpenRev(false); setRevRow(null); setRevMotivo(""); };

  const confirmarReversa = async () => {
    if (!revRow) return;
    if (!revMotivo.trim()) { toast.error("Motivo es requerido."); return; }
    setReversando(true);
    try {
      await api.post(`/api/inventario/movimientos/${revRow.id}/reversar`, { motivo: revMotivo.trim() });
      toast.success(`Movimiento #${revRow.id} reversado.`);
      closeReversa();
      fetchAll(filters, data.offset || 0);
    } catch (err) {
      toast.error(err?.error || "Error al reversar movimiento.");
    } finally {
      setReversando(false);
    }
  };

  /* ─── Styles ─── */
  const sxLabel = { fontSize: 13, fontWeight: 600, color: "text.secondary", mb: 0.5 };

  return (
    <Box sx={{ px: 3, pb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: "bold" }}>
        Kardex de Inventario
      </Typography>

      {/* ═══════════ FILTROS ═══════════ */}
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2 }} elevation={2}>

        {/* Row 1: Material · Proyecto · Sitio */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>

          {/* Material */}
          <Box sx={{ flex: "1 1 300px", minWidth: 220 }}>
            <Typography sx={sxLabel}>Material</Typography>
            <Autocomplete
              value={materialValue}
              options={dynOptions.materiales}
              getOptionLabel={(opt) => opt ? `${opt.extra || ""} ${opt.extra ? "- " : ""}${opt.nombre}`.trim() : ""}
              isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
              loading={optionsLoading}
              onChange={(_, val) => {
                setMaterialValue(val);
                setFilter("materialId", val?.id || "");
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Todos los materiales"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {optionsLoading && <CircularProgress size={16} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              noOptionsText="Sin materiales con movimientos"
              size="small"
            />
          </Box>

          {/* Proyecto */}
          <Box sx={{ flex: "1 1 220px", minWidth: 180 }}>
            <Typography sx={sxLabel}>Proyecto</Typography>
            <TextField
              select
              value={filters.proyectoId}
              onChange={(e) => setFilter("proyectoId", e.target.value)}
              fullWidth
              size="small"
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Todos los proyectos</em>
              </MenuItem>
              {dynOptions.proyectos.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Sitio */}
          <Box sx={{ flex: "1 1 200px", minWidth: 160 }}>
            <Typography sx={sxLabel}>Sitio</Typography>
            <TextField
              select
              value={filters.sitioId}
              onChange={(e) => setFilter("sitioId", e.target.value)}
              fullWidth
              size="small"
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Todos los sitios</em>
              </MenuItem>
              {dynOptions.sitios.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Row 2: OC · Requisición · Proveedor · Solicitante */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>

          {/* OC */}
          <Box sx={{ flex: "0 1 180px", minWidth: 140 }}>
            <Typography sx={sxLabel}>Orden de Compra</Typography>
            <Autocomplete
              value={ocValue}
              options={dynOptions.ocs}
              getOptionLabel={(opt) => opt ? `OC-${opt.nombre}` : ""}
              isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
              onChange={(_, val) => {
                setOcValue(val);
                setFilter("ordenCompraId", val?.id || "");
              }}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Todas las OC" />
              )}
              noOptionsText="Sin OCs con movimientos"
              size="small"
            />
          </Box>

          {/* Requisición */}
          <Box sx={{ flex: "0 1 180px", minWidth: 140 }}>
            <Typography sx={sxLabel}>Requisición</Typography>
            <Autocomplete
              value={reqValue}
              options={dynOptions.requisiciones}
              getOptionLabel={(opt) => opt?.nombre || ""}
              isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
              onChange={(_, val) => {
                setReqValue(val);
                setFilter("requisicionId", val?.id || "");
              }}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Todas las REQ" />
              )}
              noOptionsText="Sin requisiciones con movimientos"
              size="small"
            />
          </Box>

          {/* Proveedor */}
          <Box sx={{ flex: "1 1 250px", minWidth: 200 }}>
            <Typography sx={sxLabel}>Proveedor</Typography>
            <Autocomplete
              value={proveedorValue}
              options={dynOptions.proveedores}
              getOptionLabel={(opt) => opt?.nombre || ""}
              isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
              onChange={(_, val) => {
                setProveedorValue(val);
                setFilter("proveedorId", val?.id || "");
              }}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Todos los proveedores" />
              )}
              noOptionsText="Sin proveedores con movimientos"
              size="small"
            />
          </Box>

          {/* Solicitante */}
          <Box sx={{ flex: "1 1 250px", minWidth: 200 }}>
            <Typography sx={sxLabel}>Solicitante</Typography>
            <Autocomplete
              value={solicitanteValue}
              options={dynOptions.usuarios}
              getOptionLabel={(opt) => opt?.nombre || ""}
              isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
              onChange={(_, val) => {
                setSolicitanteValue(val);
                setFilter("usuarioId", val?.id || "");
              }}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Todos los solicitantes" />
              )}
              noOptionsText="Sin usuarios con movimientos"
              size="small"
            />
          </Box>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Row 3: Tipo · Fechas · Anulados · Texto */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>

          {/* Tipo */}
          <Box sx={{ flex: "0 1 160px", minWidth: 130 }}>
            <Typography sx={sxLabel}>Tipo Movimiento</Typography>
            <TextField
              select
              value={filters.tipoMovimiento}
              onChange={(e) => setFilter("tipoMovimiento", e.target.value)}
              fullWidth
              size="small"
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Todos</em>
              </MenuItem>
              {dynOptions.tipos.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {TIPO_LABELS[t.id] || t.id}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Desde */}
          <Box sx={{ flex: "0 1 150px", minWidth: 130 }}>
            <Typography sx={sxLabel}>Desde</Typography>
            <TextField
              type="date"
              value={filters.fechaInicio}
              onChange={(e) => setFilter("fechaInicio", e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Hasta */}
          <Box sx={{ flex: "0 1 150px", minWidth: 130 }}>
            <Typography sx={sxLabel}>Hasta</Typography>
            <TextField
              type="date"
              value={filters.fechaFin}
              onChange={(e) => setFilter("fechaFin", e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Incluir anulados */}
          <Box sx={{ flex: "0 1 140px", minWidth: 110 }}>
            <Typography sx={sxLabel}>Incluir anulados</Typography>
            <TextField
              select
              value={filters.includeAnulados ? "SI" : "NO"}
              onChange={(e) => setFilter("includeAnulados", e.target.value === "SI")}
              size="small"
              fullWidth
            >
              <MenuItem value="NO">No</MenuItem>
              <MenuItem value="SI">Sí</MenuItem>
            </TextField>
          </Box>

          {/* Buscar observaciones */}
          <Box sx={{ flex: "1 1 220px", minWidth: 180 }}>
            <Typography sx={sxLabel}>Buscar en observaciones</Typography>
            <TextField
              value={filters.q}
              onChange={(e) => setFilter("q", e.target.value)}
              fullWidth
              size="small"
              placeholder="Texto libre..."
            />
          </Box>
        </Box>

        {/* Row 4: Reset + Total */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={handleReset}
            disabled={loading}
            sx={{ textTransform: "none" }}
          >
            Limpiar filtros
          </Button>

          {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}

          <Typography sx={{ ml: "auto", fontSize: 13, opacity: 0.8 }}>
            {data.total || 0} movimiento{data.total !== 1 ? "s" : ""} encontrado
            {data.total !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Paper>

      {/* ═══════════ TABLA ═══════════ */}
      <Paper elevation={2} sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Material</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Cantidad</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Proy. Origen</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Proy. Destino</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Ubicación</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>OC / Prov.</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Obs.</TableCell>
                <TableCell align="center" sx={{ fontWeight: "bold" }}>Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <Box sx={{ py: 3 }}><CircularProgress size={22} /></Box>
                  </TableCell>
                </TableRow>
              ) : (data.rows || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <Box sx={{ py: 3 }}>
                      <Typography>No hay movimientos con esos filtros.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                (data.rows || []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.fecha)}</TableCell>
                    <TableCell>
                      <Chip
                        label={TIPO_LABELS[row.tipo_movimiento] || row.tipo_movimiento}
                        size="small"
                        sx={{
                          bgcolor: TIPO_COLORS[row.tipo_movimiento] || "#757575",
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                        {row.material_sku || `#${row.material_id}`}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
                        {row.material_descripcion || ""}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{row.cantidad}</TableCell>
                    <TableCell>{row.proyecto_origen_nombre || "-"}</TableCell>
                    <TableCell>{row.proyecto_destino_nombre || "-"}</TableCell>
                    <TableCell>{row.ubicacion_nombre || row.ubicacion_id || "-"}</TableCell>
                    <TableCell>
                      {row.numero_oc ? (
                        <>
                          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                            OC-{row.numero_oc}
                          </Typography>
                          {row.proveedor_nombre && (
                            <Typography sx={{ fontSize: 11, opacity: 0.7 }}>
                              {row.proveedor_nombre}
                            </Typography>
                          )}
                        </>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12 }}>{row.usuario_nombre || "-"}</Typography>
                    </TableCell>
                    <TableCell>{row.estado || "ACTIVO"}</TableCell>
                    <TableCell>
                      <Tooltip title={row.observaciones || ""} arrow placement="left">
                        <Typography sx={{ fontSize: 12, maxWidth: 200 }} noWrap>
                          {row.observaciones || ""}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      {canRevertRow(row) ? (
                        <Button
                          size="small" color="warning" variant="outlined"
                          onClick={() => openReversa(row)}
                          sx={{ textTransform: "none", fontSize: 12 }}
                        >
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
            Mostrando {Math.min((data.offset || 0) + 1, data.total || 0)} –{" "}
            {Math.min((data.offset || 0) + (data.limit || 100), data.total || 0)} de {data.total || 0}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={handlePrev}
              disabled={loading || (data.offset || 0) === 0}>
              Anterior
            </Button>
            <Button variant="outlined" onClick={handleNext}
              disabled={loading || (data.offset || 0) + (data.limit || 100) >= (data.total || 0)}>
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
            fullWidth multiline minRows={2}
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
