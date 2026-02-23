// sira-front/src/components/-requisiciones/ModalGestionarEventoTipos.jsx
import React, { useState, useMemo } from 'react';
import {
  Modal, Box, Typography, Stack, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, Button,
  TextField, Checkbox, FormControlLabel, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Divider,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { useUnidadServicios } from '../../hooks/useUnidadServicios';
import { toast } from 'react-toastify';

const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '95%',
  maxWidth: 820,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 3,
  borderRadius: 2,
  maxHeight: '92vh',
  overflowY: 'auto',
};

const COMBUSTIBLE_OPTIONS = [
  { value: '', label: 'Todos (sin filtro)' },
  { value: 'GASOLINA', label: 'Gasolina' },
  { value: 'DIESEL', label: 'Diesel' },
];

const FORM_INIT_MANUAL = {
  nombre: '',
  descripcion: '',
  requiere_num_serie: false,
};

const FORM_INIT_SERVICIO = {
  nombre: '',
  descripcion: '',
  requiere_num_serie: false,
  km_intervalo: '',
  tipo_combustible_aplica: '',
  material_sku: '',
};

// ── Formulario reutilizable para crear / editar ─────────────────────────────
function FormEventoTipo({ inicial, esServicio, onGuardar, onCancelar, isSubmitting }) {
  const [form, setForm] = useState(inicial);

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio.'); return; }
    if (esServicio && !form.material_sku.trim()) {
      toast.error('El SKU de material es obligatorio para servicios.'); return;
    }
    onGuardar(form);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField
          label="Nombre" required fullWidth size="small"
          value={form.nombre} onChange={e => set('nombre', e.target.value)}
        />
        <TextField
          label="Descripción (opcional)" fullWidth size="small" multiline rows={2}
          value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
        />

        {esServicio ? (
          <>
            <Stack direction="row" spacing={2}>
              <TextField
                label="KM Intervalo" type="number" size="small" sx={{ flex: 1 }}
                value={form.km_intervalo}
                onChange={e => set('km_intervalo', e.target.value)}
                helperText="Ej. 5000 (opcional)"
                inputProps={{ min: 0 }}
              />
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Combustible</InputLabel>
                <Select
                  label="Combustible"
                  value={form.tipo_combustible_aplica}
                  onChange={e => set('tipo_combustible_aplica', e.target.value)}
                >
                  {COMBUSTIBLE_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="SKU Material *" required fullWidth size="small"
              value={form.material_sku}
              onChange={e => set('material_sku', e.target.value)}
              helperText="SKU del catálogo de materiales (ej. SERV-VEH-PREV)"
            />
          </>
        ) : null}

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={form.requiere_num_serie}
              onChange={e => set('requiere_num_serie', e.target.checked)}
            />
          }
          label="Requiere número de serie"
        />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onCancelar} disabled={isSubmitting}
            startIcon={<CancelOutlinedIcon />}>
            Cancelar
          </Button>
          <Button size="small" variant="contained" type="submit" disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlineIcon />}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

// ── Diálogo de confirmación para eliminar ────────────────────────────────────
function DialogConfirmarEliminar({ tipo, onConfirmar, onCancelar, isSubmitting }) {
  return (
    <Dialog open maxWidth="xs" fullWidth>
      <DialogTitle>Desactivar tipo de evento</DialogTitle>
      <DialogContent>
        <Typography>
          ¿Deseas desactivar <strong>"{tipo?.nombre}"</strong>?
          No se eliminará definitivamente; solo dejará de aparecer en los formularios.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar} disabled={isSubmitting}>Cancelar</Button>
        <Button
          color="error" variant="contained"
          onClick={onConfirmar}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : null}
        >
          Desactivar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Tabla de tipos de evento ─────────────────────────────────────────────────
