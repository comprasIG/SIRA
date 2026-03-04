const pool = require('../../db/pool'); // Ajusta la ruta a tu archivo pool.js si es necesario

/**
 * Obtiene todos los catálogos necesarios para los formularios de empleados
 * en una sola consulta para optimizar el rendimiento.
 */
const obtenerTodosLosCatalogos = async (req, res) => {
    try {
        // Ejecutamos todas las consultas en paralelo con Promise.all
        const [
            empresasResult,
            areasResult,
            puestosResult,
            departamentosRhResult,
            statusResult,
            departamentosResult
        ] = await Promise.all([
            pool.query('SELECT id, razon_social FROM empresas '),
            pool.query('SELECT id, nombre_area FROM areas ORDER BY nombre_area ASC'),
            pool.query('SELECT id, nombre_puesto FROM puestos ORDER BY nombre_puesto ASC'),
            pool.query('SELECT id, nombre FROM departamentos_rh ORDER BY nombre ASC'),
            pool.query('SELECT id, nombre_status FROM status_trabajador ORDER BY id ASC'), // Puede ser por ID para que "Activo" salga primero
            pool.query('SELECT id, nombre FROM departamentos ORDER BY nombre ASC') // El departamento operativo que ya tenías
        ]);

        // Construimos un objeto con todas las listas
        res.json({
            empresas: empresasResult.rows,
            areas: areasResult.rows,
            puestos: puestosResult.rows,
            departamentos_rh: departamentosRhResult.rows,
            status_trabajadores: statusResult.rows,
            departamentos: departamentosResult.rows
        });

    } catch (error) {
        console.error("Error al obtener los catálogos:", error);
        res.status(500).json({ error: 'Error interno al cargar las listas de catálogos.' });
    }
};

module.exports = {
    obtenerTodosLosCatalogos
};