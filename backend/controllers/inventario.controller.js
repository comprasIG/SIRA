// backend/controllers/inventario.controller.js
const pool = require('../db/pool');

/**
 * GET /api/inventario/datos-iniciales
 * Fetches data for KPIs (grouped by currency) and Filter options.
 */
const getDatosIniciales = async (req, res) => {
    try {
        // --- KPI Queries ---
        const kpiSkuQuery = `
            SELECT COUNT(DISTINCT material_id) AS kpi_skus
            FROM inventario_actual
            WHERE existencia_total > 0;
        `;
        const valorDisponibleQuery = `
            SELECT
                moneda,
                COALESCE(SUM(stock_actual * ultimo_precio_entrada), 0) AS valor_total
            FROM inventario_actual
            WHERE stock_actual > 0 AND ultimo_precio_entrada > 0 AND moneda IS NOT NULL
            GROUP BY moneda;
        `;
        const valorApartadoQuery = `
            SELECT
                moneda,
                COALESCE(SUM(cantidad * valor_unitario), 0) AS valor_total
            FROM inventario_asignado
            WHERE cantidad > 0 AND valor_unitario > 0 AND moneda IS NOT NULL
            GROUP BY moneda;
        `;

        // --- Filter Option Queries ---
        const sitiosQuery = `
            SELECT DISTINCT s.id, s.nombre FROM sitios s
            JOIN inventario_actual ia ON s.id = ia.ubicacion_id
            WHERE ia.existencia_total > 0
            UNION
            SELECT DISTINCT s.id, s.nombre FROM sitios s
            JOIN inventario_asignado ias ON s.id = ias.sitio_id
            WHERE ias.cantidad > 0
            ORDER BY nombre ASC;
        `;
        const proyectosQuery = `
            SELECT DISTINCT p.id, p.nombre, p.sitio_id FROM proyectos p
            JOIN inventario_asignado ias ON p.id = ias.proyecto_id
            WHERE ias.cantidad > 0
            ORDER BY nombre ASC;
        `;
        const todosProyectosQuery = `SELECT id, nombre, sitio_id FROM proyectos ORDER BY nombre ASC`;
        const todosSitiosQuery = `SELECT id, nombre FROM sitios ORDER BY nombre ASC`;

        // --- CORRECCIÓN AQUÍ ---
        // Se corrigió pool.query(sitiosRes.rows) a pool.query(sitiosQuery)
        // y pool.query(proyectosRes.rows) a pool.query(proyectosQuery)
        const [
            kpiSkuRes,
            valorDisponibleRes,
            valorApartadoRes,
            sitiosRes,
            proyectosRes,
            todosProyectosRes,
            todosSitiosRes
        ] = await Promise.all([
            pool.query(kpiSkuQuery),
            pool.query(valorDisponibleQuery),
            pool.query(valorApartadoQuery),
            pool.query(sitiosQuery),       // <-- CORREGIDO
            pool.query(proyectosQuery),      // <-- CORREGIDO
            pool.query(todosProyectosQuery),
            pool.query(todosSitiosQuery)
        ]);

        // Combinar resultados de KPIs
        const kpisResult = {
            kpi_skus: parseInt(kpiSkuRes.rows[0]?.kpi_skus || 0, 10),
            valores_disponibles: valorDisponibleRes.rows.map(r => ({ ...r, valor_total: parseFloat(r.valor_total).toFixed(2) })),
            valores_apartados: valorApartadoRes.rows.map(r => ({ ...r, valor_total: parseFloat(r.valor_total).toFixed(2) }))
        };

        res.json({
            kpis: kpisResult,
            filterOptions: {
                sitios: sitiosRes.rows,
                proyectos: proyectosRes.rows,
                todosSitios: todosSitiosRes.rows,
                todosProyectos: todosProyectosRes.rows
            }
        });

    } catch (error) {
        console.error('Error fetching initial data for /INV:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};


/**
 * GET /api/inventario
 * Obtiene la lista principal de inventario con filtros aplicados.
 */
const getInventarioActual = async (req, res) => {
    const { estado, sitioId, proyectoId, search } = req.query;

    let params = [];
    let paramIndex = 1;
    // Agrupamos por material_id para tener una fila por material
    let queryBase = `
        SELECT
            ia.material_id,
            m.sku,
            m.nombre AS material_nombre,
            u.simbolo AS unidad_simbolo,
            SUM(ia.stock_actual) AS total_stock,
            SUM(ia.asignado) AS total_asignado,
            SUM(ia.existencia_total) AS total_existencia
        FROM inventario_actual ia
        JOIN catalogo_materiales m ON ia.material_id = m.id
        JOIN catalogo_unidades u ON m.unidad_de_compra = u.id
    `;
    let whereClauses = ["ia.existencia_total >= 0"];
    let havingClauses = [];

    // --- Filtro de Búsqueda ---
    if (search) {
        const searchWords = search.split(' ').filter(word => word.length > 0);
        searchWords.forEach(word => {
            whereClauses.push(`unaccent(m.nombre) ILIKE unaccent($${paramIndex++})`);
            params.push(`%${word}%`);
        });
    }

    // --- Filtros de Sitio/Proyecto (afectan con JOIN) ---
    // Se aplican solo si el estado es 'TODOS' o 'APARTADO'
    if ((estado === 'TODOS' || estado === 'APARTADO') && (sitioId || proyectoId)) {
        // Usamos un Sub-SELECT en WHERE para filtrar los material_id
        // que pertenecen a asignaciones con ese sitio/proyecto
        whereClauses.push(`
            ia.material_id IN (
                SELECT DISTINCT ia_inner.material_id
                FROM inventario_asignado ias
                JOIN inventario_actual ia_inner ON ias.inventario_id = ia_inner.id
                WHERE ias.cantidad > 0
                ${sitioId ? ` AND ias.sitio_id = $${paramIndex++}` : ''}
                ${proyectoId ? ` AND ias.proyecto_id = $${paramIndex++}` : ''}
            )
        `);
        if (sitioId) params.push(sitioId);
        if (proyectoId) params.push(proyectoId);
    }

    // --- Construir Query Final ---
    if (whereClauses.length > 0) {
        queryBase += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    // Agrupación principal por material
    queryBase += ` GROUP BY ia.material_id, m.sku, m.nombre, u.simbolo`;

    // --- Filtro de Estado (afecta HAVING) ---
    if (estado === 'DISPONIBLE') {
        havingClauses.push(`SUM(ia.stock_actual) > 0`);
    } else if (estado === 'APARTADO') {
        havingClauses.push(`SUM(ia.asignado) > 0`);
    }
    
    if (havingClauses.length > 0) {
        queryBase += ` HAVING ${havingClauses.join(' AND ')}`;
    }
    
    queryBase += ` ORDER BY m.nombre ASC`;

    try {
        const { rows } = await pool.query(queryBase, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching inventory list:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};

/**
 * GET /api/inventario/material/:materialId/asignaciones
 * Obtiene el detalle de a qué proyectos/sitios está asignado un material.
 */
const getDetalleAsignacionesMaterial = async (req, res) => {
    const { materialId } = req.params;
    try {
        const query = `
            SELECT
                ias.id AS asignacion_id,
                p.nombre AS proyecto_nombre,
                s.nombre AS sitio_nombre,
                ias.cantidad,
                ias.valor_unitario,
                ias.moneda
            FROM inventario_asignado ias
            JOIN proyectos p ON ias.proyecto_id = p.id
            JOIN sitios s ON ias.sitio_id = s.id
            JOIN inventario_actual ia ON ias.inventario_id = ia.id
            WHERE ia.material_id = $1 AND ias.cantidad > 0
            ORDER BY p.nombre, s.nombre;
        `;
        const { rows } = await pool.query(query, [materialId]);
        res.json(rows);
    } catch (error) {
        console.error(`Error fetching assignments for material ${materialId}:`, error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};

/**
 * POST /api/inventario/apartar
 * Aparta stock general para un proyecto específico.
 */
const apartarStock = async (req, res) => {
    const { material_id, cantidad, sitio_id, proyecto_id } = req.body;
    const { id: usuarioId } = req.usuarioSira;
    const cantidadNum = parseFloat(cantidad) || 0;

    if (!material_id || cantidadNum <= 0 || !sitio_id || !proyecto_id) {
        return res.status(400).json({ error: 'Faltan datos para apartar el material.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ubicacionesStock = await client.query(
            `SELECT id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda
             FROM inventario_actual
             WHERE material_id = $1 AND stock_actual > 0
             ORDER BY stock_actual DESC FOR UPDATE`,
            [material_id]
        );

        const stockTotalDisponible = ubicacionesStock.rows.reduce((sum, u) => sum + parseFloat(u.stock_actual), 0);
        if (ubicacionesStock.rows.length === 0 || stockTotalDisponible < cantidadNum) {
            throw new Error(`Stock insuficiente para el material ID ${material_id}. Solicitado: ${cantidadNum}, Disponible: ${stockTotalDisponible}`);
        }

        let cantidadRestante = cantidadNum;
        const movimientos = [];

        for (const ubi of ubicacionesStock.rows) {
             const stockEnUbicacion = parseFloat(ubi.stock_actual);
             const cantidadARestar = Math.min(cantidadRestante, stockEnUbicacion);
             const valorUnitario = parseFloat(ubi.ultimo_precio_entrada) || 0;
             const moneda = ubi.moneda;
             const inventarioId = ubi.id;

             await client.query(
                `UPDATE inventario_actual
                 SET stock_actual = stock_actual - $1,
                     asignado = asignado + $1,
                     actualizado_en = NOW()
                 WHERE id = $2`,
                 [cantidadARestar, inventarioId]
             );

            await client.query(
                `INSERT INTO inventario_asignado
                    (inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario, moneda, asignado_en)
                 VALUES ($1, NULL, $2, $3, $4, $5, $6, NOW())`,
                 [inventarioId, proyecto_id, sitio_id, cantidadARestar, valorUnitario, moneda]
            );

            await client.query(
                `INSERT INTO movimientos_inventario
                    (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
                 VALUES ($1, 'AJUSTE_NEGATIVO', $2, $3, $4, $5, $6, $7, $8)`,
                [material_id, cantidadARestar, usuarioId, ubi.ubicacion_id, proyecto_id, valorUnitario, moneda, 'Apartado de stock']
            );
            await client.query(
                `INSERT INTO movimientos_inventario
                    (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
                 VALUES ($1, 'AJUSTE_POSITIVO', $2, $3, $4, $5, $6, $7, $8)`,
                [material_id, cantidadARestar, usuarioId, ubi.ubicacion_id, proyecto_id, valorUnitario, moneda, 'Apartado a proyecto']
            );

            movimientos.push({ ubicacion_id: ubi.ubicacion_id, cantidad: cantidadARestar });
            cantidadRestante -= cantidadARestar;
            if (cantidadRestante <= 0) break;
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Material apartado exitosamente.', detalles: movimientos });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al apartar stock:', error);
        res.status(500).json({ error: error.message || 'Error interno al apartar stock.' });
    } finally {
        client.release();
    }
};

/**
 * POST /api/inventario/mover-asignacion
 * Mueve una asignación existente de un proyecto/sitio a otro.
 */
const moverAsignacion = async (req, res) => {
    const { asignacion_id, nuevo_sitio_id, nuevo_proyecto_id } = req.body;
    const { id: usuarioId } = req.usuarioSira;

    if (!asignacion_id || !nuevo_sitio_id || !nuevo_proyecto_id) {
        return res.status(400).json({ error: 'Faltan datos para mover la asignación.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const asignacionOriginal = await client.query(
            `SELECT ia.*, inv.material_id, inv.ubicacion_id
             FROM inventario_asignado ia
             JOIN inventario_actual inv ON ia.inventario_id = inv.id
             WHERE ia.id = $1 FOR UPDATE`,
            [asignacion_id]
        );
        if (asignacionOriginal.rowCount === 0) {
            throw new Error(`Asignación con ID ${asignacion_id} no encontrada.`);
        }
        const { proyecto_id: origen_proyecto_id, sitio_id: origen_sitio_id, cantidad, valor_unitario, moneda, material_id, ubicacion_id } = asignacionOriginal.rows[0];

        await client.query(
            `UPDATE inventario_asignado
             SET sitio_id = $1, proyecto_id = $2
             WHERE id = $3`,
            [nuevo_sitio_id, nuevo_proyecto_id, asignacion_id]
        );

        await client.query(
            `INSERT INTO movimientos_inventario
                (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
                 proyecto_origen_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
             VALUES ($1, 'TRASPASO', $2, $3, $4, $5, $6, $7, $8, $9)`,
            [material_id, cantidad, usuarioId, ubicacion_id,
             origen_proyecto_id, nuevo_proyecto_id, valor_unitario, moneda,
             `Movimiento de asignación (AsigID: ${asignacion_id})`]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Asignación movida exitosamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al mover asignación:', error);
        res.status(500).json({ error: error.message || 'Error interno al mover asignación.' });
    } finally {
        client.release();
    }
};

module.exports = {
    // getDatosFiltrosInventario, // <--- Eliminado, reemplazado por getDatosIniciales
    getInventarioActual,
    getDetalleAsignacionesMaterial,
    apartarStock,
    moverAsignacion,
    getDatosIniciales, // <<< Ruta principal de datos
};