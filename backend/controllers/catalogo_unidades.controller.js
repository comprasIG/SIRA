// --- controllers/catalogo_unidades.controller.js ---

// 1. ¡CAMBIO IMPORTANTE! Usamos 'require' para importar tu pool
// La ruta '../db/pool.js' asume que tus carpetas 'controllers' y 'db'
// están dentro de la misma carpeta 'backend'.
const pool = require('../db/pool.js');

/**
 * Función para OBTENER todas las unidades de medida desde PostgreSQL.
 */
// 2. ¡CAMBIO IMPORTANTE! Usamos 'exports.' para exportar la función
exports.getUnidades = async (req, res) => {
  console.log("Controlador: getUnidades (POSTGRES) fue llamado");

  try {
    // 3. Ejecutamos la consulta (asumiendo nombres de tabla y columnas)
    const consulta = "SELECT * FROM catalogo_unidades";
    
    console.log("Ejecutando consulta:", consulta);
    const resultado = await pool.query(consulta);
    
    console.log(`Se encontraron ${resultado.rowCount} unidades.`);

    // 4. Enviamos los resultados (las filas) de vuelta como JSON
    res.json(resultado.rows);

  } catch (error) {
    // 5. Manejo de errores
    console.error("Error al consultar unidades:", error.stack);
    res.status(500).json({ 
      message: "Error interno del servidor al obtener las unidades." 
    });
  }
};