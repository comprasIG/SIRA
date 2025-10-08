// backend/controllers/rec_oc.controller.js
const pool = require('../db/pool');

// --- 1. Listar OCs pendientes ---
exports.listarPendientes = async (req, res) => {
  const { proveedor_id, sitio_id, proyecto_id, numero_oc } = req.query;
  const filtros = [];
  const valores = [];

  filtros.push("oc.status = 'APROBADA'");
  filtros.push("oc.impo = false");

  if (proveedor_id) { valores.push(proveedor_id); filtros.push(`oc.proveedor_id = $${valores.length}`); }
  if (sitio_id) { valores.push(sitio_id); filtros.push(`oc.sitio_id = $${valores.length}`); }
  if (proyecto_id) { valores.push(proyecto_id); filtros.push(`oc.proyecto_id = $${valores.length}`); }
  if (numero_oc) { valores.push(`%${numero_oc}%`); filtros.push(`oc.numero_oc ILIKE $${valores.length}`); }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const sql = `
    SELECT 
      oc.id, oc.numero_oc, oc.total,
      p.marca AS proveedor_nombre,
      proy.nombre AS proyecto_nombre,
      s.nombre AS sitio_nombre
    FROM ordenes_compra oc
    LEFT JOIN proveedores p ON oc.proveedor_id = p.id
    LEFT JOIN proyectos proy ON oc.proyecto_id = proy.id
    LEFT JOIN sitios s ON oc.sitio_id = s.id
    ${where}
    ORDER BY p.marca, oc.numero_oc
  `;

  try {
    const result = await pool.query(sql, valores);
    res.json(result.rows || []);
  } catch (err) {
    console.error('[listarPendientes] Error:', err);
    res.status(500).json({ error: 'Error obteniendo OCs pendientes.' });
  }
};

// --- 2. Listar OCs en proceso de recolección ---
exports.listarEnProceso = async (req, res) => {
  const filtros = ["oc.status = 'EN_PROCESO'", "oc.impo = false"];
  const where = `WHERE ${filtros.join(' AND ')}`;
  const sql = `
    SELECT 
      oc.id, oc.numero_oc, oc.total,
      p.marca AS proveedor_nombre,
      proy.nombre AS proyecto_nombre,
      s.nombre AS sitio_nombre
    FROM ordenes_compra oc
    LEFT JOIN proveedores p ON oc.proveedor_id = p.id
    LEFT JOIN proyectos proy ON oc.proyecto_id = proy.id
    LEFT JOIN sitios s ON oc.sitio_id = s.id
    ${where}
    ORDER BY p.marca, oc.numero_oc
  `;
  try {
    const result = await pool.query(sql);
    res.json(result.rows || []);
  } catch (err) {
    console.error('[listarEnProceso] Error:', err);
    res.status(500).json({ error: 'Error obteniendo OCs en recolección.' });
  }
};

// --- 3. Catálogos activos ---
exports.getCatalogos = async (req, res) => {
  try {
    const [proveedores, sitios, proyectos, metodosRecoleccion, paqueterias, metodosNotificacion] = await Promise.all([
      pool.query("SELECT id, marca AS nombre FROM proveedores ORDER BY marca"),
      pool.query("SELECT id, nombre FROM sitios ORDER BY nombre"),
      pool.query("SELECT id, nombre FROM proyectos ORDER BY nombre"),
      pool.query("SELECT id, codigo, nombre FROM catalogo_metodos_recoleccion WHERE activo = true ORDER BY nombre"),
      pool.query("SELECT id, nombre FROM catalogo_paqueterias WHERE activo = true ORDER BY nombre"),
      pool.query("SELECT id, codigo, nombre FROM catalogo_metodos_notificacion WHERE activo = true ORDER BY nombre"),
    ]);
    res.json({
      proveedores: proveedores.rows,
      sitios: sitios.rows,
      proyectos: proyectos.rows,
      metodosRecoleccion: metodosRecoleccion.rows,
      paqueterias: paqueterias.rows,
      metodosNotificacion: metodosNotificacion.rows,
    });
  } catch (err) {
    console.error('[getCatalogos] Error:', err);
    res.status(500).json({ error: 'Error obteniendo catálogos.' });
  }
};

