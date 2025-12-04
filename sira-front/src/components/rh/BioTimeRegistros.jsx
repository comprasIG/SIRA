// C:\SIRA\sira-front\src\components\rh\BioTimeRegistros.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Tooltip
} from '@mui/material';
import { 
  Search, 
  Refresh, 
  Download, 
  Person, 
  Schedule,
  DeviceHub,
  Cached,
  Group
} from '@mui/icons-material';

const BioTimeRegistros = () => {
  // Estados
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [departamentos, setDepartamentos] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [estadisticas, setEstadisticas] = useState({
    totalRegistros: 0,
    totalEmpleados: 0,
    registrosHoy: 0,
    ausentesHoy: 0,
    totalEmpleadosActivos: 0
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Configuración de la API
  const API_CONFIG = {
    baseURL: 'http://26.228.180.16:8000',
    apiKey: 'BioTime__m1dGSuH7Y2iOnJ1BqY4_m4jsGYDIrWOzXKbAaZuCxk',
    timeout: 15000
  };

  // Cargar automáticamente al montar el componente
  useEffect(() => {
    console.log('🚀 Componente BioTimeRegistros montado');
    
    // Establecer fechas por defecto (hoy)
    const hoy = new Date().toISOString().split('T')[0];
    setFechaInicio(hoy);
    setFechaFin(hoy);
    
    // Cargar registros automáticamente
    setTimeout(() => {
      obtenerRegistros(hoy, hoy);
    }, 500);
  }, []);

  // Función para obtener departamentos únicos
  const obtenerDepartamentos = (registros) => {
    const depts = [...new Set(registros
      .map(r => r.departamento)
      .filter(dept => dept && dept.trim() !== '')
    )].sort();
    setDepartamentos(depts);
  };

  // 🔥 NUEVA FUNCIÓN: Obtener asistencias completas con ausentes
  const obtenerAsistenciasCompletas = async (fecha) => {
    try {
      const response = await fetch(
        `${API_CONFIG.baseURL}/asistencias-completas/?fecha=${fecha}`,
        {
          headers: {
            'X-API-Key': API_CONFIG.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error obteniendo asistencias completas:', error);
    }
    return null;
  };

  // 🔥 FUNCIÓN MEJORADA: Obtener registros con nueva lógica
  const obtenerRegistros = async (fechaInicio, fechaFin) => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📅 Solicitando registros...', { fechaInicio, fechaFin });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      // Siempre usar el endpoint de asistencias inteligentes (con la nueva lógica)
      let endpoint;
      let params = `fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
      
      // Usar el endpoint de asistencias completas si es solo un día
      if (fechaInicio === fechaFin) {
        const dataCompleta = await obtenerAsistenciasCompletas(fechaInicio);
        if (dataCompleta) {
          procesarDatosCompletos(dataCompleta);
          clearTimeout(timeoutId);
          return;
        }
      }
      
      endpoint = '/asistencias-inteligentes/';

      const response = await fetch(
        `${API_CONFIG.baseURL}${endpoint}?${params}`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': API_CONFIG.apiKey,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      procesarDatos(data, fechaInicio, fechaFin);

    } catch (err) {
      console.error('💥 Error al obtener registros:', err);
      
      if (err.name === 'AbortError') {
        setError('⏰ Timeout: La API no respondió en 15 segundos');
      } else if (err.message.includes('Failed to fetch')) {
        setError('🌐 Error de red: No se pudo conectar al servidor');
      } else {
        setError(`❌ Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NUEVA FUNCIÓN: Procesar datos completos (con ausentes)
  const procesarDatosCompletos = (dataCompleta) => {
    const datosArray = dataCompleta.asistencias || [];
    
    setRegistros(datosArray);
    obtenerDepartamentos(datosArray);
    
    setEstadisticas({
      totalRegistros: datosArray.length,
      totalEmpleados: new Set(datosArray.map(r => r.codigo_empleado)).size,
      registrosHoy: datosArray.length,
      ausentesHoy: dataCompleta.resumen?.empleados_ausentes || 0,
      totalEmpleadosActivos: dataCompleta.resumen?.total_empleados_activos || 0
    });
    
    setSnackbarOpen(true);
  };

  // 🔥 FUNCIÓN: Procesar datos normales
  const procesarDatos = (data, fechaInicio, fechaFin) => {
    const datosArray = data.datos || [];
    
    // Filtrar registros que NO corresponden al rango de fechas
    const registrosFiltradosPorFecha = datosArray.filter(registro => {
      if (!registro.fecha_hora) return false;
      
      const fechaRegistro = new Date(registro.fecha_hora);
      const fechaInicioObj = new Date(fechaInicio);
      const fechaFinObj = new Date(fechaFin + ' 23:59:59');
      
      return fechaRegistro >= fechaInicioObj && fechaRegistro <= fechaFinObj;
    });

    setRegistros(registrosFiltradosPorFecha);
    obtenerDepartamentos(registrosFiltradosPorFecha);
    
    // Calcular estadísticas
    const empleadosUnicos = new Set(registrosFiltradosPorFecha.map(r => r.codigo_empleado)).size;
    
    // Registros de hoy
    const hoy = new Date().toISOString().split('T')[0];
    const registrosHoy = registrosFiltradosPorFecha.filter(r => {
      try {
        const fechaRegistro = new Date(r.fecha_hora).toISOString().split('T')[0];
        return fechaRegistro === hoy;
      } catch {
        return false;
      }
    }).length;

    // Para ausentes, intentar obtener datos completos si es hoy
    if (fechaInicio === hoy && fechaFin === hoy) {
      obtenerAusentesHoy();
    } else {
      setEstadisticas(prev => ({
        ...prev,
        totalRegistros: registrosFiltradosPorFecha.length,
        totalEmpleados: empleadosUnicos,
        registrosHoy: registrosHoy
      }));
    }

    setSnackbarOpen(true);
  };

  // 🔥 NUEVA FUNCIÓN: Obtener ausentes para hoy
  const obtenerAusentesHoy = async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const dataCompleta = await obtenerAsistenciasCompletas(hoy);
      
      if (dataCompleta) {
        setEstadisticas(prev => ({
          ...prev,
          ausentesHoy: dataCompleta.resumen?.empleados_ausentes || 0,
          totalEmpleadosActivos: dataCompleta.resumen?.total_empleados_activos || 0
        }));
      }
    } catch (error) {
      console.error('Error obteniendo ausentes:', error);
    }
  };

  // Función para probar conexión
  const probarConexion = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🧪 Probando conexión...');
      
      const statusResponse = await fetch(`${API_CONFIG.baseURL}/status`);
      if (!statusResponse.ok) {
        throw new Error(`No se puede conectar al servidor. Status: ${statusResponse.status}`);
      }
      
      const statusData = await statusResponse.json();
      console.log('✅ Status API:', statusData);

      const testResponse = await fetch(`${API_CONFIG.baseURL}/test-db`, {
        headers: {
          'X-API-Key': API_CONFIG.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (testResponse.ok) {
        const testData = await testResponse.json();
        alert(`✅ CONEXIÓN EXITOSA\n\n• API: Funcionando\n• Base de datos: ${testData.database_status}\n• Total registros: ${testData.total_transacciones}\n• Total empleados: ${testData.total_empleados}`);
        return true;
      } else {
        throw new Error(`Error del servidor: ${testResponse.status}`);
      }
      
    } catch (err) {
      console.error('💥 Error en prueba:', err);
      setError(`❌ Error de conexión: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Función de filtrado MEJORADA con departamento
  const registrosFiltrados = registros.filter(registro => {
    if (!registro) return false;
    
    // Filtro por empleado
    const coincideEmpleado = filtroEmpleado === '' || 
      (registro.codigo_empleado && registro.codigo_empleado.toString().toLowerCase().includes(filtroEmpleado.toLowerCase())) ||
      (registro.nombre && registro.nombre.toLowerCase().includes(filtroEmpleado.toLowerCase())) ||
      (registro.apellido && registro.apellido.toLowerCase().includes(filtroEmpleado.toLowerCase()));
    
    // Filtro por tipo de registro
    const coincideTipo = filtroTipo === '' || registro.tipo_registro === filtroTipo;
    
    // Filtro por departamento
    const coincideDepartamento = filtroDepartamento === '' || registro.departamento === filtroDepartamento;
    
    return coincideEmpleado && coincideTipo && coincideDepartamento;
  });

  // Formatear fecha y hora por separado
  const formatearFechaHora = (fechaHora) => {
    if (!fechaHora) return { fecha: 'N/A', hora: 'N/A' };
    
    try {
      const fecha = new Date(fechaHora);
      return {
        fecha: fecha.toLocaleDateString('es-ES'),
        hora: fecha.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        })
      };
    } catch {
      return { fecha: 'N/A', hora: 'N/A' };
    }
  };

  // 🔥 ACTUALIZADO: Determinar color del chip con nueva lógica
  const getChipColor = (registro) => {
    const { hora } = formatearFechaHora(registro.fecha_hora);
    const horaNumero = parseInt(hora.split(':')[0]);
    
    // 🔥 NUEVA LÓGICA DE COLORES
    if (registro.es_calculado === false) {
      return 'warning'; // Tipo corregido
    }
    
    // Destacar por horario según la nueva lógica
    if (horaNumero < 12) {
      return 'secondary'; // Horario de salida (mañana)
    } else if (horaNumero >= 18) {
      return 'info'; // Horario de entrada (tarde)
    }
    
    return registro.tipo_registro === 'Entrada' ? 'success' : 'error';
  };

  // Determinar variante del chip
  const getChipVariant = (registro) => {
    return registro.es_calculado === false ? 'outlined' : 'filled';
  };

  // 🔥 ACTUALIZADO: Obtener tooltip informativo
  const getTooltipTitle = (registro) => {
    const { hora } = formatearFechaHora(registro.fecha_hora);
    const horaNumero = parseInt(hora.split(':')[0]);
    
    if (registro.es_calculado === false) {
      return `Corregido por lógica inteligente (Original: ${registro.tipo_original})`;
    }
    
    // 🔥 NUEVA EXPLICACIÓN SEGÚN LA LÓGICA ACTUAL
    if (horaNumero < 12) {
      return 'Entrada (7:30 AM)'; // Explicación para horario de entrada
    } else if (horaNumero >= 18) {
      return 'Salida (18:30 PM)'; // Explicación para horario de salida
    } else {
      return `Tipo determinado por lógica de posición (Checada #${registro.numero_checada})`;
    }
  };

  // Manejar cambio de página
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Exportar a CSV
  const exportarCSV = () => {
    const headers = ['Fecha', 'Hora', 'Empleado', 'Nombre', 'Departamento', 'Dispositivo', 'Tipo', 'Ubicación', 'N° Checada', 'Lógica'];
    const csvData = registrosFiltrados.map(registro => {
      const { fecha, hora } = formatearFechaHora(registro.fecha_hora);
      return [
        fecha,
        hora,
        registro.codigo_empleado || '',
        `${registro.nombre || ''} ${registro.apellido || ''}`.trim(),
        registro.departamento || 'N/A',
        registro.dispositivo || 'N/A',
        registro.tipo_registro || 'N/A',
        registro.ubicacion || 'N/A',
        registro.numero_checada || 'N/A',
        registro.es_calculado === false ? 'Corregido' : 'Calculado'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asistencias_${fechaInicio}_a_${fechaFin}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Datos para la paginación
  const paginatedRegistros = registrosFiltrados.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Título */}
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'border-gray', mb: 4 }}>
        📊 Registros de Asistencia - BioTime
      </Typography>

      {/* Botones de control */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button 
          variant="outlined" 
          color="info" 
          onClick={probarConexion}
          startIcon={<Cached />}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Probar Conexión API'}
        </Button>

        <Typography variant="body2" color="textSecondary" sx={{ ml: 2 }}>
          🔥 Lógica actual: Entrada= 8:00 AM • Salida= 18:30 PM
        </Typography>
      </Box>

      {/* KPIs - CON AUSENTES CORREGIDO */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Schedule sx={{ mr: 2 }} />
                <Typography variant="h6">Total Registros</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {loading ? <CircularProgress size={30} color="inherit" /> : estadisticas.totalRegistros.toLocaleString()}
              </Typography>
              <Typography variant="body2">Período seleccionado</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: 'secondary.main', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Person sx={{ mr: 2 }} />
                <Typography variant="h6">Empleados Activos</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {loading ? <CircularProgress size={30} color="inherit" /> : estadisticas.totalEmpleadosActivos}
              </Typography>
              <Typography variant="body2">Total en sistema</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DeviceHub sx={{ mr: 2 }} />
                <Typography variant="h6">Registros Hoy</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {loading ? <CircularProgress size={30} color="inherit" /> : estadisticas.registrosHoy}
              </Typography>
              <Typography variant="body2">{new Date().toLocaleDateString()}</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* KPI AUSENTES CORREGIDO */}
        <Grid item xs={12} sm={3}>
          <Card sx={{ 
            bgcolor: estadisticas.ausentesHoy > 0 ? 'warning.main' : 'info.main', 
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Group sx={{ mr: 2 }} />
                <Typography variant="h6">Ausentes Hoy</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {loading ? (
                  <CircularProgress size={30} color="inherit" />
                ) : (
                  `${estadisticas.ausentesHoy} / ${estadisticas.totalEmpleadosActivos}`
                )}
              </Typography>
              <Typography variant="body2">
                {estadisticas.ausentesHoy > 0 ? 'Sin registro hoy' : 'Todos presentes'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Barra de Búsqueda y Filtros MEJORADA */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Fecha Inicio */}
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="Fecha Inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={loading}
            />
          </Grid>

          {/* Fecha Fin */}
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="Fecha Fin"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={loading}
            />
          </Grid>

          {/* Buscar Empleado */}
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="Buscar Empleado"
              value={filtroEmpleado}
              onChange={(e) => {
                setFiltroEmpleado(e.target.value);
                setPage(0);
              }}
              placeholder="Código o nombre..."
              disabled={loading}
            />
          </Grid>

          {/* Filtro por Departamento */}
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth disabled={loading}>
              <InputLabel>Departamento</InputLabel>
              <Select
                value={filtroDepartamento}
                label="Departamento"
                onChange={(e) => {
                  setFiltroDepartamento(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Todos</MenuItem>
                {departamentos.map((dept, index) => (
                  <MenuItem key={index} value={dept}>{dept}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Filtro Tipo */}
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth disabled={loading}>
              <InputLabel>Tipo de Registro</InputLabel>
              <Select
                value={filtroTipo}
                label="Tipo de Registro"
                onChange={(e) => {
                  setFiltroTipo(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="Entrada">Entrada</MenuItem>
                <MenuItem value="Salida">Salida</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Botones de Acción */}
          <Grid item xs={12} sm={2}>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Search />}
              onClick={() => obtenerRegistros(fechaInicio, fechaFin)}
              disabled={loading || !fechaInicio || !fechaFin}
              fullWidth
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </Grid>
        </Grid>

        {/* Información y botones secundarios */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              setFiltroEmpleado('');
              setFiltroTipo('');
              setFiltroDepartamento('');
              setPage(0);
            }}
            disabled={loading}
          >
            Limpiar Filtros
          </Button>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              {registrosFiltrados.length} registros • Lógica Inteligente
            </Typography>
            <Button
              variant="contained"
              color="success"
              startIcon={<Download />}
              onClick={exportarCSV}
              disabled={registrosFiltrados.length === 0 || loading}
            >
              Exportar CSV
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Alertas de Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Snackbar de éxito */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={`✅ ${estadisticas.totalRegistros} registros cargados con lógica inteligente`}
      />

      {/* Tabla de Resultados MEJORADA */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Fecha</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Hora</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Empleado</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Departamento</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Dispositivo</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tipo</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Ubicación</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>N° Checada</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && registros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Cargando registros...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : registrosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      {registros.length === 0 
                        ? 'No hay registros para el período seleccionado' 
                        : 'No se encontraron registros con los filtros aplicados'
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRegistros.map((registro, index) => {
                  const { fecha, hora } = formatearFechaHora(registro.fecha_hora);
                  return (
                    <TableRow key={index} hover>
                      <TableCell>{fecha}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {hora}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {registro.codigo_empleado || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {registro.nombre || ''} {registro.apellido || ''}
                      </TableCell>
                      <TableCell>{registro.departamento || 'N/A'}</TableCell>
                      <TableCell>{registro.dispositivo || 'N/A'}</TableCell>
                      <TableCell>
                        <Tooltip title={getTooltipTitle(registro)}>
                          <Chip
                            label={registro.tipo_registro || 'N/A'}
                            color={getChipColor(registro)}
                            variant={getChipVariant(registro)}
                            size="small"
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>{registro.ubicacion || 'N/A'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 'bold'
                        }}>
                          {registro.numero_checada || 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Paginación */}
        {registrosFiltrados.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={registrosFiltrados.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Registros por página:"
          />
        )}
      </Paper>

      {/* 🔥 LEYENDA ACTUALIZADA */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          🎯 Leyenda - Lógica Inteligente
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Chip label="Entrada" color="success" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2">Entrada normal</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Chip label="Salida" color="error" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2">Salida Temprana</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Chip label="Entrada" color="secondary" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2">Entrada (8:00 AM)</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Chip label="Salida" color="info" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2"> Salida (18:30 PM)</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Chip label="Corregido" color="warning" variant="outlined" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2">Tipo corregido</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default BioTimeRegistros;