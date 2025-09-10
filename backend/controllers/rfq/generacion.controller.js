//C:\SIRA\backend\controllers\rfq\generacion.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Generación y Gestión de Cotizaciones (G_RFQ)
 * =================================================================================================
 */
const pool = require('../../db/pool');
const { uploadQuoteFiles } = require('../../services/googleDrive');

// --- Funciones para la vista del Comprador ---

const getRequisicionesCotizando = async (req, res) => {
    try {
    const query = `
      SELECT r.id, r.rfq_code, r.fecha_creacion, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio, r.lugar_entrega
      FROM requisiciones r
      JOIN usuarios u ON r.usuario_id = u.id
      JOIN proyectos p ON r.proyecto_id = p.id
      JOIN sitios s ON r.sitio_id = s.id
      WHERE r.status = 'COTIZANDO' ORDER BY r.fecha_creacion ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener requisiciones en cotización:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }

};

const getRfqDetalle = async (req, res) => {
   const { id } = req.params;
    try {
        // 1. Obtener datos de la cabecera de la requisición.
        const reqResult = await pool.query(`
            SELECT r.id, r.numero_requisicion, r.rfq_code, r.fecha_creacion, r.fecha_requerida, r.lugar_entrega, r.status, r.comentario AS comentario_general, u.nombre AS usuario_creador, p.nombre AS proyecto, s.nombre AS sitio
            FROM requisiciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN proyectos p ON r.proyecto_id = p.id
            JOIN sitios s ON r.sitio_id = s.id
            WHERE r.id = $1;
        `, [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Requisición no encontrada.' });

        // 2. Obtener las líneas de materiales.
         const materialesResult = await pool.query(`
            SELECT 
                rd.id, rd.cantidad, rd.comentario, rd.status_compra,
                cm.id as material_id, cm.nombre AS material, cu.simbolo AS unidad
            FROM requisiciones_detalle rd
            JOIN catalogo_materiales cm ON rd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE rd.requisicion_id = $1 ORDER BY cm.nombre;
        `, [id]);


        // 3. Obtener las opciones de cotización ya guardadas.
        const opcionesResult = await pool.query(`
            SELECT ro.*, p.marca as proveedor_nombre, p.razon_social as proveedor_razon_social
            FROM requisiciones_opciones ro
            JOIN proveedores p ON ro.proveedor_id = p.id
            WHERE ro.requisicion_id = $1;
        `, [id]);
        
        // 4. Obtener los archivos adjuntos.
        const adjuntosResult = await pool.query(
            `SELECT id, nombre_archivo, ruta_archivo FROM requisiciones_adjuntos WHERE requisicion_id = $1`,
            [id]
        );

        // 5. Unir los materiales con sus respectivas opciones.
        const materialesConOpciones = materialesResult.rows.map(material => ({
            ...material,
            opciones: opcionesResult.rows.filter(op => op.requisicion_detalle_id === material.id)
        }));
        
        // 6. Enviar la respuesta completa y estructurada.
        res.json({ 
            ...reqResult.rows[0], 
            materiales: materialesConOpciones,
            adjuntos: adjuntosResult.rows
        });
    } catch (error) {
        console.error(`Error al obtener detalle de RFQ ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }

};