// --- 4. Definir método de recolección ---
exports.definirMetodo = async (req, res) => {
  const { ocId } = req.params;
  const {
    metodo_recoleccion_id,
    paqueteria_id,
    paqueteria_pago,
    recoleccion_parcial,
    comentario_recoleccion
  } = req.body;

  try {
    await pool.query(`
      UPDATE ordenes_compra SET
        metodo_recoleccion_id = $1,
        paqueteria_id = $2,
        paqueteria_pago = $3,
        recoleccion_parcial = $4,
        comentario_recoleccion = $5
      WHERE id = $6
    `, [
      metodo_recoleccion_id || null,
      paqueteria_id || null,
      paqueteria_pago || null,
      recoleccion_parcial || false,
      comentario_recoleccion || null,
      ocId
    ]);
    // (opcional) Cambia status a EN_PROCESO:
    // await pool.query("UPDATE ordenes_compra SET status = 'EN_PROCESO' WHERE id = $1", [ocId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[definirMetodo] Error:', err);
    res.status(500).json({ error: 'Error al definir método de recolección.' });
  }
};

// --- 5. Subir archivo de recolección ---
exports.subirArchivo = async (req, res) => {
  // Aquí deberías recibir req.file (si usas multer) o req.body.link si usas Drive.
  // Simulación:
  const { ocId } = req.params;
  const { archivo_link, tipo } = req.body; // tipo = 'GUIA'/'EVIDENCIA'
  try {
    await pool.query(
      `INSERT INTO archivos_recoleccion_oc (orden_compra_id, archivo_link, tipo, creado_en)
       VALUES ($1, $2, $3, NOW())`,
      [ocId, archivo_link, tipo]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[subirArchivo] Error:', err);
    res.status(500).json({ error: 'Error al subir archivo.' });
  }
};

// --- 6. Notificar proveedor/recolección y cambiar a EN_PROCESO ---
exports.enviarNotificacion = async (req, res) => {
  const { ocId } = req.params;
  const { via = 'WHATSAPP', mensaje = '' } = req.body; // simulado

  try {
    // (Simulado) aquí iría tu integración real de WhatsApp/Email
    // Registrar historial opcional:
    await pool.query(`
      INSERT INTO ordenes_compra_historial (orden_compra_id, accion_realizada, detalles, usuario_id, creado_en)
      VALUES ($1, 'NOTIFICACION_ENVIADA', $2, $3, NOW())
    `, [ocId, `Vía: ${via}. ${mensaje}`, req.usuario?.id || null]);

    // Regla de negocio: al notificar, la OC pasa a EN_PROCESO
    await pool.query(`UPDATE ordenes_compra SET status = 'EN_PROCESO' WHERE id = $1`, [ocId]);

    res.json({ ok: true, message: 'Notificación enviada (simulado). Status => EN_PROCESO' });
  } catch (err) {
    console.error('[enviarNotificacion] Error:', err);
    res.status(500).json({ error: 'Error al enviar notificación.' });
  }
};

// --- 7. Consultar historial de la OC ---
exports.historialOc = async (req, res) => {
  const { ocId } = req.params;
  try {
    const sql = `
      SELECT id, accion_realizada, detalles, usuario_id, creado_en
      FROM ordenes_compra_historial
      WHERE orden_compra_id = $1
      ORDER BY creado_en DESC
    `;
    const result = await pool.query(sql, [ocId]);
    res.json(result.rows || []);
  } catch (err) {
    console.error('[historialOc] Error:', err);
    res.status(500).json({ error: 'Error obteniendo historial.' });
  }
};

// --- 8. Cancelar OC desde acción global ---
exports.cancelarOc = async (req, res) => {
  const { orden_compra_id, motivo } = req.body;
  try {
    await pool.query(`
      UPDATE ordenes_compra SET status = 'CANCELADA' WHERE id = $1
    `, [orden_compra_id]);

    await pool.query(`
      INSERT INTO ordenes_compra_historial (orden_compra_id, accion_realizada, detalles, usuario_id, creado_en)
      VALUES ($1, 'CANCELADA', $2, $3, NOW())
    `, [orden_compra_id, motivo || '', req.usuario?.id || null]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[cancelarOc] Error:', err);
    res.status(500).json({ error: 'Error al cancelar OC.' });
  }
};
