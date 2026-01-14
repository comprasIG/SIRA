// C:\SIRA\backend\controllers\finanzas\fuentesPago.controller.js
const pool = require('../../db/pool');

const listFuentes = async (req, res) => {
  try {
    const soloActivas = (req.query?.soloActivas ?? '').toString().toLowerCase() === 'true';
    const q = `
      SELECT id, nombre, tipo, activo, creado_en, actualizado_en
      FROM catalogo_fuentes_pago
      ${soloActivas ? 'WHERE activo = true' : ''}
      ORDER BY nombre ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error('Error listFuentes:', e);
    res.status(500).json({ error: 'Error al listar fuentes de pago.' });
  }
};

const crearFuente = async (req, res) => {
  try {
    const nombre = (req.body?.nombre ?? '').toString().trim();
    const tipo = (req.body?.tipo ?? 'OTRO').toString().trim().toUpperCase();

    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio.' });
    if (!['BANCO','EFECTIVO','TARJETA','OTRO'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo inválido. Usa BANCO/EFECTIVO/TARJETA/OTRO.' });
    }

    const q = `
      INSERT INTO catalogo_fuentes_pago (nombre, tipo, activo)
      VALUES ($1, $2, true)
      ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo, activo = true, actualizado_en = now()
      RETURNING id, nombre, tipo, activo, creado_en, actualizado_en
    `;
    const { rows } = await pool.query(q, [nombre, tipo]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Error crearFuente:', e);
    res.status(500).json({ error: 'Error al crear fuente de pago.' });
  }
};

const actualizarFuente = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    const nombre = (req.body?.nombre ?? '').toString().trim();
    const tipo = (req.body?.tipo ?? '').toString().trim().toUpperCase();
    const activo = req.body?.activo;

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id inválido.' });
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio.' });
    if (!['BANCO','EFECTIVO','TARJETA','OTRO'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo inválido. Usa BANCO/EFECTIVO/TARJETA/OTRO.' });
    }
    if (typeof activo !== 'boolean') return res.status(400).json({ error: 'activo debe ser boolean.' });

    const q = `
      UPDATE catalogo_fuentes_pago
      SET nombre = $1, tipo = $2, activo = $3, actualizado_en = now()
      WHERE id = $4
      RETURNING id, nombre, tipo, activo, creado_en, actualizado_en
    `;
    const { rows, rowCount } = await pool.query(q, [nombre, tipo, activo, id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Fuente no encontrada.' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Error actualizarFuente:', e);
    res.status(500).json({ error: 'Error al actualizar fuente de pago.' });
  }
};

const desactivarFuente = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id inválido.' });

    const q = `
      UPDATE catalogo_fuentes_pago
      SET activo = false, actualizado_en = now()
      WHERE id = $1
      RETURNING id, nombre, tipo, activo
    `;
    const { rows, rowCount } = await pool.query(q, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Fuente no encontrada.' });
    res.json({ mensaje: 'Fuente desactivada.', fuente: rows[0] });
  } catch (e) {
    console.error('Error desactivarFuente:', e);
    res.status(500).json({ error: 'Error al desactivar fuente de pago.' });
  }
};

module.exports = { listFuentes, crearFuente, actualizarFuente, desactivarFuente };
