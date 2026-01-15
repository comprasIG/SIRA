// C:\SIRA\backend\controllers\requisiciones\helper.js
const pool = require('../../db/pool');

/**
 * @description Retorna una requisición con todos sus datos
 * - Incluye IDs crudos y material_id en el detalle (clave para edición)
 */
const _getRequisicionCompleta = async (id, client) => {
  const db = client || pool;

  const reqQuery = `
    SELECT 
      r.id,
      r.numero_requisicion,
      r.fecha_creacion,
      r.fecha_requerida,
      r.status,
      r.lugar_entrega,              -- crudo (puede ser id como texto)
      r.comentario AS comentario_general,
      r.proyecto_id,                -- IDs crudos para el front
      r.sitio_id,
      u.nombre  AS usuario_creador,
      u.correo  AS usuario_creador_correo,
      p.nombre  AS proyecto,
      s.nombre  AS sitio,
      d.codigo  AS departamento_codigo,
      le.nombre AS lugar_entrega_nombre
    FROM requisiciones r
    JOIN usuarios u      ON r.usuario_id = u.id
    JOIN proyectos p     ON r.proyecto_id = p.id
    JOIN sitios s        ON r.sitio_id = s.id
    JOIN departamentos d ON u.departamento_id = d.id
    LEFT JOIN sitios le  ON r.lugar_entrega::integer = le.id
    WHERE r.id = $1;
  `;
  const reqResult = await db.query(reqQuery, [id]);
  if (reqResult.rows.length === 0) throw new Error('Requisición no encontrada.');

  const materialesResult = await db.query(
    `SELECT 
        rd.id,
        rd.material_id,            -- ¡clave para edición!
        rd.cantidad,
        rd.comentario,
        cm.nombre AS material,
        cm.sku AS sku,
        cu.simbolo AS unidad
      FROM requisiciones_detalle rd
      JOIN catalogo_materiales cm ON rd.material_id = cm.id
      JOIN catalogo_unidades  cu ON cm.unidad_de_compra = cu.id
      WHERE rd.requisicion_id = $1
      ORDER BY cm.nombre;`,
    [id]
  );

  const adjuntosResult = await db.query(
    `SELECT id, nombre_archivo, ruta_archivo
       FROM requisiciones_adjuntos
      WHERE requisicion_id = $1;`,
    [id]
  );

  return {
    ...reqResult.rows[0],
    materiales: materialesResult.rows,
    adjuntos: adjuntosResult.rows,
  };
};

module.exports = { _getRequisicionCompleta };
