// src/pages/dashboards/Dashboard_SSD.jsx
//ESTABLE!!!!!!!
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Typography, Select, MenuItem, FormControl, InputLabel, Chip, Box, IconButton, Tooltip, TextField
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import InfoIcon from '@mui/icons-material/Info';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CancelIcon from '@mui/icons-material/Cancel';

export default function Dashboard_SSD() {
  // =================== ESTADOS DE DATOS Y OPCIONES ===================
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departamentos, setDepartamentos] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [rfqStatusOptions, setRfqStatusOptions] = useState([]);
  const [ocStatusOptions, setOcStatusOptions] = useState([]);
  const [activeRfqStatuses, setActiveRfqStatuses] = useState([]);
  const [activeOcStatuses, setActiveOcStatuses] = useState([]);

  // Estado para el Autocomplete de proyectos
  const [proyectoInput, setProyectoInput] = useState('');
  const [proyectosOptions, setProyectosOptions] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);

  // =================== FILTROS ===================
  const [filters, setFilters] = useState({
    rfq_status: 'ACTIVOS',        // Estado RFQ: "Activos" por default
    oc_status: 'DESACTIVADO',     // Estado OC: "Desactivado" por default
    departamento_id: '',          // Departamento: "Todos" por default
    sitio_id: '',                 // Sitio: "Todos" por default
    proyecto_id: ''               // Proyecto: ninguno por default
  });

  // =================== COLORES PARA STATUS ===================
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

  // =================== CARGA DE OPCIONES DINÁMICAS ===================
  useEffect(() => {
    // Enums
    const fetchEnums = async () => {
      try {
        const { rfqStatus, ocStatus } = await api.get('/api/dashboard/status-options');
        setRfqStatusOptions(rfqStatus);
        setOcStatusOptions(ocStatus);
        setActiveRfqStatuses(rfqStatus.length > 2 ? rfqStatus.slice(1, -1) : rfqStatus);
        setActiveOcStatuses(ocStatus.filter(s => s !== 'CANCELADA'));
      } catch (err) {
        toast.error('Error al cargar los estados de status.');
      }
    };

    // Departamentos
    const fetchDepartamentos = async () => {
      try {
        const deptoData = await api.get('/api/dashboard/departamentos');
        setDepartamentos(deptoData);
      } catch (err) {
        toast.error('No se pudo cargar la lista de departamentos.');
      }
    };

    // Sitios
    const fetchSitios = async () => {
      try {
        const sitiosData = await api.get('/api/sitios');
        setSitios(sitiosData);
      } catch (err) {
        toast.error('No se pudo cargar la lista de sitios.');
      }
    };

    fetchEnums();
    fetchDepartamentos();
    fetchSitios();
  }, []);

  // =================== AUTOCOMPLETE DE PROYECTOS ===================
  useEffect(() => {
    if (proyectoInput.length < 2) {
      setProyectosOptions([]);
      return;
    }
    let active = true;
    const fetchProyectos = async () => {
      try {
        const params = new URLSearchParams({ texto: proyectoInput });
        if (filters.sitio_id) params.append('sitio_id', filters.sitio_id);
        const proyectos = await api.get(`/api/proyectos/buscar?${params.toString()}`);
        if (active) setProyectosOptions(proyectos);
      } catch (err) {
        toast.error('Error al buscar proyectos.');
      }
    };
    fetchProyectos();
    return () => { active = false; };
  }, [proyectoInput, filters.sitio_id]);

  // Si seleccionas un proyecto sin sitio seleccionado, autocompleta el sitio
  useEffect(() => {
    if (proyectoSeleccionado && !filters.sitio_id) {
      setFilters(prev => ({ ...prev, sitio_id: proyectoSeleccionado.sitio_id }));
    }
    if (proyectoSeleccionado) {
      setFilters(prev => ({ ...prev, proyecto_id: proyectoSeleccionado.id }));
    } else {
      setFilters(prev => ({ ...prev, proyecto_id: '' }));
    }
  }, [proyectoSeleccionado]);

  /* =========================================================================
     CARGA DE DATOS PRINCIPALES SEGÚN FILTROS
     ========================================================================= */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const apiFilters = { ...filters };

      // RFQ: si está en "ACTIVOS", usa los activos dinámicos, si está vacío no filtra
      if (apiFilters.rfq_status === 'ACTIVOS') {
        apiFilters.rfq_status = activeRfqStatuses.join(',');
      } else if (!apiFilters.rfq_status) {
        delete apiFilters.rfq_status;
      }

      // OC: si está en "DESACTIVADO", NO filtra (no manda el campo)
      if (apiFilters.oc_status === 'DESACTIVADO') {
        delete apiFilters.oc_status;
      } else if (apiFilters.oc_status === 'ACTIVOS') {
        apiFilters.oc_status = activeOcStatuses.join(',');
      } else if (!apiFilters.oc_status) {
        delete apiFilters.oc_status;
      }

      // Departamento
      if (!apiFilters.departamento_id) {
        delete apiFilters.departamento_id;
      }

      // Sitio
      if (!apiFilters.sitio_id) {
        delete apiFilters.sitio_id;
      }

      // Proyecto
      if (!apiFilters.proyecto_id) {
        delete apiFilters.proyecto_id;
      }

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

  // Cambia el filtro seleccionado
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    // Si cambias de sitio, limpia el proyecto seleccionado
    if (name === 'sitio_id') {
      setProyectoSeleccionado(null);
      setProyectoInput('');
      setFilters(prev => ({ ...prev, sitio_id: value, proyecto_id: '' }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  // =================== FUNCIÓN PARA RESETAR FILTROS ===================
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

  /* =========================================================================
     RENDER DEL COMPONENTE
     ========================================================================= */
  return (
    <div className="p-6 space-y-6">
      {/* =================== TÍTULO =================== */}
      <Typography variant="h4" component="h1" className="font-bold text-gray-800">
        Dashboard de Compras
      </Typography>

      {/* =================== FILTROS =================== */}
      <Paper elevation={2} className="p-4">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6">Filtros:</Typography>

          {/* 1. Departamento */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Departamento</InputLabel>
            <Select
              name="departamento_id"
              value={filters.departamento_id}
              label="Departamento"
              onChange={handleFilterChange}
            >
              <MenuItem value=""><em>Todos</em></MenuItem>
              {departamentos.map(depto =>
                <MenuItem key={depto.id} value={depto.id}>{depto.nombre}</MenuItem>
              )}
            </Select>
          </FormControl>

          {/* 2. Estado RFQ */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Estado RFQ</InputLabel>
            <Select
              name="rfq_status"
              value={filters.rfq_status}
              label="Estado RFQ"
              onChange={handleFilterChange}
            >
              <MenuItem value=""><em>Todos</em></MenuItem>
              <MenuItem value="ACTIVOS"><em>Activos</em></MenuItem>
              {rfqStatusOptions.map(opt =>
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              )}
            </Select>
          </FormControl>

          {/* 3. Estado OC */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Estado OC</InputLabel>
            <Select
              name="oc_status"
              value={filters.oc_status}
              label="Estado OC"
              onChange={handleFilterChange}
            >
              <MenuItem value="DESACTIVADO"><em>Desactivado</em></MenuItem>
              <MenuItem value="ACTIVOS"><em>Activos</em></MenuItem>
              {ocStatusOptions.map(opt =>
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              )}
            </Select>
          </FormControl>

          {/* 4. Sitio */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Sitio</InputLabel>
            <Select
              name="sitio_id"
              value={filters.sitio_id}
              label="Sitio"
              onChange={handleFilterChange}
            >
              <MenuItem value=""><em>Todos</em></MenuItem>
              {sitios.map(sitio =>
                <MenuItem key={sitio.id} value={sitio.id}>{sitio.nombre}</MenuItem>
              )}
            </Select>
          </FormControl>

          {/* 5. Proyecto (Autocomplete) */}
          <Autocomplete
            sx={{ minWidth: 250 }}
            options={proyectosOptions}
            getOptionLabel={option => option.nombre}
            filterOptions={x => x}
            autoComplete
            includeInputInList
            filterSelectedOptions
            value={proyectoSeleccionado}
            inputValue={proyectoInput}
            onInputChange={(e, newInput) => setProyectoInput(newInput)}
            onChange={(e, newValue) => setProyectoSeleccionado(newValue)}
            renderInput={params => (
              <TextField {...params} label="Proyecto" placeholder="Buscar..." variant="outlined" size="small" />
            )}
            isOptionEqualToValue={(opt, val) => opt.id === val?.id}
            clearOnBlur={false}
            noOptionsText="Escribe para buscar"
          />

          {/* Botón Reset */}
          <Box>
            <button
              type="button"
              onClick={handleResetFiltros}
              style={{
                marginLeft: 8,
                padding: '6px 16px',
                borderRadius: 4,
                border: 'none',
                background: '#e0e0e0',
                color: '#444',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Resetear filtros
            </button>
          </Box>
        </Box>
      </Paper>

      {/* =================== TABLA DE RESULTADOS =================== */}
      <Paper elevation={3} sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Num RFQ</TableCell>
                  <TableCell>Sitio y Proyecto</TableCell>
                  <TableCell>Status RFQ</TableCell>
                  <TableCell>Órdenes de Compra</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((rfq) => (
                  <TableRow
                    hover
                    key={rfq.rfq_id}
                    sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>{rfq.rfq_code}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{rfq.sitio}</Typography>
                      <Typography variant="caption" color="textSecondary">{rfq.proyecto}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rfq.rfq_status}
                        color={statusColors[rfq.rfq_status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {rfq.ordenes.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {rfq.ordenes.map((oc) => (
                            <Box key={oc.numero_oc} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Typography variant="body2">{oc.numero_oc}:</Typography>
                              <Chip
                                label={oc.oc_status}
                                color={statusColors[oc.oc_status] || 'default'}
                                size="small"
                              />
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          Sin OCs generadas
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver Detalles">
                        <IconButton size="small"><InfoIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="Cotizar">
                        <IconButton size="small" color="primary"><AssignmentIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="Cancelar">
                        <IconButton size="small" color="error"><CancelIcon /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>
    </div>
  );
}
