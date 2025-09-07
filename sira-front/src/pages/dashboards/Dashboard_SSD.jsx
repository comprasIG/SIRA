// src/pages/dashboards/Dashboard_SSD.jsx
// VERSIÓN MEJORADA CON NUEVA UI/UX

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Typography, Select, MenuItem, FormControl, InputLabel, Chip, Box, IconButton, Tooltip, TextField, Button
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';

// =================== ICONOS ADICIONALES ===================
import InfoIcon from '@mui/icons-material/Info';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CancelIcon from '@mui/icons-material/Cancel';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';

// =================== COMPONENTES COMPLEMENTARIOS ===================
// NUEVO: Importamos el componente para la fila de KPIs
import DashboardKPIRow from '../../components/Dashboard/SSD/DashboardKPIRow';

export default function Dashboard_SSD() {
  // =================== ESTADOS DE DATOS Y OPCIONES (Sin cambios) ===================
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departamentos, setDepartamentos] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [rfqStatusOptions, setRfqStatusOptions] = useState([]);
  const [ocStatusOptions, setOcStatusOptions] = useState([]);
  const [activeRfqStatuses, setActiveRfqStatuses] = useState([]);
  const [activeOcStatuses, setActiveOcStatuses] = useState([]);

  const [proyectoInput, setProyectoInput] = useState('');
  const [proyectosOptions, setProyectosOptions] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);

  // =================== FILTROS (Sin cambios) ===================
  const [filters, setFilters] = useState({
    rfq_status: 'ACTIVOS',
    oc_status: 'DESACTIVADO',
    departamento_id: '',
    sitio_id: '',
    proyecto_id: ''
  });

  // =================== COLORES PARA STATUS (Sin cambios) ===================
  const statusColors = {
    COTIZANDO: 'primary',
    POR_APROBAR: 'warning',
    POR_AUTORIZAR: 'warning',
    ESPERANDO_ENTREGA: 'info',
    ENTREGADA: 'success',
    CANCELADA: 'default',
    RECHAZADA: 'error',
    APROBADA: 'success',
    EN_PROCESO: 'info'
  };

  // =================== CARGA DE OPCIONES DINÁMICAS (Sin cambios) ===================
  useEffect(() => {
    // ... (toda la lógica de carga de enums, departamentos y sitios se mantiene igual)
    const fetchEnums = async () => { try { const { rfqStatus, ocStatus } = await api.get('/api/dashboard/status-options'); setRfqStatusOptions(rfqStatus); setOcStatusOptions(ocStatus); setActiveRfqStatuses(rfqStatus.length > 2 ? rfqStatus.slice(1, -1) : rfqStatus); setActiveOcStatuses(ocStatus.filter(s => s !== 'CANCELADA')); } catch (err) { toast.error('Error al cargar los estados de status.'); } };
    const fetchDepartamentos = async () => { try { const deptoData = await api.get('/api/dashboard/departamentos'); setDepartamentos(deptoData); } catch (err) { toast.error('No se pudo cargar la lista de departamentos.'); } };
    const fetchSitios = async () => { try { const sitiosData = await api.get('/api/sitios'); setSitios(sitiosData); } catch (err) { toast.error('No se pudo cargar la lista de sitios.'); } };
    fetchEnums(); fetchDepartamentos(); fetchSitios();
  }, []);

  // =================== AUTOCOMPLETE DE PROYECTOS (Sin cambios) ===================
  useEffect(() => {
    // ... (la lógica de búsqueda de proyectos se mantiene igual)
    if (proyectoInput.length < 2) { setProyectosOptions([]); return; }
    let active = true;
    const fetchProyectos = async () => { try { const params = new URLSearchParams({ texto: proyectoInput }); if (filters.sitio_id) params.append('sitio_id', filters.sitio_id); const proyectos = await api.get(`/api/proyectos/buscar?${params.toString()}`); if (active) setProyectosOptions(proyectos); } catch (err) { toast.error('Error al buscar proyectos.'); } };
    fetchProyectos();
    return () => { active = false; };
  }, [proyectoInput, filters.sitio_id]);
  useEffect(() => { if (proyectoSeleccionado && !filters.sitio_id) { setFilters(prev => ({ ...prev, sitio_id: proyectoSeleccionado.sitio_id })); } if (proyectoSeleccionado) { setFilters(prev => ({ ...prev, proyecto_id: proyectoSeleccionado.id })); } else { setFilters(prev => ({ ...prev, proyecto_id: '' })); } }, [proyectoSeleccionado]);

  // =================== CARGA DE DATOS PRINCIPALES (Sin cambios) ===================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // ... (toda la lógica de preparación de filtros y llamada a la API se mantiene igual)
      const apiFilters = { ...filters };
      if (apiFilters.rfq_status === 'ACTIVOS') { apiFilters.rfq_status = activeRfqStatuses.join(','); } else if (!apiFilters.rfq_status) { delete apiFilters.rfq_status; }
      if (apiFilters.oc_status === 'DESACTIVADO') { delete apiFilters.oc_status; } else if (apiFilters.oc_status === 'ACTIVOS') { apiFilters.oc_status = activeOcStatuses.join(','); } else if (!apiFilters.oc_status) { delete apiFilters.oc_status; }
      if (!apiFilters.departamento_id) { delete apiFilters.departamento_id; }
      if (!apiFilters.sitio_id) { delete apiFilters.sitio_id; }
      if (!apiFilters.proyecto_id) { delete apiFilters.proyecto_id; }
      const params = new URLSearchParams(apiFilters).toString();
      const response = await api.get(`/api/dashboard/compras?${params}`);
      setData(response);
    } catch (err) {
      toast.error(err.error || 'Error al cargar los datos del dashboard.');
    } finally {
      setLoading(false);
    }
  }, [filters, activeRfqStatuses, activeOcStatuses]);

  useEffect(() => {
    if (activeRfqStatuses.length && activeOcStatuses.length) {
      fetchData();
    }
  }, [fetchData, activeRfqStatuses, activeOcStatuses]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    if (name === 'sitio_id') {
      setProyectoSeleccionado(null);
      setProyectoInput('');
      setFilters(prev => ({ ...prev, sitio_id: value, proyecto_id: '' }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleResetFiltros = () => {
    setFilters({
      rfq_status: 'ACTIVOS',
      oc_status: 'DESACTIVADO',
      departamento_id: '',
      sitio_id: '',
      proyecto_id: ''
    });
    setProyectoSeleccionado(null);
    setProyectoInput('');
  };

  // NUEVO: CÁLCULO DE KPIs (MEMOIZED PARA EFICIENCIA)
  const kpiData = useMemo(() => {
    if (loading || data.length === 0) {
      return { rfqActivos: 0, porAutorizar: 0, esperandoEntrega: 0 };
    }
    let porAutorizar = 0;
    let esperandoEntrega = 0;
    data.forEach(rfq => {
      rfq.ordenes.forEach(oc => {
        if (oc.oc_status === 'POR_AUTORIZAR') porAutorizar++;
        if (oc.oc_status === 'ESPERANDO_ENTREGA') esperandoEntrega++;
      });
    });
    return {
      rfqActivos: data.length,
      porAutorizar,
      esperandoEntrega
    };
  }, [data, loading]);

  /* =========================================================================
     RENDER DEL COMPONENTE
     ========================================================================= */
  return (
    <Box sx={{ p: 3, spaceY: 3 }}>
      {/* MODIFICADO: Título más integrado */}
      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 3 }}>
        Dashboard de Compras
      </Typography>

      {/* NUEVO: Fila de KPIs */}
      <DashboardKPIRow kpiData={kpiData} />

      {/* MODIFICADO: Filtros dentro de un Paper con estilo "outlined" */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mr: 1 }}>Filtros:</Typography>
          
          {/* Los controles de filtro se mantienen, pero con un estilo visual más cohesivo */}
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Departamento</InputLabel><Select name="departamento_id" value={filters.departamento_id} label="Departamento" onChange={handleFilterChange}><MenuItem value=""><em>Todos</em></MenuItem>{departamentos.map(depto => <MenuItem key={depto.id} value={depto.id}>{depto.nombre}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Estado RFQ</InputLabel><Select name="rfq_status" value={filters.rfq_status} label="Estado RFQ" onChange={handleFilterChange}><MenuItem value=""><em>Todos</em></MenuItem><MenuItem value="ACTIVOS"><em>Activos</em></MenuItem>{rfqStatusOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Estado OC</InputLabel><Select name="oc_status" value={filters.oc_status} label="Estado OC" onChange={handleFilterChange}><MenuItem value="DESACTIVADO"><em>Desactivado</em></MenuItem><MenuItem value="ACTIVOS"><em>Activos</em></MenuItem>{ocStatusOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Sitio</InputLabel><Select name="sitio_id" value={filters.sitio_id} label="Sitio" onChange={handleFilterChange}><MenuItem value=""><em>Todos</em></MenuItem>{sitios.map(sitio => <MenuItem key={sitio.id} value={sitio.id}>{sitio.nombre}</MenuItem>)}</Select></FormControl>
          
          <Autocomplete
            sx={{ minWidth: 240 }} options={proyectosOptions} getOptionLabel={option => option.nombre} filterOptions={x => x} autoComplete includeInputInList filterSelectedOptions value={proyectoSeleccionado} inputValue={proyectoInput} onInputChange={(e, newInput) => setProyectoInput(newInput)} onChange={(e, newValue) => setProyectoSeleccionado(newValue)}
            renderInput={params => (<TextField {...params} label="Buscar Proyecto" size="small" />)}
            isOptionEqualToValue={(opt, val) => opt.id === val?.id} clearOnBlur={false} noOptionsText="Escribe para buscar"
          />

          {/* MODIFICADO: Botón de Reset con estilo de MUI */}
          <Tooltip title="Limpiar todos los filtros">
             <Button 
                variant="outlined" 
                color="secondary"
                size="medium"
                onClick={handleResetFiltros}
                startIcon={<FilterListOffIcon />}
              >
                Reset
              </Button>
          </Tooltip>
        </Box>
      </Paper>

      {/* MODIFICADO: Tabla con estilo "outlined" */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}> {/* Ajustar altura si es necesario */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5, height: '200px' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {/* MODIFICADO: Encabezados con estilo más limpio */}
                  {['Num RFQ', 'Sitio y Proyecto', 'Status RFQ', 'Órdenes de Compra', 'Acciones'].map((headCell, index) => (
                    <TableCell key={headCell} align={index === 4 ? 'right' : 'left'} sx={{ fontWeight: 'bold', backgroundColor: 'grey.100' }}>
                      {headCell}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((rfq) => (
                  <TableRow
                    hover
                    key={rfq.rfq_id}
                    // MODIFICADO: Estilo de fila con acciones que aparecen en :hover
                    sx={{
                      '& .actions-cell .MuiIconButton-root': { visibility: 'hidden' },
                      '&:hover': {
                        '& .actions-cell .MuiIconButton-root': { visibility: 'visible' }
                      }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>{rfq.rfq_code}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{rfq.sitio}</Typography>
                      <Typography variant="caption" color="text.secondary">{rfq.proyecto}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={rfq.rfq_status} color={statusColors[rfq.rfq_status] || 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      {/* MODIFICADO: Las OCs se muestran como chips horizontales */}
                      {rfq.ordenes.length > 0 ? (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {rfq.ordenes.map((oc) => (
                            <Tooltip key={oc.numero_oc} title={`Status: ${oc.oc_status}`}>
                              <Chip
                                label={oc.numero_oc}
                                color={statusColors[oc.oc_status] || 'default'}
                                size="small"
                                variant="outlined"
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Sin OCs generadas</Typography>
                      )}
                    </TableCell>
                    {/* MODIFICADO: Se añade una clase para el selector CSS de hover */}
                    <TableCell align="right" className="actions-cell">
                      <Tooltip title="Ver Detalles"><IconButton size="small"><InfoIcon /></IconButton></Tooltip>
                      <Tooltip title="Cotizar"><IconButton size="small" color="primary"><AssignmentIcon /></IconButton></Tooltip>
                      <Tooltip title="Cancelar"><IconButton size="small" color="error"><CancelIcon /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>
    </Box>
  );
}