function TablaEventoTipos({ tipos, esServicio, isSubmitting, onEditar, onEliminar }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Nombre</strong></TableCell>
            <TableCell><strong>Descripción</strong></TableCell>
            {esServicio ? (
              <>
                <TableCell align="center"><strong>KM Intervalo</strong></TableCell>
                <TableCell align="center"><strong>Combustible</strong></TableCell>
                <TableCell><strong>SKU Material</strong></TableCell>
              </>
            ) : (
              <TableCell align="center"><strong>Req. Nº Serie</strong></TableCell>
            )}
            <TableCell align="right"><strong>Acciones</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tipos.length === 0 && (
            <TableRow>
              <TableCell colSpan={esServicio ? 6 : 4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                No hay tipos configurados en esta categoría.
              </TableCell>
            </TableRow>
          )}
          {tipos.map(t => (
            <TableRow key={t.id} hover>
              <TableCell sx={{ maxWidth: 160 }}>
                <Typography variant="body2" fontWeight="medium">{t.nombre}</Typography>
                <Typography variant="caption" color="text.secondary">{t.codigo}</Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 200 }}>
                <Typography variant="body2" color="text.secondary">{t.descripcion || '—'}</Typography>
              </TableCell>
              {esServicio ? (
                <>
                  <TableCell align="center">
                    {t.km_intervalo
                      ? <Chip label={`${Number(t.km_intervalo).toLocaleString('es-MX')} km`} size="small" color="info" variant="outlined" />
                      : <Typography variant="caption" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell align="center">
                    {t.tipo_combustible_aplica
                      ? <Chip label={t.tipo_combustible_aplica} size="small" />
                      : <Typography variant="caption" color="text.secondary">Todos</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {t.material_sku || '—'}
                    </Typography>
                  </TableCell>
                </>
              ) : (
                <TableCell align="center">
                  <Checkbox size="small" checked={!!t.requiere_num_serie} disabled />
                </TableCell>
              )}
              <TableCell align="right">
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => onEditar(t)} disabled={isSubmitting}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Desactivar">
                    <IconButton size="small" color="error" onClick={() => onEliminar(t)} disabled={isSubmitting}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────
export default function ModalGestionarEventoTipos({ open, onClose }) {
  const {
    eventoTipos, loadingEventoTipos, isSubmitting,
    crearEventoTipo, editarEventoTipo, eliminarEventoTipo,
  } = useUnidadServicios();

  const [tab, setTab] = useState(0);
  const [modoAgregar, setModoAgregar] = useState(false);
  const [editando, setEditando] = useState(null);     // tipo de evento siendo editado
  const [eliminando, setEliminando] = useState(null); // tipo de evento pendiente de confirmación

  const tiposManuales  = useMemo(() => eventoTipos.filter(t => !t.genera_requisicion), [eventoTipos]);
  const tiposServicio  = useMemo(() => eventoTipos.filter(t =>  t.genera_requisicion), [eventoTipos]);
  const esServicio     = tab === 1;
  const tiposActuales  = esServicio ? tiposServicio : tiposManuales;

  const handleCerrar = () => {
    setModoAgregar(false);
    setEditando(null);
    setEliminando(null);
    onClose();
  };

  const handleAgregar = async (form) => {
    const datos = {
      nombre:                 form.nombre,
      descripcion:            form.descripcion,
      genera_requisicion:     esServicio,
      requiere_num_serie:     form.requiere_num_serie,
      km_intervalo:           form.km_intervalo || null,
      tipo_combustible_aplica: form.tipo_combustible_aplica || null,
      material_sku:           form.material_sku || null,
    };
    const nuevo = await crearEventoTipo(datos);
    if (nuevo) setModoAgregar(false);
  };

  const handleEditar = async (form) => {
    const datos = {
      nombre:                 form.nombre,
      descripcion:            form.descripcion,
      requiere_num_serie:     form.requiere_num_serie,
      km_intervalo:           form.km_intervalo || null,
      tipo_combustible_aplica: form.tipo_combustible_aplica || null,
      material_sku:           form.material_sku || null,
    };
    const ok = await editarEventoTipo(editando.id, datos);
    if (ok) setEditando(null);
  };

  const handleConfirmarEliminar = async () => {
    const ok = await eliminarEventoTipo(eliminando.id, eliminando.nombre);
    if (ok) setEliminando(null);
  };

  // Cambiar de tab limpia el estado de formulario
  const handleCambiarTab = (_, nuevoTab) => {
    setTab(nuevoTab);
    setModoAgregar(false);
    setEditando(null);
  };

  const formInicial = editando
    ? {
        nombre:                 editando.nombre,
        descripcion:            editando.descripcion || '',
        requiere_num_serie:     editando.requiere_num_serie || false,
        km_intervalo:           editando.km_intervalo || '',
        tipo_combustible_aplica: editando.tipo_combustible_aplica || '',
        material_sku:           editando.material_sku || '',
      }
    : esServicio ? FORM_INIT_SERVICIO : FORM_INIT_MANUAL;

  return (
    <>
      <Modal open={open} onClose={handleCerrar}>
        <Box sx={styleModal}>
          <Typography variant="h6" gutterBottom>
            Gestionar Tipos de Evento
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Agrega, edita o desactiva los tipos disponibles en los botones "Registrar" y "Servicio".
          </Typography>

          <Tabs value={tab} onChange={handleCambiarTab} sx={{ mb: 1 }}>
            <Tab label={`Registrar (${tiposManuales.length})`} />
            <Tab label={`Servicio / Requisición (${tiposServicio.length})`} />
          </Tabs>

          <Divider sx={{ mb: 2 }} />

          {loadingEventoTipos ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TablaEventoTipos
                tipos={tiposActuales}
                esServicio={esServicio}
                isSubmitting={isSubmitting}
                onEditar={(t) => { setEditando(t); setModoAgregar(false); }}
                onEliminar={(t) => setEliminando(t)}
              />

              <Divider sx={{ my: 2 }} />

              {/* Formulario Editar */}
              {editando && !modoAgregar && (
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 1, mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Editando: {editando.nombre}
                  </Typography>
                  <FormEventoTipo
                    key={editando.id}
                    inicial={formInicial}
                    esServicio={esServicio}
                    onGuardar={handleEditar}
                    onCancelar={() => setEditando(null)}
                    isSubmitting={isSubmitting}
                  />
                </Box>
              )}

              {/* Formulario Agregar */}
              {modoAgregar && !editando && (
                <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Nuevo tipo de {esServicio ? 'servicio' : 'registro'}
                  </Typography>
                  <FormEventoTipo
                    key={`nuevo-${tab}`}
                    inicial={esServicio ? FORM_INIT_SERVICIO : FORM_INIT_MANUAL}
                    esServicio={esServicio}
                    onGuardar={handleAgregar}
                    onCancelar={() => setModoAgregar(false)}
                    isSubmitting={isSubmitting}
                  />
                </Box>
              )}

              {!modoAgregar && !editando && (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => setModoAgregar(true)}
                    disabled={isSubmitting}
                  >
                    Agregar tipo de {esServicio ? 'servicio' : 'registro'}
                  </Button>
                  <Button size="small" onClick={handleCerrar}>Cerrar</Button>
                </Stack>
              )}
            </>
          )}
        </Box>
      </Modal>

      {/* Confirmación de eliminación fuera del modal principal para evitar z-index issues */}
      {eliminando && (
        <DialogConfirmarEliminar
          tipo={eliminando}
          onConfirmar={handleConfirmarEliminar}
          onCancelar={() => setEliminando(null)}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}
