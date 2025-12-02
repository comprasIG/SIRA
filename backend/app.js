// C:\SIRA\backend\app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// ===============================================
// --- ¡CORRECCIÓN 1: LÓGICA DE CORS DINÁMICA! ---
// (Esto arregla el error de Staging)
// ===============================================

// 1. Define tu "lista blanca" de orígenes permitidos
const whitelist = [
  'https://stg.sira-ig.com',    // Tu frontend de Staging
  'https://www.sira-ig.com',  // Tu frontend de Producción
];

// 2. Agrega el origen local SÓLO si estás en modo desarrollo
if (process.env.NODE_ENV === 'development') {
  whitelist.push('http://localhost:5173');
}

// 3. Configuración de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permite peticiones de la lista blanca o sin origen (como Postman)
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      // Rechaza peticiones de otros orígenes
      callback(new Error(`CORS: El origen ${origin} no está permitido.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// 4. Usa la nueva configuración de CORS
app.use(cors(corsOptions));
// ===============================================
// --- FIN DE LA CORRECCIÓN 1 ---
// ===============================================


// Middleware "espía" para ver todas las peticiones
app.use((req, res, next) => {
  console.log(`Petición recibida: ${req.method} ${req.originalUrl}`);
  next();
});

// Endpoint de Health Check
app.get('/status', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Service is up and running' });
});

// ===============================================
// --- ¡CORRECCIÓN 2: SINTAXIS DE REQUIRE ORIGINAL! ---
// (Esto arregla tu error 'MODULE_NOT_FOUND' local)
// ===============================================
const requisicionesRoutes = require('./routes/requisiciones.routes');
app.use('/api/requisiciones', requisicionesRoutes);

const proyectosRoutes = require('./routes/proyectos.routes');
app.use('/api/proyectos', proyectosRoutes);

const sitiosRoutes = require('./routes/sitios.routes');
app.use('/api/sitios', sitiosRoutes);

const materialesRoutes = require('./routes/materiales.routes');
app.use('/api/materiales', materialesRoutes);

const usuariosRoutes = require("./routes/usuarios.routes");
app.use("/api/usuarios", usuariosRoutes);

const rolesRoutes = require("./routes/roles.routes");
app.use("/api/roles", rolesRoutes);

const departamentosRoutes = require("./routes/departamentos.routes");
app.use("/api/departamentos", departamentosRoutes);

const rfqRoutes = require("./routes/rfq.routes");
app.use("/api/rfq", rfqRoutes);

const proveedoresRoutes = require("./routes/proveedores.routes");
app.use("/api/proveedores", proveedoresRoutes);

const dashboardRoutes = require('./routes/dashboard.routes');
app.use('/api/dashboard', dashboardRoutes);

const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

const catalogoMaterialesRoutes = require('./routes/catalogo_materiales.routes');
app.use('/api/catalogo_materiales', catalogoMaterialesRoutes);

const catalogoUnidadesRoutes = require('./routes/catalogo_unidades.routes.js');
app.use('/api', catalogoUnidadesRoutes);

const ordenCompraRoutes = require('./routes/ordenCompra.routes');
app.use('/api/ocs', ordenCompraRoutes);

const monedaRoutes = require('./routes/moneda.routes');
app.use('/api/monedas', monedaRoutes);

const notificacionesRoutes = require('./routes/configuracion/notificaciones.routes');
app.use('/api/configuracion/notificaciones', notificacionesRoutes);

const finanzasRoutes = require('./routes/finanzas.routes');
app.use('/api/finanzas', finanzasRoutes);

const pagosOCRoutes = require('./routes/finanzas/pagosOC.routes');
app.use('/api/finanzas', pagosOCRoutes);

const recoleccionRoutes = require('./routes/recoleccion.routes');
app.use('/api/recoleccion', recoleccionRoutes);

const ingresoRoutes = require('./routes/ingreso.routes');
app.use('/api/ingreso', ingresoRoutes);

const retiroRoutes = require('./routes/retiro.routes');
app.use('/api/retiro', retiroRoutes);

const inventarioRoutes = require('./routes/inventario.routes');
app.use('/api/inventario', inventarioRoutes);

// Desde la raíz (backend), entramos directo a routes
const empleadosRoutes = require('./routes/empleados/empleados.routes');
app.use('/api/empleados', empleadosRoutes);

// --- ¡NUESTRA RUTA (AHORA CORRECTA)! ---
const unidadesRoutes = require('./routes/unidades.routes');
app.use('/api/unidades', unidadesRoutes);


// ===============================================
// --- FIN DE LA CORRECCIÓN 2 ---
// ===============================================

// Ruta base de prueba
app.get('/', (_req, res) => {
  res.send('Backend SIRA - ¡Despliegue Automático! V1.0.7🎉🎉');
});

// Inicia el servidor
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
});