// backend/controllers/ingreso.controller.js
const pool = require('../db/pool');

/**
 * Helper: Gets essential OC info, including project details.
 */
const getOcInfoForIngreso = async (client, ocId) => {
    const query = `
        SELECT
            oc.id, oc.numero_oc, oc.proyecto_id, oc.sitio_id,
            pr.nombre AS proyecto_nombre
        FROM ordenes_compra oc
        JOIN proyectos pr ON oc.proyecto_id = pr.id
        WHERE oc.id = $1
    `;
    const res = await client.query(query, [ocId]);
    if (res.rowCount === 0) {
        throw new Error(`OC con ID ${ocId} no encontrada.`);
    }
    const isStockProject = res.rows[0].proyecto_nombre === 'STOCK ALMACEN';
    return { ...res.rows[0], isStockProject };
};

/**
 * GET /api/ingreso/ocs-en-proceso
 * Fetches OCs with status 'EN_PROCESO' and related info for display.
 */
const getOcsEnProceso = async (req, res) => {
    // ... (Esta función se mantiene sin cambios)
    const { departamentoId, sitioId, proyectoId, proveedorId, search } = req.query;
    let query = `
        SELECT
            oc.id, oc.numero_oc, oc.total, oc.actualizado_en AS fecha_ultimo_movimiento,
            oc.status, oc.entrega_parcial, oc.con_incidencia,
            p.marca AS proveedor_marca, p.razon_social AS proveedor_razon_social,
            pr.nombre AS proyecto_nombre, s.nombre AS sitio_nombre, d.nombre AS departamento_nombre,
            oc.metodo_recoleccion_id, cmr.nombre AS metodo_recoleccion_nombre, oc.entrega_responsable,
            r.departamento_id, oc.sitio_id, oc.proyecto_id, oc.proveedor_id
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        JOIN proyectos pr ON oc.proyecto_id = pr.id
        JOIN sitios s ON oc.sitio_id = s.id
        JOIN requisiciones r ON oc.rfq_id = r.id
        JOIN departamentos d ON r.departamento_id = d.id
        LEFT JOIN catalogo_metodos_recoleccion cmr ON oc.metodo_recoleccion_id = cmr.id
        WHERE oc.status = 'EN_PROCESO'
    `;
    const params = [];
    let paramIndex = 1;
    if (departamentoId) { query += ` AND r.departamento_id = $${paramIndex++}`; params.push(departamentoId); }
    if (sitioId) { query += ` AND oc.sitio_id = $${paramIndex++}`; params.push(sitioId); }
    if (proyectoId) { query += ` AND oc.proyecto_id = $${paramIndex++}`; params.push(proyectoId); }
    if (proveedorId) { query += ` AND oc.proveedor_id = $${paramIndex++}`; params.push(proveedorId); }
    if (search) { query += ` AND (oc.numero_oc ILIKE $${paramIndex} OR p.marca ILIKE $${paramIndex})`; params.push(`%${search}%`); }
    query += ' ORDER BY oc.actualizado_en DESC';
    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching OCs EN_PROCESO:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};

/**
 * GET /api/ingreso/datos-iniciales
 * Fetches data for KPIs and Filter options relevant to OCs 'EN_PROCESO'.
 */
