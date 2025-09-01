//C:\SIRA\backend\app.js
require('dotenv').config();
const express = require('express');

const app = express();
const PORT = 3001; // o el puerto que quieras

// Middleware para recibir JSON
app.use(express.json());

//CORS
const cors = require('cors');
app.use(cors());

//  rutas
const requisicionesRoutes = require('./routes/requisiciones.routes');
app.use('/api/requisiciones', requisicionesRoutes);

// lista de proyectos
const proyectosRoutes = require('./routes/proyectos.routes');
app.use('/api/proyectos', proyectosRoutes);

// lista sitios
const sitiosRoutes = require('./routes/sitios.routes');
app.use('/api/sitios', sitiosRoutes);

// Busqueda de materiales por nombre
const materialesRoutes = require('./routes/materiales.routes');
app.use('/api/materiales', materialesRoutes);

// Rutas de usuarios
const usuariosRoutes = require("./routes/usuarios.routes");
app.use("/api/usuarios", usuariosRoutes);

// Rutas de roles
const rolesRoutes = require("./routes/roles.routes");
app.use("/api/roles", rolesRoutes);

// Rutas de departamentos
const departamentosRoutes = require("./routes/departamentos.routes");
app.use("/api/departamentos", departamentosRoutes);

// Rutas de RFQ 
const rfqRoutes = require("./routes/rfq.routes");
app.use("/api/rfq", rfqRoutes);

// Rutas de Proveedores
const proveedoresRoutes = require("./routes/proveedores.routes");
app.use("/api/proveedores", proveedoresRoutes);

// Rutas de Dashboard
const dashboardRoutes = require('./routes/dashboard.routes');
app.use('/api/dashboard', dashboardRoutes);

// Ruta base de prueba
app.get('/', (req, res) => {
  res.send('Backend SIRA funcionando');
});

// Rutas de autenticación y usuario
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Rutas de Agregar MAteriales
const catalogoMaterialesRoutes = require('./routes/catalogo_materiales.routes');
app.use('/api/catalogo_materiales', catalogoMaterialesRoutes);
// Rutas de subida de archivos
// Importa las nuevas rutas de subida
const uploadRoutes = require('./routes/uploadRoutes'); // Asegúrate de que la ruta al archivo sea correcta
app.use('/api/uploads', uploadRoutes); // Usa las rutas de subida bajo el prefijo /api/uploads


// Inicia el servidor
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
});
