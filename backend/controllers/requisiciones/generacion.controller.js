// C:\SIRA\backend\controllers\requisiciones\generacion.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Generación de Requisiciones (Versión 5 - Fina)
 * =================================================================================================
 * --- HISTORIAL DE CAMBIOS ---
 * v5: Solución profesional (sin parches).
 * - Se importa 'uploadQuoteFile' de googleDrive (el nombre correcto).
 * - Se modifica la lógica de 'crearRequisicion' y 'actualizarRequisicion'
 * para iterar y subir archivos uno por uno, que es como 'uploadQuoteFile' funciona.
 * - Se asegura que 'module.exports' esté completo (corrige el crash de inicio).
 */
const pool = require('../../db/pool');
// --- CORRECCIÓN ---
// Importar el nombre de la función que SÍ existe en googleDrive.js
const { uploadQuoteFile } = require('../../services/googleDrive');
const { _getRequisicionCompleta } = require('./helper');

const crearRequisicion = async (req, res) => {
  const archivos = req.files;
  let {
    usuario_id, proyecto_id, sitio_id,
    fecha_requerida, lugar_entrega, comentario,
    materiales
  } = req.body;

  // Normalizaciones
  usuario_id    = Number(usuario_id);
  proyecto_id   = Number(proyecto_id);
  sitio_id      = Number(sitio_id);
  if (typeof materiales === "string") { try { materiales = JSON.parse(materiales); } catch { materiales = []; } }

  // Validaciones mínimas
  if (!usuario_id || !proyecto_id || !sitio_id || !fecha_requerida || !Array.isArray(materiales) || materiales.length === 0) {
    return res.status(400).json({ error: "Faltan datos obligatorios para la requisición." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener departamento y folio
    const deptoQuery = await client.query('SELECT departamento_id FROM usuarios WHERE id = $1', [usuario_id]);
    const departamento_id = deptoQuery.rows[0]?.departamento_id;
    if (!departamento_id) throw new Error('El usuario no tiene un departamento asignado.');

    const folioQuery = await client.query("SELECT nextval('requisiciones_folio_seq') AS folio");
    const folio = folioQuery.rows[0].folio;

    const deptoCodeQuery = await client.query('SELECT codigo FROM departamentos WHERE id = $1', [departamento_id]);
    const depto_codigo = deptoCodeQuery.rows[0].codigo;
    const numero_requisicion = `${depto_codigo}_R.${String(folio).padStart(4, '0')}`;

    // 2. Insertar cabecera de la requisición
    const reqInsert = await client.query(
      `INSERT INTO requisiciones (
          folio, numero_requisicion, rfq_code, usuario_id, departamento_id, proyecto_id, sitio_id,
          fecha_requerida, lugar_entrega, comentario_solicitante, status
       ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, 'ABIERTA')
       RETURNING id`,
      [folio, numero_requisicion, usuario_id, departamento_id, proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario]
    );
    const requisicionId = reqInsert.rows[0].id;

    // 3. Insertar materiales
    const queryMaterial = `
      INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario)
      VALUES ($1, $2, $3, $4)
    `;
    for (const mat of materiales) {
      if (!mat.id || !mat.cantidad) throw new Error('Material inválido en la lista.');
      await client.query(queryMaterial, [requisicionId, Number(mat.id), Number(mat.cantidad), mat.comentario || null]);
    }

    // 4. Subir adjuntos (si hay)
    if (archivos && archivos.length > 0) {
      // --- CORRECCIÓN ---
      // 'uploadQuoteFile' sube un archivo a la vez. Iteramos.
      for (const archivo of archivos) {
        const archivoSubido = await uploadQuoteFile(
          archivo.buffer,
          archivo.originalname,
          archivo.mimetype,
          numero_requisicion, // reqNum
          depto_codigo,       // deptoCode
          null                // provId (No aplica para requisiciones)
        );
        
        await client.query(
          `INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo)
           VALUES ($1, $2, $3)`,
          [requisicionId, archivoSubido.name, archivoSubido.webViewLink]
        );
      }
    }

    // 5. Borrar borrador si existe (ignoramos errores)
    try {
      await client.query('DELETE FROM requisiciones_borradores WHERE usuario_id = $1', [usuario_id]);
    } catch (err) {
      console.warn("No se pudo eliminar el borrador, continuando...");
    }

    await client.query('COMMIT');
    res.status(201).json({ mensaje: `Requisición ${numero_requisicion} creada exitosamente.`, requisicionId: requisicionId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al crear la requisición:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor." });
  } finally {
    client.release();
  }
};


const actualizarRequisicion = async (req, res) => {
  const { id: requisicionId } = req.params;
  const archivosNuevos = req.files;
  let {
    proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario,
    materiales, adjuntosExistentes
  } = req.body;

  // Normalizaciones
  if (typeof materiales === "string") { try { materiales = JSON.parse(materiales); } catch { materiales = []; } }
  if (typeof adjuntosExistentes === "string") { try { adjuntosExistentes = JSON.parse(adjuntosExistentes); } catch { adjuntosExistentes = []; } }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Actualizar cabecera
    await client.query(
      `UPDATE requisiciones SET
          proyecto_id = $1, sitio_id = $2, fecha_requerida = $3,
          lugar_entrega = $4, comentario_solicitante = $5
       WHERE id = $6 AND status = 'ABIERTA'`,
      [proyecto_id, sitio_id, fecha_requerida, lugar_entrega, comentario, requisicionId]
    );

    // 2. Sincronizar materiales (Borrar los que no vengan y actualizar/insertar)
    const idsMaterialesForm = materiales.map(m => Number(m.id_detalle_db || 0));
    await client.query(
      `DELETE FROM requisiciones_detalle
       WHERE requisicion_id = $1 AND id NOT IN (${idsMaterialesForm.map((id, i) => `$${i + 2}`).join(',') || 'NULL'})`,
      [requisicionId, ...idsMaterialesForm]
    );

    for (const mat of materiales) {
      if (mat.id_detalle_db) {
        // Actualizar existente
        await client.query(
          `UPDATE requisiciones_detalle SET cantidad = $1, comentario = $2
           WHERE id = $3 AND requisicion_id = $4`,
          [mat.cantidad, mat.comentario, mat.id_detalle_db, requisicionId]
        );
      } else {
        // Insertar nuevo
        await client.query(
          `INSERT INTO requisiciones_detalle (requisicion_id, material_id, cantidad, comentario)
           VALUES ($1, $2, $3, $4)`,
          [requisicionId, mat.id, mat.cantidad, mat.comentario]
        );
      }
    }

    // 3. Sincronizar adjuntos
    if (adjuntosExistentes && adjuntosExistentes.length > 0) {
      const idsAdjuntos = adjuntosExistentes.map(a => Number(a.id));
      await client.query(
        `DELETE FROM requisiciones_adjuntos
         WHERE requisicion_id = $1 AND id NOT IN (${idsAdjuntos.map((id, i) => `$${i + 2}`).join(',') || 'NULL'})`,
        [requisicionId, ...adjuntosExistentes]
      );
    } else {
      await client.query('DELETE FROM requisiciones_adjuntos WHERE requisicion_id = $1', [requisicionId]);
    }

    // 4. Subir nuevos adjuntos (si hay)
    if (archivosNuevos && archivosNuevos.length > 0) {
      const reqData = await client.query(`
        SELECT r.numero_requisicion, d.codigo as depto_codigo
          FROM requisiciones r
          JOIN departamentos d ON r.departamento_id = d.id
         WHERE r.id = $1
      `, [requisicionId]);
      const { numero_requisicion, depto_codigo } = reqData.rows[0];

      // --- CORRECCIÓN ---
      for (const archivo of archivosNuevos) {
        const archivoSubido = await uploadQuoteFile(
          archivo.buffer,
          archivo.originalname,
          archivo.mimetype,
          numero_requisicion, // reqNum
          depto_codigo,       // deptoCode
          null                // provId (No aplica)
        );
        await client.query(
          `INSERT INTO requisiciones_adjuntos (requisicion_id, nombre_archivo, ruta_archivo)
           VALUES ($1, $2, $3)`,
          [requisicionId, archivoSubido.name, archivoSubido.webViewLink]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Requisición actualizada correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error al actualizar requisición ${requisicionId}:`, error);
    res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};


const getDetalleRequisicion = async (req, res) => {
    const { id } = req.params;
    try {
        const data = await _getRequisicionCompleta(id);
        if (!data) {
            return res.status(404).json({ error: "Requisición no encontrada." });
        }
        res.json(data);
    } catch (error) {
        console.error("Error al obtener detalle de requisición:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

// --- CORRECCIÓN ---
// Este bloque es el que soluciona el crash de inicio.
// Debe exportar todas las funciones que 'requisiciones.routes.js' importa.
module.exports = {
    crearRequisicion,
    actualizarRequisicion,
    getDetalleRequisicion
};