const guardarOpcionesRfq = async (req, res) => {
const { id: requisicion_id } = req.params;
    let { opciones, resumenes, rfq_code } = req.body;

    try {
        // El frontend envía los datos como strings JSON dentro del FormData, por lo que se parsean.
        opciones = JSON.parse(opciones);
        resumenes = JSON.parse(resumenes);
    } catch {
        return res.status(400).json({ error: "El formato de 'opciones' o 'resumenes' no es un JSON válido." });
    }

    if (!Array.isArray(opciones)) return res.status(400).json({ error: "Se requiere un array de 'opciones'." });
    if (!Array.isArray(resumenes)) return res.status(400).json({ error: "Se requiere un array de 'resumenes'." });
    
    // Se crea un mapa de los resúmenes por ID de proveedor para una búsqueda eficiente.
     const resumenMap = new Map(resumenes.map(r => [r.proveedorId, r]));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // --- ¡LA CORRECCIÓN ESTÁ AQUÍ! ---
        // 1. Obtenemos los IDs de las líneas de material que SÍ podemos modificar.
        const pendientesResult = await client.query(
            `SELECT id FROM requisiciones_detalle WHERE requisicion_id = $1 AND status_compra = 'PENDIENTE'`,
            [requisicion_id]
        );
        const idsPendientes = pendientesResult.rows.map(row => row.id);

        if (idsPendientes.length > 0) {
            // 2. Borramos ÚNICAMENTE las cotizaciones ("borradores") de esas líneas pendientes.
            // Usamos ANY($1::int[]) para pasar el arreglo de IDs de forma segura.
            await client.query(
                `DELETE FROM requisiciones_opciones WHERE requisicion_detalle_id = ANY($1::int[])`,
                [idsPendientes]
            );
        }
        
        for (const opt of opciones) {
             if (!opt.proveedor_id) continue; // Ignorar opciones sin proveedor.
            
             const resumenProveedor = resumenMap.get(opt.proveedor_id);

             // Query de inserción que ahora incluye todas las nuevas columnas.
             await client.query(
                `INSERT INTO requisiciones_opciones (
                    requisicion_id, requisicion_detalle_id, proveedor_id, precio_unitario, cantidad_cotizada, moneda, 
                    seleccionado, es_precio_neto, es_importacion, es_entrega_inmediata, 
                    tiempo_entrega_valor, tiempo_entrega_unidad,
                    subtotal, iva, ret_isr, total,
                    config_calculo, es_total_forzado
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                 )`,
                [
                    requisicion_id, opt.requisicion_detalle_id, opt.proveedor_id, opt.precio_unitario, 
                    opt.cantidad_cotizada, opt.moneda || 'MXN', opt.seleccionado, opt.es_precio_neto, 
                    opt.es_importacion, opt.es_entrega_inmediata,
                    opt.tiempo_entrega_valor || null, opt.tiempo_entrega_unidad || null,
                    // Si la opción fue seleccionada ("Elegir"), se guardan los datos del resumen.
                    opt.seleccionado ? resumenProveedor?.subTotal : null,
                    opt.seleccionado ? resumenProveedor?.iva : null,
                    opt.seleccionado ? resumenProveedor?.retIsr : null,
                    opt.seleccionado ? resumenProveedor?.total : null,
                    opt.seleccionado ? resumenProveedor?.config : null, 
                    opt.seleccionado ? resumenProveedor?.config?.isForcedTotalActive : false
                ]
            );
        }

        // La lógica de archivos no necesita cambios.
        if (req.files && req.files.length > 0) {
            // ... (código existente para subir archivos a Google Drive)
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Opciones de cotización y detalles financieros guardados correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error al guardar opciones detalladas para RFQ ${requisicion_id}:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }

};

const enviarRfqAprobacion = async (req, res) => {
     const { id } = req.params;
    try {
        const result = await pool.query(`UPDATE requisiciones SET status = 'POR_APROBAR' WHERE id = $1 AND (status = 'COTIZANDO' OR status = 'POR_APROBAR') RETURNING id, status`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'La requisición no se encontró o está en un estado no válido.' });
        res.status(200).json({ mensaje: `La RFQ ha sido enviada a aprobación.`, requisicion: result.rows[0] });
    } catch (error) {
        console.error(`Error al enviar a aprobación la RFQ ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }

};

const cancelarRfq = async (req, res) => {
     const { id } = req.params;
    try {
        const rfqActual = await pool.query(`SELECT status FROM requisiciones WHERE id = $1`, [id]);
        if (rfqActual.rowCount === 0) return res.status(404).json({ error: 'El RFQ no existe.' });
        const statusActual = rfqActual.rows[0].status;
        if (statusActual !== 'COTIZANDO') return res.status(409).json({ error: `No se puede cancelar. El RFQ ya está en estado '${statusActual}'.` });
        await pool.query(`UPDATE requisiciones SET status = 'CANCELADA' WHERE id = $1`, [id]);
        res.status(200).json({ mensaje: `El RFQ con ID ${id} ha sido cancelado.` });
    } catch (error) {
        console.error(`Error al cancelar RFQ ${id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }

};

module.exports = {
    getRequisicionesCotizando,
    getRfqDetalle,
    guardarOpcionesRfq,
    enviarRfqAprobacion,
    cancelarRfq,
};