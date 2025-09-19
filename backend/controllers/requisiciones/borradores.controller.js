// C:\SIRA\backend\controllers\requisiciones\borradores.controller.js
const pool = require('../../db/pool');

/**
 * Obtiene el borrador del usuario actual.
 * Origen del usuario:
 *  - Preferente: req.usuarioSira.id (si ya tienes middleware de auth)
 *  - Alternativo: req.query.usuario_id o req.body.usuario_id
 */
const getMiBorrador = async (req, res) => {
  try {
    const usuarioId = req.usuarioSira?.id || Number(req.query.usuario_id);
    if (!usuarioId) return res.status(400).json({ error: 'usuario_id requerido' });

    const { rows } = await pool.query(
      'SELECT data, actualizado_en FROM requisiciones_borradores WHERE usuario_id = $1',
      [usuarioId]
    );
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (e) {
    console.error('getMiBorrador error:', e);
    res.status(500).json({ error: 'Error interno.' });
  }
};

// upsert del borrador del usuario
const upsertMiBorrador = async (req, res) => {
  try {
    const usuarioId = req.usuarioSira?.id || Number(req.body.usuario_id);
    const { data } = req.body; // JSON del formulario: items, proyecto_id, sitio_id, etc.
    if (!usuarioId || !data) return res.status(400).json({ error: 'usuario_id y data son obligatorios' });

    const query = `
      INSERT INTO requisiciones_borradores (usuario_id, data)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (usuario_id)
      DO UPDATE SET data = EXCLUDED.data, actualizado_en = now()
      RETURNING usuario_id, actualizado_en;
    `;
    const { rows } = await pool.query(query, [usuarioId, data]);
    res.json({ ok: true, ...rows[0] });
  } catch (e) {
    console.error('upsertMiBorrador error:', e);
    res.status(500).json({ error: 'Error interno.' });
  }
};

const borrarMiBorrador = async (req, res) => {
  try {
    const usuarioId = req.usuarioSira?.id || Number(req.body.usuario_id);
    if (!usuarioId) return res.status(400).json({ error: 'usuario_id requerido' });

    await pool.query('DELETE FROM requisiciones_borradores WHERE usuario_id = $1', [usuarioId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('borrarMiBorrador error:', e);
    res.status(500).json({ error: 'Error interno.' });
  }
};

module.exports = { getMiBorrador, upsertMiBorrador, borrarMiBorrador };