const getDatosIniciales = async (req, res) => {
    // ... (Esta función se mantiene sin cambios, ya la corregimos en la respuesta anterior)
    try {
        const kpiQuery = `
            SELECT
                COUNT(*) AS total_en_proceso,
                COUNT(*) FILTER (WHERE metodo_recoleccion_id = (SELECT id FROM catalogo_metodos_recoleccion WHERE codigo = 'LOCAL') AND entrega_responsable = 'PROVEEDOR') AS kpi_proveedor_entrega,
                COUNT(*) FILTER (WHERE metodo_recoleccion_id = (SELECT id FROM catalogo_metodos_recoleccion WHERE codigo = 'PAQUETERIA')) AS kpi_paqueteria,
                COUNT(*) FILTER (WHERE metodo_recoleccion_id = (SELECT id FROM catalogo_metodos_recoleccion WHERE codigo = 'LOCAL') AND entrega_responsable = 'EQUIPO_RECOLECCION') AS kpi_equipo_recoleccion,
                COUNT(*) FILTER (WHERE entrega_parcial = true) AS kpi_parciales,
                COUNT(*) FILTER (WHERE con_incidencia = true) AS kpi_con_incidencia
            FROM ordenes_compra WHERE status = 'EN_PROCESO';
        `;
        const proveedoresQuery = `SELECT DISTINCT p.id, p.marca FROM proveedores p JOIN ordenes_compra oc ON p.id = oc.proveedor_id WHERE oc.status = 'EN_PROCESO' ORDER BY p.marca ASC`;
        const sitiosQuery = `SELECT DISTINCT s.id, s.nombre FROM sitios s JOIN ordenes_compra oc ON s.id = oc.sitio_id WHERE oc.status = 'EN_PROCESO' ORDER BY s.nombre ASC`;
        const proyectosQuery = `SELECT DISTINCT pr.id, pr.nombre, pr.sitio_id FROM proyectos pr JOIN ordenes_compra oc ON pr.id = oc.proyecto_id WHERE oc.status = 'EN_PROCESO' ORDER BY pr.nombre ASC`;
        const departamentosQuery = `SELECT DISTINCT d.id, d.nombre FROM departamentos d JOIN requisiciones r ON d.id = r.departamento_id JOIN ordenes_compra oc ON r.id = oc.rfq_id WHERE oc.status = 'EN_PROCESO' ORDER BY d.nombre ASC`;
        const ubicacionesQuery = `SELECT id, codigo, nombre FROM ubicaciones_almacen ORDER BY nombre ASC`;
        const incidenciasQuery = `SELECT id, codigo, descripcion, activo FROM catalogo_incidencias_recepcion ORDER BY descripcion ASC`;
        
        const [kpiRes, proveedoresRes, sitiosRes, proyectosRes, departamentosRes, ubicacionesRes, incidenciasRes] = await Promise.all([
            pool.query(kpiQuery), pool.query(proveedoresQuery), pool.query(sitiosQuery),
            pool.query(proyectosQuery), pool.query(departamentosQuery), pool.query(ubicacionesQuery),
            pool.query(incidenciasQuery),
        ]);
        
        res.json({
            kpis: kpiRes.rows[0] || {},
            filterOptions: {
                proveedores: proveedoresRes.rows, sitios: sitiosRes.rows, proyectos: proyectosRes.rows,
                departamentos: departamentosRes.rows, ubicacionesAlmacen: ubicacionesRes.rows,
                tiposIncidencia: incidenciasRes.rows,
            }
        });
    } catch (error) {
        console.error('Error fetching initial data for ING_OC:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};

/**
 * GET /api/ingreso/oc/:id/detalles
 * Fetches the line items for a specific OC for the income modal.
 */
const getOcDetalleParaIngreso = async (req, res) => {
    // ... (Esta función se mantiene sin cambios)
    const { id: ordenCompraId } = req.params;
    try {
        const query = `
            SELECT 
                ocd.id AS detalle_id, ocd.material_id, cm.nombre AS material_nombre,
                cu.simbolo AS unidad_simbolo, ocd.cantidad AS cantidad_pedida, 
                ocd.cantidad_recibida,
                ocd.precio_unitario, ocd.moneda -- <<< AÑADIDO: Pasar precio y moneda al modal
            FROM ordenes_compra_detalle ocd
            JOIN catalogo_materiales cm ON ocd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE ocd.orden_compra_id = $1 ORDER BY ocd.id ASC;
        `;
        const { rows } = await pool.query(query, [ordenCompraId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Detalles no encontrados para esta OC.' });
        }
        res.json(rows);
    } catch (error) {
        console.error(`Error fetching details for OC ${ordenCompraId}:`, error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
};

/**
 * POST /api/ingreso/registrar
 * Registers the income of items (full or partial), handles incidents, and updates inventory.
 */
const registrarIngreso = async (req, res) => {
    // --- SECCIÓN MODIFICADA ---
    // Añadimos 'moneda' al payload que esperamos del item
    const { orden_compra_id, items, ubicacion_id } = req.body; // items = [{ detalle_id, material_id, cantidad_ingresada_ahora, precio_unitario, moneda, incidencia: { ... } }]
    const { id: usuarioId } = req.usuarioSira;
    // --- FIN SECCIÓN MODIFICADA ---

    if (!orden_compra_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Datos de ingreso inválidos.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const ocInfo = await getOcInfoForIngreso(client, orden_compra_id);
        const { isStockProject, sitio_id: ocSitioId } = ocInfo;

        if (isStockProject && !ubicacion_id) {
            throw new Error('Se requiere una ubicación de almacén para ingresos a STOCK.');
        }

        let hasAnyIncident = false;
        let hasAnyPartial = false;
        const ingresoDetalles = [];

        for (const item of items) {
            // --- SECCIÓN MODIFICADA ---
            // Obtenemos precio_unitario y moneda del item
            const { detalle_id, material_id, cantidad_ingresada_ahora, precio_unitario, moneda, incidencia } = item;
            const cantidadNum = parseFloat(cantidad_ingresada_ahora) || 0;
            const precioUnitarioNum = parseFloat(precio_unitario) || 0; // Costo de este ingreso
            // --- FIN SECCIÓN MODIFICADA ---

            if (cantidadNum < 0) continue;

            let updatedDetail;
            if (cantidadNum > 0 || (incidencia && incidencia.tipo_id)) {
                 const updateDetailQuery = `
                    UPDATE ordenes_compra_detalle SET cantidad_recibida = cantidad_recibida + $1
                    WHERE id = $2 AND orden_compra_id = $3
                    RETURNING id, cantidad, cantidad_recibida, requisicion_detalle_id, precio_unitario, moneda; -- <<< AÑADIDO: Devolver moneda
                 `;
                 const detailRes = await client.query(updateDetailQuery, [cantidadNum, detalle_id, orden_compra_id]);
                 if(detailRes.rowCount === 0) throw new Error(`Detalle ID ${detalle_id} no encontrado o no pertenece a OC ${orden_compra_id}.`);
                 updatedDetail = detailRes.rows[0];

                 if(updatedDetail.cantidad_recibida < updatedDetail.cantidad) {
                    hasAnyPartial = true;
                 }
            }

            if (incidencia && incidencia.tipo_id && incidencia.descripcion) {
                // ... (Esta sección se mantiene sin cambios) ...
                hasAnyIncident = true;
                const incidentQuery = `
                    INSERT INTO incidencias_recepcion_oc (orden_compra_id, incidencia_id, cantidad_afectada, descripcion_problema, usuario_id, material_id)
                    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
                `;
                await client.query(incidentQuery, [
                    orden_compra_id, incidencia.tipo_id, incidencia.cantidad_afectada || null,
                    incidencia.descripcion, usuarioId, material_id
                ]);
                ingresoDetalles.push({ detalle_id, material_id, incidencia: true, ...incidencia });
            }

            if (cantidadNum > 0 && !(incidencia && incidencia.tipo_id)) {
                let targetUbicacionId;
                if (isStockProject) {
                    // --- SECCIÓN MODIFICADA (STOCK) ---
                    targetUbicacionId = ubicacion_id;
                    const stockUpdateQuery = `
                        INSERT INTO inventario_actual (material_id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (material_id, ubicacion_id) DO UPDATE
                        SET stock_actual = inventario_actual.stock_actual + $3,
                            ultimo_precio_entrada = $4, -- Actualizar último precio
                            moneda = $5,                -- Actualizar moneda
                            actualizado_en = NOW();
                    `;
                    // Usamos los valores del item (que vienen del detalle de la OC)
                    await client.query(stockUpdateQuery, [material_id, targetUbicacionId, cantidadNum, precioUnitarioNum, moneda]);
                    // --- FIN SECCIÓN MODIFICADA (STOCK) ---

                } else {
                    // --- SECCIÓN MODIFICADA (ASIGNADO) ---
                    targetUbicacionId = ocSitioId;
                    const assignedUpdateQuery = `
                        INSERT INTO inventario_actual (material_id, ubicacion_id, asignado) VALUES ($1, $2, $3)
                        ON CONFLICT (material_id, ubicacion_id) DO UPDATE SET asignado = inventario_actual.asignado + $3, actualizado_en = NOW()
                        RETURNING id;
                    `;
                    const invActualRes = await client.query(assignedUpdateQuery, [material_id, targetUbicacionId, cantidadNum]);
                    const inventarioId = invActualRes.rows[0].id;

                    const requisicionPrincipalQuery = `
                        SELECT r.id AS requisicion_principal_id
                        FROM requisiciones_detalle rd
                        JOIN requisiciones r ON rd.requisicion_id = r.id
                        WHERE rd.id = $1;
                    `;
                    const reqPrincipalRes = await client.query(requisicionPrincipalQuery, [updatedDetail.requisicion_detalle_id]);
                    if (reqPrincipalRes.rowCount === 0) {
                        throw new Error(`No se pudo encontrar la requisición principal para el detalle de OC ID ${detalle_id} (ReqDetID: ${updatedDetail.requisicion_detalle_id})`);
                    }
                    const { requisicion_principal_id } = reqPrincipalRes.rows[0];
                    // Usamos los valores del updatedDetail (que vienen del detalle de la OC)
                    const { precio_unitario, moneda: monedaDetalle } = updatedDetail;

                    const assignedInsertQuery = `
                        INSERT INTO inventario_asignado
                            (inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario, moneda, asignado_en)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()); -- <<< AÑADIDO: moneda
                    `;
                    await client.query(assignedInsertQuery, [inventarioId, requisicion_principal_id, ocInfo.proyecto_id, ocSitioId, cantidadNum, precio_unitario, monedaDetalle]);
                    // --- FIN SECCIÓN MODIFICADA (ASIGNADO) ---
                }
                 ingresoDetalles.push({ detalle_id, material_id, cantidad: cantidadNum, isStock: isStockProject, ubicacion: targetUbicacionId });
            }
        } // End item loop

        // ... (El resto de la función: Update OC Flags, Add History Log, COMMIT, etc. se mantiene igual) ...
        const checkIncidentQuery = `SELECT EXISTS (SELECT 1 FROM incidencias_recepcion_oc WHERE orden_compra_id = $1) AS has_incident`;
        const incidentCheckRes = await client.query(checkIncidentQuery, [orden_compra_id]);
        const finalIncidentFlag = incidentCheckRes.rows[0].has_incident;

        const finalPartialFlag = hasAnyPartial;

        const updateFlagsQuery = `
            UPDATE ordenes_compra
            SET con_incidencia = $1,
                entrega_parcial = $2,
                actualizado_en = NOW()
            WHERE id = $3;
         `;
        await client.query(updateFlagsQuery, [finalIncidentFlag, finalPartialFlag, orden_compra_id]);

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
             VALUES ($1, $2, 'REGISTRO_INGRESO', $3)`,
            [orden_compra_id, usuarioId, JSON.stringify({ itemsProcesados: ingresoDetalles, ubicacionStock: isStockProject ? ubicacion_id : null})]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Ingreso registrado exitosamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error registrando ingreso OC:', error);
        res.status(500).json({ error: error.message || 'Error interno al registrar el ingreso.' });
    } finally {
        client.release();
    }
};

module.exports = {
    getOcsEnProceso,
    getDatosIniciales,
    getOcDetalleParaIngreso,
    registrarIngreso,
};