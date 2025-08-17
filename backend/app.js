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

// Ruta base de prueba
app.get('/', (req, res) => {
  res.send('Backend SIRA funcionando');
});

// Inicia el servidor
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
});
