// C:\SIRA\backend\controllers\rfq\borradores.rfq.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Borradores de Cotizaciones   (Snapshots de RFQ)
 * =================================================================================================
 * Basado en la lógica de borradores.controller.js
 * pero adaptado para RFQ (usa requisicion_id y usuario_id del token).
 */
const pool = require('../../db/pool');

/**
 * Obtiene el borrador de RFQ del usuario actual para un requisicion_id específico.
 */
const getMiBorradorRfq = async (req, res) => {
  try {
    const { id: requisicionId } = req.params;
    const { id: usuarioId } = req.usuarioSira; // ID de usuario viene del token (loadSiraUser)

    if (!usuarioId || !requisicionId) {
      return res.status(400).json({ error: 'Faltan parámetros de requisición o usuario.' });
    }

    const { rows } = await pool.query(
      'SELECT data, actualizado_en FROM rfq_borradores WHERE requisicion_id = $1 AND usuario_id = $2',
      [requisicionId, usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró un borrador para este RFQ.' });
    }
    res.json(rows[0]);

  } catch (e) {
    console.error('getMiBorradorRfq error:', e);
    res.status(500).json({ error: 'Error interno.' });
  }
};

/**
 * Guarda (UPSERT) el borrador de RFQ del usuario actual.
 */
const upsertMiBorradorRfq = async (req, res) => {
  try {
    const { id: requisicionId } = req.params;
    const { id: usuarioId } = req.usuarioSira; // ID de usuario viene del token
    const { data } = req.body; // JSON del formulario: { materiales, providerConfigs }

    if (!usuarioId || !requisicionId || !data) {
      return res.status(400).json({ error: 'requisicion_id, usuario_id y data son obligatorios' });
    }

    const query = `
      INSERT INTO rfq_borradores (requisicion_id, usuario_id, data)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (requisicion_id, usuario_id)
      DO UPDATE SET data = EXCLUDED.data, actualizado_en = now()
      RETURNING actualizado_en;
    `;
    
    const { rows } = await pool.query(query, [requisicionId, usuarioId, data]);
    res.json({ ok: true, ...rows[0] });

  } catch (e) {
    console.error('upsertMiBorradorRfq error:', e);
    res.status(500).json({ error: 'Error interno.' });
  }
};

module.exports = { getMiBorradorRfq, upsertMiBorradorRfq };