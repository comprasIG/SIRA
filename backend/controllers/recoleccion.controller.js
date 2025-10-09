// backend/controllers/recoleccion.controller.js
const pool = require('../db/pool');
const { uploadMulterFileToOcFolder } = require('../services/googleDrive');
const { sendWhatsAppMessage } = require('../services/whatsappService');

const getOcsAprobadas = async (req, res) => {
  // Esta es la línea clave de la corrección
  const { departamentoId, sitioId, proyectoId, proveedorId, search } = req.query;

  let query = `
    SELECT
      oc.id, oc.numero_oc, oc.total, oc.fecha_creacion, oc.status,
      p.razon_social AS proveedor_razon_social,
      p.marca AS proveedor_marca,
      pr.nombre AS proyecto_nombre,
      s.nombre AS sitio_nombre,
      d.nombre AS departamento_nombre,
      r.departamento_id,
      oc.sitio_id,
      oc.proyecto_id,
      oc.proveedor_id
    FROM ordenes_compra oc
    JOIN proveedores p ON oc.proveedor_id = p.id
    JOIN proyectos pr ON oc.proyecto_id = pr.id
    JOIN sitios s ON oc.sitio_id = s.id
    JOIN requisiciones r ON oc.rfq_id = r.id
    JOIN departamentos d ON r.departamento_id = d.id
    WHERE oc.status = 'APROBADA'
  `;

  const params = [];
  let paramIndex = 1;

  if (departamentoId) {
    query += ` AND r.departamento_id = $${paramIndex++}`;
    params.push(departamentoId);
  }
  if (sitioId) {
    query += ` AND oc.sitio_id = $${paramIndex++}`;
    params.push(sitioId);
  }
  if (proyectoId) {
    query += ` AND oc.proyecto_id = $${paramIndex++}`;
    params.push(proyectoId);
  }
  if (proveedorId) {
    query += ` AND oc.proveedor_id = $${paramIndex++}`;
    params.push(proveedorId);
  }
  if (search) {
    query += ` AND (oc.numero_oc ILIKE $${paramIndex} OR p.marca ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
  }

  query += ' ORDER BY oc.fecha_creacion DESC';

  try {
    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener OCs aprobadas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const procesarOcParaRecoleccion = async (req, res) => {
    const { id: ordenCompraId } = req.params;
    const { id: usuarioId } = req.usuarioSira;
    const {
        metodoRecoleccionId,
        paqueteriaId,
        numeroGuia,
        comentarioRecoleccion,
        paqueteriaPago,
        notificarRecoleccion,
        notificarProveedor,
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ocQuery = await client.query(`SELECT * FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [ordenCompraId]);
        if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });

        const oc = ocQuery.rows[0];
        if (oc.status !== 'APROBADA') {
            return res.status(409).json({ error: `La OC está en estado '${oc.status}' y no puede ser procesada.` });
        }

        const archivosSubidos = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const fileName = `EVIDENCIA_${oc.numero_oc}_${Date.now()}_${file.originalname}`;
                const driveFile = await uploadMulterFileToOcFolder(file, oc.numero_oc, fileName);

                const insertRes = await client.query(
                    `INSERT INTO archivos_recoleccion_oc (orden_compra_id, archivo_link, tipo) VALUES ($1, $2, $3) RETURNING *`,
                    [ordenCompraId, driveFile.webViewLink, 'EVIDENCIA_EMBARQUE']
                );
                archivosSubidos.push(insertRes.rows[0]);
            }
        }

        const finalPaqueteriaId = paqueteriaId ? parseInt(paqueteriaId, 10) : null;
        const finalNumeroGuia = numeroGuia || null;
        
        const updateResult = await client.query(
            `UPDATE ordenes_compra
             SET
               status = 'EN_PROCESO',
               metodo_recoleccion_id = $2,
               paqueteria_id = $3,
               numero_guia = $4,
               comentario_recoleccion = $5,
               paqueteria_pago = $6,
               actualizado_en = now()
             WHERE id = $1
             RETURNING id, status`,
            [ordenCompraId, metodoRecoleccionId, finalPaqueteriaId, finalNumeroGuia, comentarioRecoleccion, paqueteriaPago]
        );

        if (notificarRecoleccion === 'true') {
            await sendWhatsAppMessage('RECOLECCIONES_GROUP', `Nueva OC para recolección: ${oc.numero_oc}`);
        }
        if (notificarProveedor === 'true') {
            await sendWhatsAppMessage('PROVEEDOR_CONTACT', `Su OC ${oc.numero_oc} está en proceso de recolección.`);
        }

        const detallesHistorial = {
            accion: 'Paso a Recolección',
            nuevo_estado: 'EN_PROCESO',
            metodoRecoleccionId, paqueteriaId: finalPaqueteriaId, numeroGuia: finalNumeroGuia,
            paqueteriaPago, comentarioRecoleccion,
            notificaciones: { recoleccion: notificarRecoleccion, proveedor: notificarProveedor },
            archivos: archivosSubidos.map(a => a.archivo_link),
        };

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
             VALUES ($1, $2, 'PROCESO_RECOLECCION', $3)`,
            [ordenCompraId, usuarioId, JSON.stringify(detallesHistorial)]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'OC actualizada a EN_PROCESO.', ordenCompra: updateResult.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al procesar OC para recolección:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

const cancelarOcAprobada = async (req, res) => {
    const { id, motivo } = req.body;
    const { id: usuarioId } = req.usuarioSira;

    if (!id || !motivo || motivo.trim() === '') {
        return res.status(400).json({ error: 'La OC y el motivo son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const ocQuery = await client.query(`SELECT status FROM ordenes_compra WHERE id = $1 FOR UPDATE`, [id]);
        if (ocQuery.rowCount === 0) return res.status(404).json({ error: 'OC no encontrada.' });
        if (ocQuery.rows[0].status !== 'APROBADA') {
            return res.status(409).json({ error: 'Solo se pueden cancelar OCs en estado APROBADA.' });
        }

        await client.query(
            `UPDATE ordenes_compra SET status = 'CANCELADA' WHERE id = $1`,
            [id]
        );

        await client.query(
            `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
            VALUES ($1, $2, 'CANCELACION_POST_APROBACION', $3)`,
            [id, usuarioId, JSON.stringify({ motivo })]
        );

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'OC cancelada exitosamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al cancelar OC aprobada:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

const getRecoleccionKpis = async (_req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE status = 'APROBADA') AS pendientes,
                COUNT(*) FILTER (WHERE status = 'EN_PROCESO') AS en_recoleccion
            FROM ordenes_compra;
        `;
        const { rows } = await pool.query(query);
        res.json({
            pendientes: parseInt(rows[0].pendientes, 10) || 0,
            enRecoleccion: parseInt(rows[0].en_recoleccion, 10) || 0,
        });
    } catch (error) {
        console.error('Error al obtener KPIs de recolección:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const getOcsEnProceso = async (_req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT oc.id, oc.numero_oc, p.marca AS proveedor_marca
            FROM ordenes_compra oc
            JOIN proveedores p ON oc.proveedor_id = p.id
            WHERE oc.status = 'EN_PROCESO'
            ORDER BY oc.actualizado_en DESC;
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener OCs En Proceso:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const getDatosParaFiltros = async (_req, res) => {
    try {
        // --- CONSULTAS MODIFICADAS ---
        // Ahora solo traen opciones que tienen al menos una OC en estado APROBADA.
        const proveedoresQuery = `
            SELECT DISTINCT p.id, p.marca FROM proveedores p
            JOIN ordenes_compra oc ON p.id = oc.proveedor_id
            WHERE oc.status = 'APROBADA' ORDER BY p.marca ASC
        `;
        const sitiosQuery = `
            SELECT DISTINCT s.id, s.nombre FROM sitios s
            JOIN ordenes_compra oc ON s.id = oc.sitio_id
            WHERE oc.status = 'APROBADA' ORDER BY s.nombre ASC
        `;
        const proyectosQuery = `
            SELECT DISTINCT pr.id, pr.nombre, pr.sitio_id FROM proyectos pr
            JOIN ordenes_compra oc ON pr.id = oc.proyecto_id
            WHERE oc.status = 'APROBADA' ORDER BY pr.nombre ASC
        `;
        const departamentosQuery = `
            SELECT DISTINCT d.id, d.nombre FROM departamentos d
            JOIN requisiciones r ON d.id = r.departamento_id
            JOIN ordenes_compra oc ON r.id = oc.rfq_id
            WHERE oc.status = 'APROBADA' ORDER BY d.nombre ASC
        `;

        const [proveedoresRes, sitiosRes, proyectosRes, departamentosRes] = await Promise.all([
            pool.query(proveedoresQuery),
            pool.query(sitiosQuery),
            pool.query(proyectosQuery),
            pool.query(departamentosQuery),
        ]);

        res.json({
            proveedores: proveedoresRes.rows,
            sitios: sitiosRes.rows,
            proyectos: proyectosRes.rows,
            departamentos: departamentosRes.rows
        });
    } catch (error) {
        console.error('Error al obtener datos para filtros:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

module.exports = {
  getOcsAprobadas,
  procesarOcParaRecoleccion,
  cancelarOcAprobada,
  getRecoleccionKpis,
  getOcsEnProceso,
  getDatosParaFiltros,
};