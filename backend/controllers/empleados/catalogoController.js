const pool = require('../../db/pool'); 

/**
 * Obtiene todos los catálogos necesarios para los formularios de empleados
 * utilizando una sola conexión (client) para evitar agotar el pool.
 */
const obtenerTodosLosCatalogos = async (req, res) => {
    let client;
    try {
        // 1. Obtenemos un solo cliente (conexión) del pool
        client = await pool.connect();

        // 2. Ejecutamos las consultas secuencialmente o en paralelo, 
        // pero usando el MISMO cliente, lo que consume solo 1 conexión real.
        const [
            empresasResult,
            areasResult,
            puestosResult,
            departamentosRhResult,
            statusResult,
            departamentosResult,
            nivelAcademicoResult 
        ] = await Promise.all([
            client.query('SELECT id, razon_social FROM empresas ORDER BY razon_social ASC'),
            client.query('SELECT id, nombre_area FROM areas ORDER BY nombre_area ASC'),
            client.query('SELECT id, nombre_puesto FROM puestos ORDER BY nombre_puesto ASC'),
            client.query('SELECT id, nombre FROM departamentos_rh ORDER BY nombre ASC'),
            client.query('SELECT id, nombre_status FROM status_trabajador ORDER BY id ASC'), 
            client.query('SELECT id, nombre FROM departamentos ORDER BY nombre ASC'), 
            client.query('SELECT id, nivel AS nombre FROM nivel_academico') 
        ]);

        // Construimos un objeto con todas las listas
        res.json({
            empresas: empresasResult.rows,
            areas: areasResult.rows,
            puestos: puestosResult.rows,
            departamentos_rh: departamentosRhResult.rows,
            status_trabajadores: statusResult.rows,
            departamentos: departamentosResult.rows,
            nivel_academico: nivelAcademicoResult.rows 
        });

    } catch (error) {
        console.error("Error al obtener los catálogos:", error);
        res.status(500).json({ error: 'Error interno al cargar las listas de catálogos.' });
    } finally {
        // 3. ¡MUY IMPORTANTE! Liberamos el cliente de vuelta al pool
        if (client) {
            client.release();
        }
    }
};

module.exports = {
    obtenerTodosLosCatalogos
};