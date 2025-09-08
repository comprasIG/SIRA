/** C:\SIRA\backend\controllers\moneda.controller.js
 * =================================================================================================
 * CONTROLADOR: Monedas
 * =================================================================================================
 * @file moneda.controller.js
 * @description Maneja las solicitudes relacionadas con el catálogo de monedas del sistema.
 */

// --- Importaciones ---
const pool = require('../db/pool');

/**
 * @route   GET /api/monedas
 * @desc    Obtiene la lista de todas las monedas disponibles.
 * @access  Privado (Requiere autenticación)
 */
const getAllMonedas = async (req, res) => {
  try {
    const queryResult = await pool.query(
      'SELECT codigo, nombre FROM catalogo_monedas ORDER BY codigo'
    );
    res.status(200).json(queryResult.rows);
  } catch (error) {
    console.error('Error al obtener el catálogo de monedas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// --- Exportaciones ---
module.exports = {
  getAllMonedas,
};