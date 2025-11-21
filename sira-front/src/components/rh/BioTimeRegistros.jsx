// C:\SIRA\sira-front\src\components\rh\BioTimeRegistros.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,Typography,TextField,Button,Paper,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,TablePagination,
  Chip,Grid,Card,CardContent,CircularProgress,Alert,FormControl,InputLabel,Select,MenuItem,Snackbar} from '@mui/material';
import { 
  Search, Refresh, Download, Person, Schedule,DeviceHub,Cached} from '@mui/icons-material';

const BioTimeRegistros = () => {
  // Estados
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [estadisticas, setEstadisticas] = useState({
    totalRegistros: 0,
    totalEmpleados: 0,
    registrosHoy: 0
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Configuración de la API
  const API_CONFIG = {
    baseURL: 'http://26.228.180.16:8000',
    apiKey: 'BioTime__m1dGSuH7Y2iOnJ1BqY4_m4jsGYDIrWOzXKbAaZuCxk',
    timeout: 15000
  };

  // 🔥 CORRECCIÓN 1: Cargar automáticamente al montar el componente
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

  // 🔥 CORRECCIÓN 2: Función mejorada para obtener registros
  const obtenerRegistros = async (fechaInicio, fechaFin) => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📅 Solicitando registros...', { fechaInicio, fechaFin });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      const response = await fetch(
        `${API_CONFIG.baseURL}/asistencias/?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`,
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
      console.log('✅ Datos recibidos:', data);

      // 🔥 CORRECCIÓN 3: Manejar cuando no hay datos
      const datosArray = data.datos || [];
      setRegistros(datosArray);
      
      // Calcular estadísticas
      const empleadosUnicos = new Set(datosArray.map(r => r.codigo_empleado)).size;
      const registrosHoy = datosArray.filter(r => {
        try {
          const fechaRegistro = new Date(r.fecha_hora).toDateString();
          const hoy = new Date().toDateString();
          return fechaRegistro === hoy;
        } catch {
          return false;
        }
      }).length;

      setEstadisticas({
        totalRegistros: data.total_registros || datosArray.length,
        totalEmpleados: empleadosUnicos,
        registrosHoy: registrosHoy
      });

      setSnackbarOpen(true);

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

  // 🔥 CORRECCIÓN 4: Función de filtrado MEJORADA
  const registrosFiltrados = registros.filter(registro => {
    if (!registro) return false;
    
    // Filtro por empleado (código, nombre o apellido)
    const coincideEmpleado = filtroEmpleado === '' || 
      (registro.codigo_empleado && registro.codigo_empleado.toString().toLowerCase().includes(filtroEmpleado.toLowerCase())) ||
      (registro.nombre && registro.nombre.toLowerCase().includes(filtroEmpleado.toLowerCase())) ||
      (registro.apellido && registro.apellido.toLowerCase().includes(filtroEmpleado.toLowerCase()));
    
    // Filtro por tipo de registro
    const coincideTipo = filtroTipo === '' || registro.tipo_registro === filtroTipo;
    
    return coincideEmpleado && coincideTipo;
  });

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
    const headers = ['Fecha/Hora', 'Empleado', 'Nombre', 'Departamento', 'Dispositivo', 'Tipo', 'Ubicación'];
    const csvData = registrosFiltrados.map(registro => [
      registro.fecha_hora || '',
      registro.codigo_empleado || '',
      `${registro.nombre || ''} ${registro.apellido || ''}`.trim(),
      registro.departamento || 'N/A',
      registro.dispositivo || 'N/A',
      registro.tipo_registro || 'N/A',
      registro.ubicacion || 'N/A'
    ]);

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

      {/* Botón de prueba de conexión */}
      <Box sx={{ mb: 3 }}>
        <Button 
          variant="outlined" 
          color="info" 
          onClick={probarConexion}
          startIcon={<Cached />}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Probar Conexión API'}
        </Button>
      </Box>

      {/* KPIs - 🔥 CORRECCIÓN 5: Mostrar siempre, incluso cuando loading */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            bgcolor: 'primary.main', 
            color: 'white',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.3s'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Schedule sx={{ mr: 2 }} />
                <Typography variant="h6">Total Registros</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {loading ? (
                  <CircularProgress size={30} color="inherit" />
                ) : (
                  estadisticas.totalRegistros.toLocaleString()
                )}
              </Typography>
              <Typography variant="body2">
                Período seleccionado
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            bgcolor: 'secondary.main', 
            color: 'white',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.3s'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Person sx={{ mr: 2 }} />
                <Typography variant="h6">Empleados Activos</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {loading ? (
                  <CircularProgress size={30} color="inherit" />
                ) : (
                  estadisticas.totalEmpleados
                )}
              </Typography>
              <Typography variant="body2">
                Con registros en período
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            bgcolor: 'success.main', 
            color: 'white',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.3s'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DeviceHub sx={{ mr: 2 }} />
                <Typography variant="h6">Registros Hoy</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {loading ? (
                  <CircularProgress size={30} color="inherit" />
                ) : (
                  estadisticas.registrosHoy
                )}
              </Typography>
              <Typography variant="body2">
                {new Date().toLocaleDateString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Barra de Búsqueda y Filtros */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Fecha Inicio */}
          <Grid item xs={12} sm={3}>
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
          <Grid item xs={12} sm={3}>
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

          {/* 🔥 CORRECCIÓN 6: Buscar Empleado - MEJORADO */}
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="Buscar Empleado"
              value={filtroEmpleado}
              onChange={(e) => {
                setFiltroEmpleado(e.target.value);
                setPage(0); // Resetear a primera página al buscar
              }}
              placeholder="Código o nombre..."
              disabled={loading}
              helperText={`${registrosFiltrados.length} resultados`}
            />
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
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Search />}
                onClick={() => obtenerRegistros(fechaInicio, fechaFin)}
                disabled={loading || !fechaInicio || !fechaFin}
                sx={{ minWidth: 140 }}
              >
                {loading ? 'Buscando...' : 'Buscar Registros'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Botones secundarios */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              setFiltroEmpleado('');
              setFiltroTipo('');
              setPage(0);
            }}
            disabled={loading}
          >
            Limpiar Filtros
          </Button>

          <Button
            variant="contained"
            color="success"
            startIcon={<Download />}
            onClick={exportarCSV}
            disabled={registrosFiltrados.length === 0 || loading}
          >
            Exportar CSV ({registrosFiltrados.length})
          </Button>
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
        message={`✅ ${estadisticas.totalRegistros} registros cargados correctamente`}
      />

      {/* Tabla de Resultados */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Fecha/Hora</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Empleado</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Departamento</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Dispositivo</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tipo</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Ubicación</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && registros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Cargando registros...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : registrosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      {registros.length === 0 
                        ? 'No hay registros para el período seleccionado' 
                        : `No se encontraron registros con "${filtroEmpleado}"`
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRegistros.map((registro, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      {registro.fecha_hora ? new Date(registro.fecha_hora).toLocaleString('es-ES') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {registro.codigo_empleado || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {registro.nombre || ''} {registro.apellido || ''}
                    </TableCell>
                    <TableCell>{registro.departamento || 'N/A'}</TableCell>
                    <TableCell>{registro.dispositivo || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={registro.tipo_registro || 'N/A'}
                        color={registro.tipo_registro === 'Entrada' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{registro.ubicacion || 'N/A'}</TableCell>
                  </TableRow>
                ))
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
    </Box>
  );
};

export default BioTimeRegistros;