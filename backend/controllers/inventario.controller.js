// backend/controllers/inventario.controller.js
const pool = require('../db/pool');


/**
 * GET /api/inventario/datos-filtros
 * Obtiene datos para los selectores de filtros de la página de inventario.
 */
const getDatosFiltrosInventario = async (_req, res) => {
    try {
        // Sitios y Proyectos relevantes (que tengan inventario actual o asignado)
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

        const [sitiosRes, proyectosRes] = await Promise.all([
            pool.query(sitiosQuery),
            pool.query(proyectosQuery),
        ]);

        res.json({
            sitios: sitiosRes.rows,
            proyectos: proyectosRes.rows,
            // Podríamos añadir más si fueran necesarios (ej. categorías de material)
        });
    } catch (error) {
        console.error('Error fetching filter data for /INV:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};

/**
 * GET /api/inventario
 * Obtiene la lista principal de inventario con filtros aplicados.
 */
const getInventarioActual = async (req, res) => {
    const { estado, sitioId, proyectoId, search } = req.query;

    let query = `
        SELECT
            ia.material_id,
            m.sku,
            m.nombre AS material_nombre,
            u.simbolo AS unidad_simbolo,
            ia.ubicacion_id, -- Para referencia interna, aunque agrupemos
            SUM(ia.stock_actual) AS total_stock,
            SUM(ia.asignado) AS total_asignado,
            SUM(ia.existencia_total) AS total_existencia -- Suma total física
            -- , MAX(ia.ultimo_precio_entrada) AS ultimo_costo -- Podríamos añadirlo si es útil en la tabla principal
            -- , MAX(ia.moneda) AS moneda_costo
        FROM inventario_actual ia
        JOIN catalogo_materiales m ON ia.material_id = m.id
        JOIN catalogo_unidades u ON m.unidad_de_compra = u.id
        WHERE ia.existencia_total >= 0 -- Incluye 0, excluye nulls si los hubiera
    `;
    const params = [];
    let paramIndex = 1;

    // Filtro de Estado
    if (estado === 'DISPONIBLE') {
        // Agrupa por material y solo incluye si la suma de stock es > 0
        // Necesitamos subconsulta o HAVING clause
    } else if (estado === 'APARTADO') {
        // Agrupa por material y solo incluye si la suma de asignado es > 0
        // O podríamos filtrar por existencia en inventario_asignado
    }

     // Filtro de Búsqueda (simple por ahora)
    if (search) {
        // Split search term into words and unaccent them
        const searchWords = search.split(' ').filter(word => word.length > 0);
        searchWords.forEach(word => {
            query += ` AND unaccent(m.nombre) ILIKE unaccent($${paramIndex++})`;
            params.push(`%${word}%`);
        });
        // Podríamos añadir búsqueda en SKU aquí también
    }


    // Agrupación principal por material
    query += `
        GROUP BY ia.material_id, m.sku, m.nombre, u.simbolo, ia.ubicacion_id
    `;

    // Filtro HAVING para estado (más eficiente después de agrupar)
    if (estado === 'DISPONIBLE') {
        query += ` HAVING SUM(ia.stock_actual) > 0`;
    } else if (estado === 'APARTADO') {
        // Filtrar por asignado > 0 o por existencia en tabla asignado
        // Si filtramos por existencia en tabla asignado (más preciso):
         query = `
            SELECT
                ia.material_id, m.sku, m.nombre AS material_nombre, u.simbolo AS unidad_simbolo,
                ia.ubicacion_id, SUM(ia.stock_actual) AS total_stock, SUM(ia.asignado) AS total_asignado,
                SUM(ia.existencia_total) AS total_existencia
            FROM inventario_actual ia
            JOIN catalogo_materiales m ON ia.material_id = m.id
            JOIN catalogo_unidades u ON m.unidad_de_compra = u.id
            WHERE ia.existencia_total >= 0
              AND ia.material_id IN (SELECT DISTINCT inv.material_id FROM inventario_asignado ias JOIN inventario_actual inv ON ias.inventario_id = inv.id WHERE ias.cantidad > 0)
              ${search ? searchWords.map((_, i) => ` AND unaccent(m.nombre) ILIKE unaccent($${i + 1})`).join('') : ''}
            GROUP BY ia.material_id, m.sku, m.nombre, u.simbolo, ia.ubicacion_id
            HAVING SUM(ia.asignado) > 0
            ORDER BY m.nombre ASC;
         `;
         params.length = 0; // Reset params as query changed
         if(search) { searchWords.forEach(word => params.push(`%${word}%`)); }

    } else { // TODOS (o estado inválido)
         // Filtro Sitio/Proyecto para TODOS o APARTADO
        if (sitioId || proyectoId) {
             query += ` AND ia.material_id IN (
                            SELECT DISTINCT inv.material_id FROM inventario_asignado ias
                            JOIN inventario_actual inv ON ias.inventario_id = inv.id
                            WHERE ias.cantidad > 0
                            ${sitioId ? ` AND ias.sitio_id = $${paramIndex++}` : ''}
                            ${proyectoId ? ` AND ias.proyecto_id = $${paramIndex++}` : ''}
                        )`;
             if (sitioId) params.push(sitioId);
             if (proyectoId) params.push(proyectoId);
        }

        query += ` ORDER BY m.nombre ASC`; // Orden final
    }


    try {
        const { rows } = await pool.query(query, params);
        // Podríamos necesitar procesar las filas para sumarizar si la agrupación no fue suficiente
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

        // 1. Encontrar ubicación(es) con stock suficiente
        const ubicacionesStock = await client.query(
            `SELECT id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda
             FROM inventario_actual
             WHERE material_id = $1 AND stock_actual > 0
             ORDER BY stock_actual DESC FOR UPDATE`, // Bloquea filas
            [material_id]
        );

        if (ubicacionesStock.rows.length === 0 || ubicacionesStock.rows.reduce((sum, u) => sum + parseFloat(u.stock_actual), 0) < cantidadNum) {
            throw new Error(`Stock insuficiente para el material ID ${material_id}.`);
        }

        let cantidadRestante = cantidadNum;
        const movimientos = []; // Para log

        for (const ubi of ubicacionesStock.rows) {
             const stockEnUbicacion = parseFloat(ubi.stock_actual);
             const cantidadARestar = Math.min(cantidadRestante, stockEnUbicacion);
             const valorUnitario = parseFloat(ubi.ultimo_precio_entrada) || 0;
             const moneda = ubi.moneda; // Moneda de la última entrada

             // 2. Reducir stock_actual y Aumentar asignado en inventario_actual
             const updateInvActual = await client.query(
                `UPDATE inventario_actual
                 SET stock_actual = stock_actual - $1,
                     asignado = asignado + $1,
                     actualizado_en = NOW()
                 WHERE id = $2 RETURNING id`, // Usamos el ID de la fila
                 [cantidadARestar, ubi.id]
             );
             const inventarioId = updateInvActual.rows[0].id; // ID de la fila en inventario_actual

            // 3. Insertar en inventario_asignado
            await client.query(
                `INSERT INTO inventario_asignado
                    (inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario, moneda, asignado_en)
                 VALUES ($1, NULL, $2, $3, $4, $5, $6, NOW())`,
                 [inventarioId, proyecto_id, sitio_id, cantidadARestar, valorUnitario, moneda]
            );

            // 4. Registrar movimientos (ajustes)
            // Ajuste Negativo para Stock
            await client.query(
                `INSERT INTO movimientos_inventario
                    (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
                 VALUES ($1, 'AJUSTE_NEGATIVO', $2, $3, $4, $5, $6, $7, $8)`,
                [material_id, cantidadARestar, usuarioId, ubi.ubicacion_id, proyecto_id, valorUnitario, moneda, 'Apartado de stock']
            );
             // Ajuste Positivo para Asignado (mismo material, misma ubicación física)
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

        // 1. Obtener datos de la asignación original (FOR UPDATE)
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

        // 2. Actualizar la asignación
        await client.query(
            `UPDATE inventario_asignado
             SET sitio_id = $1, proyecto_id = $2
             WHERE id = $3`,
            [nuevo_sitio_id, nuevo_proyecto_id, asignacion_id]
        );

        // 3. Registrar movimiento de TRASPASO (lógico)
        await client.query(
            `INSERT INTO movimientos_inventario
                (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
                 proyecto_origen_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
             VALUES ($1, 'TRASPASO', $2, $3, $4, $5, $6, $7, $8, $9)`,
            [material_id, cantidad, usuarioId, ubicacion_id, // Ubicación física no cambia
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
    getDatosFiltrosInventario,
    getInventarioActual,
    getDetalleAsignacionesMaterial,
    apartarStock,
    moverAsignacion,
};