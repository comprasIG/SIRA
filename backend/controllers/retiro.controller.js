// backend/controllers/retiro.controller.js
const pool = require('../db/pool');

/**
 * GET /api/retiro/datos-filtros
 * Obtiene las opciones para los filtros de retiro (Sitios/Proyectos con asignaciones, Materiales en stock).
 */
/**
 * GET /api/retiro/datos-filtros
 * Obtiene las opciones para los filtros de retiro (Sitios/Proyectos con asignaciones, Materiales en stock).
 */
const getDatosFiltrosRetiro = async (req, res) => {
    try {
        // Sitios con material asignado
        const sitiosQuery = `
            SELECT DISTINCT s.id, s.nombre FROM sitios s
            JOIN inventario_asignado ia ON s.id = ia.sitio_id
            WHERE ia.cantidad > 0 ORDER BY s.nombre ASC;
        `;
        // Proyectos con material asignado
        const proyectosQuery = `
            SELECT DISTINCT p.id, p.nombre, p.sitio_id FROM proyectos p
            JOIN inventario_asignado ia ON p.id = ia.proyecto_id
            WHERE ia.cantidad > 0 ORDER BY p.nombre ASC;
        `;
        
        // --- CORRECCIÓN AQUÍ: Añadir SUM(ia.stock_actual) AS stock_total ---
        const materialesStockQuery = `
            SELECT
                cm.id,
                cm.nombre,
                cu.simbolo AS unidad_simbolo,
                SUM(ia.stock_actual) AS stock_total -- <<< CAMBIO: Calcular el stock total
            FROM catalogo_materiales cm
            JOIN inventario_actual ia ON cm.id = ia.material_id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE ia.stock_actual > 0
            GROUP BY cm.id, cm.nombre, cu.simbolo -- Agrupar por material
            ORDER BY cm.nombre ASC;
        `;
        // --- FIN CORRECCIÓN ---

         // Todos los Proyectos y Sitios para el destino del retiro de stock
        const todosProyectosQuery = `SELECT id, nombre, sitio_id FROM proyectos ORDER BY nombre ASC`;
        const todosSitiosQuery = `SELECT id, nombre FROM sitios ORDER BY nombre ASC`;


        const [sitiosRes, proyectosRes, materialesStockRes, todosProyectosRes, todosSitiosRes] = await Promise.all([
            pool.query(sitiosQuery),
            pool.query(proyectosQuery),
            pool.query(materialesStockQuery), // <<< Se ejecuta la query corregida
            pool.query(todosProyectosQuery),
            pool.query(todosSitiosQuery),
        ]);

        res.json({
            sitiosAsignados: sitiosRes.rows,
            proyectosAsignados: proyectosRes.rows,
            materialesEnStock: materialesStockRes.rows, // <<< Ahora esta lista incluye stock_total
            todosProyectos: todosProyectosRes.rows, // Para selector de destino
            todosSitios: todosSitiosRes.rows,       // Para selector de destino
        });

    } catch (error) {
        console.error('Error fetching filter data for PICK_IN:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};
/**
 * GET /api/retiro/asignado/:sitioId/:proyectoId
 * Obtiene la lista de materiales asignados a un proyecto/sitio específico.
 */
const getMaterialesAsignados = async (req, res) => {
    const { sitioId, proyectoId } = req.params;
    try {
        const query = `
            SELECT
                ia.id AS asignacion_id, -- ID de la fila en inventario_asignado
                inv.material_id,
                cm.nombre AS material_nombre,
                cu.simbolo AS unidad_simbolo,
                ia.cantidad AS cantidad_asignada_pendiente,
                ia.valor_unitario,
                inv.ubicacion_id -- Ubicación física donde está el material asignado
            FROM inventario_asignado ia
            JOIN inventario_actual inv ON ia.inventario_id = inv.id
            JOIN catalogo_materiales cm ON inv.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE ia.sitio_id = $1 AND ia.proyecto_id = $2 AND ia.cantidad > 0
            ORDER BY cm.nombre ASC;
        `;
        const { rows } = await pool.query(query, [sitioId, proyectoId]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching assigned materials:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};

/**
 * GET /api/retiro/stock/:materialId
 * Obtiene el stock total disponible y las ubicaciones para un material específico.
 */
const getStockMaterial = async (req, res) => {
    const { materialId } = req.params;
    try {
        const query = `
            SELECT
                SUM(stock_actual) AS stock_total,
                jsonb_agg(jsonb_build_object('ubicacion_id', ubicacion_id, 'stock', stock_actual))
                    FILTER (WHERE stock_actual > 0) AS ubicaciones_con_stock
            FROM inventario_actual
            WHERE material_id = $1 AND stock_actual > 0;
        `;
        const { rows } = await pool.query(query, [materialId]);
        res.json(rows[0] || { stock_total: 0, ubicaciones_con_stock: [] }); // Devuelve 0 si no hay stock
    } catch (error) {
        console.error('Error fetching stock for material:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};


/**
 * POST /api/retiro/registrar
 * Registra el retiro de material (asignado o de stock).
 */
const registrarRetiro = async (req, res) => {
    const { tipoRetiro, items, proyectoDestinoId, sitioDestinoId } = req.body;
    // tipoRetiro: 'ASIGNADO' | 'STOCK'
    // items (ASIGNADO): [{ asignacion_id, material_id, cantidad_a_retirar, valor_unitario, ubicacion_id }]
    // items (STOCK): [{ material_id, cantidad_a_retirar }]
    const { id: usuarioId } = req.usuarioSira;

    if (!tipoRetiro || !Array.isArray(items) || items.length === 0 || !proyectoDestinoId || !sitioDestinoId) {
        return res.status(400).json({ error: 'Datos de retiro inválidos.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const movimientosRegistrados = []; // Para log de historial

        if (tipoRetiro === 'ASIGNADO') {
            for (const item of items) {
                const { asignacion_id, material_id, cantidad_a_retirar, valor_unitario, ubicacion_id } = item;
                const cantidadNum = parseFloat(cantidad_a_retirar) || 0;

                if (cantidadNum <= 0) continue;

                // 1. Reducir cantidad en inventario_asignado (FOR UPDATE para bloqueo)
                const asignadoUpdate = await client.query(
                    `UPDATE inventario_asignado SET cantidad = cantidad - $1
                     WHERE id = $2 AND cantidad >= $1 RETURNING cantidad`,
                    [cantidadNum, asignacion_id]
                );
                if (asignadoUpdate.rowCount === 0) {
                    throw new Error(`Stock asignado insuficiente o ID ${asignacion_id} inválido.`);
                }

                // 2. Reducir 'asignado' en inventario_actual
                const actualUpdate = await client.query(
                    `UPDATE inventario_actual SET asignado = asignado - $1, actualizado_en = NOW()
                     WHERE material_id = $2 AND ubicacion_id = $3 AND asignado >= $1`,
                    [cantidadNum, material_id, ubicacion_id]
                );
                 if (actualUpdate.rowCount === 0) {
                    // Esto no debería pasar si el paso 1 tuvo éxito, pero es una salvaguarda
                    throw new Error(`Error al actualizar inventario físico asignado para material ${material_id} en ubicación ${ubicacion_id}.`);
                }

                // 3. Insertar en movimientos_inventario
                const movimientoInsert = await client.query(
                   `INSERT INTO movimientos_inventario
                       (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, proyecto_destino_id, valor_unitario, observaciones)
                    VALUES ($1, 'SALIDA', $2, $3, $4, $5, $6, $7) RETURNING id`,
                   [material_id, cantidadNum, usuarioId, ubicacion_id, proyectoDestinoId, valor_unitario, `Retiro asignado (AsigID: ${asignacion_id})`]
                );
                movimientosRegistrados.push({
                    movimiento_id: movimientoInsert.rows[0].id,
                    material_id, ubicacion_id, cantidad: cantidadNum, valor: cantidadNum * valor_unitario
                });
            }
        } else if (tipoRetiro === 'STOCK') {
            for (const item of items) {
                const { material_id, cantidad_a_retirar } = item;
                let cantidadRestante = parseFloat(cantidad_a_retirar) || 0;

                if (cantidadRestante <= 0) continue;

                // Obtener ubicaciones con stock para este material (ordenadas por stock desc, por ejemplo)
                const ubicacionesStock = await client.query(
                    `SELECT id, ubicacion_id, stock_actual, ultimo_precio_entrada
                     FROM inventario_actual
                     WHERE material_id = $1 AND stock_actual > 0
                     ORDER BY stock_actual DESC FOR UPDATE`, // Bloquea las filas
                    [material_id]
                );

                if (ubicacionesStock.rows.length === 0 || ubicacionesStock.rows.reduce((sum, u) => sum + parseFloat(u.stock_actual), 0) < cantidadRestante) {
                    throw new Error(`Stock insuficiente para el material ID ${material_id}.`);
                }

                for (const ubi of ubicacionesStock.rows) {
                    const stockEnUbicacion = parseFloat(ubi.stock_actual);
                    const cantidadARestar = Math.min(cantidadRestante, stockEnUbicacion);
                    const valorUnitario = parseFloat(ubi.ultimo_precio_entrada) || 0;

                    // 1. Reducir stock_actual en inventario_actual
                    await client.query(
                        `UPDATE inventario_actual SET stock_actual = stock_actual - $1, actualizado_en = NOW() WHERE id = $2`,
                        [cantidadARestar, ubi.id]
                    );

                    // 2. Insertar en movimientos_inventario
                    const movimientoInsert = await client.query(
                        `INSERT INTO movimientos_inventario
                            (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, proyecto_destino_id, valor_unitario, observaciones)
                         VALUES ($1, 'SALIDA', $2, $3, $4, $5, $6, $7) RETURNING id`,
                        [material_id, cantidadARestar, usuarioId, ubi.ubicacion_id, proyectoDestinoId, valorUnitario, 'Retiro de stock general']
                    );
                     movimientosRegistrados.push({
                        movimiento_id: movimientoInsert.rows[0].id,
                        material_id, ubicacion_id: ubi.ubicacion_id, cantidad: cantidadARestar, valor: cantidadARestar * valorUnitario
                     });

                    cantidadRestante -= cantidadARestar;
                    if (cantidadRestante <= 0) break; // Terminamos si ya cubrimos la cantidad
                }
            }
        } else {
            throw new Error('Tipo de retiro no válido.');
        }

        // Aquí podríamos añadir un registro en una tabla general de "Eventos de Retiro" si fuera necesario,
        // pero por ahora, los movimientos individuales quedan registrados.

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Retiro registrado exitosamente.', movimientos: movimientosRegistrados });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error registrando retiro:', error);
        res.status(500).json({ error: error.message || 'Error interno al registrar el retiro.' });
    } finally {
        client.release();
    }
};

module.exports = {
    getDatosFiltrosRetiro,
    getMaterialesAsignados,
    getStockMaterial,
    registrarRetiro,
};