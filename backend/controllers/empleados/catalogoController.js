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

        // 2. Ejecutamos las consultas exactas usando el MISMO cliente
        const [
            empresasResult,
            areasResult,
            puestosResult,
            departamentosRhResult,
            statusResult,
            nivelAcademicoResult 
        ] = await Promise.all([
            client.query('SELECT id, razon_social FROM empresas ORDER BY razon_social ASC'),
            client.query('SELECT id, nombre_area FROM areas ORDER BY nombre_area ASC'),
            client.query('SELECT id, nombre_puesto FROM puestos ORDER BY nombre_puesto ASC'),
            client.query('SELECT id, nombre FROM departamentos_rh ORDER BY nombre ASC'),
            client.query('SELECT id, nombre_status FROM status_trabajador ORDER BY id ASC'), 
            client.query('SELECT id, nivel AS nombre FROM nivel_academico') 
        ]);

        // 3. Construimos un objeto con todas las listas
        res.json({
            empresas: empresasResult.rows,
            areas: areasResult.rows,
            puestos: puestosResult.rows,
            departamentos_rh: departamentosRhResult.rows,
            status_trabajadores: statusResult.rows,
            nivel_academico: nivelAcademicoResult.rows 
        });

    } catch (error) {
        console.error("Error al obtener los catálogos:", error);
        res.status(500).json({ error: 'Error interno al cargar las listas de catálogos.' });
    } finally {
        // 4. ¡MUY IMPORTANTE! Liberamos el cliente de vuelta al pool
        if (client) {
            client.release();
        }
    }
};

module.exports = {
    obtenerTodosLosCatalogos
};