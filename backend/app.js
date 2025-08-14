const express = require('express');
const app = express();
const PORT = 3001; // o el puerto que quieras

// Middleware para recibir JSON
app.use(express.json());

//  rutas
const requisicionesRoutes = require('./routes/requisiciones.routes');
app.use('/api/requisiciones', requisicionesRoutes);


// Ruta base de prueba
app.get('/', (req, res) => {
  res.send('Backend SIRA funcionando');
});

// Inicia el servidor
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
});
