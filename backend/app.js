//C:\SIRA\backend\app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001; // o el puerto que quieras

// Middleware
app.use(express.json());
app.use(cors());

// Rutas
const requisicionesRoutes = require('./routes/requisiciones.routes'); // <-- IMPORTA el nuevo archivo de rutas
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

const ordenCompraRoutes = require('./routes/ordenCompra.routes');
app.use('/api/ocs', ordenCompraRoutes);

const monedaRoutes = require('./routes/moneda.routes')
app.use('/api/monedas', monedaRoutes);

const notificacionesRoutes = require('./routes/configuracion/notificaciones.routes'); 
app.use('/api/configuracion/notificaciones', notificacionesRoutes);

const finanzasRoutes = require('./routes/finanzas.routes');
app.use('/api/finanzas', finanzasRoutes);

const pagosOCRoutes = require('./routes/finanzas/pagosOC.routes');
app.use('/api/finanzas', pagosOCRoutes);

// Ruta base de prueba
app.get('/', (req, res) => {
  res.send('Backend SIRA funcionando');
});

// Inicia el servidor
app.listen(PORT, () => { 
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
});
