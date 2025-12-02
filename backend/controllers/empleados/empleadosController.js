// backend/controllers/empleados/empleadosController.js
const pool = require('../../db/pool'); 

const obtenerEmpleados = async (req, res) => {
    try {
        // Ejecutamos la consulta SQL
        const result = await pool.query('SELECT * FROM empleados ORDER BY id ASC');
        
            // Enviamos los resultados como respuesta JSON
        res.json(result.rows); 
        
    } catch (error) {
        console.error("Error en la consulta:", error);
        res.status(500).json({ error: 'Error al obtener empleados de la BD' });
    }
};

module.exports = {
    obtenerEmpleados
};