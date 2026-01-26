// C:\SIRA\backend\controllers\rfq\borradores.rfq.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: Borradores de Cotizaciones (Snapshots de RFQ) — COMPARTIDO POR REQUISICIÓN
 * =================================================================================================
 * Objetivo:
 * - 1 borrador por requisición (NO por usuario).
 * - Permite continuidad operativa: si otro usuario abre el RFQ, ve el mismo snapshot.
 * - Mantiene trazabilidad: guarda actualizado_por_usuario_id.
 *
 * Esquema BD esperado (confirmado):
 *   rfq_borradores (
 *     requisicion_id PK,
 *     data jsonb NOT NULL,
 *     actualizado_en timestamptz NOT NULL default now(),
 *     actualizado_por_usuario_id int NULL
 *   )
 *
 * Rutas:
 *  - GET  /api/rfq/:id/borrador  -> Obtiene el snapshot compartido por requisición
 *  - POST /api/rfq/:id/borrador  -> UPSERT del snapshot compartido por requisición
 *
 * Notas:
 * - El usuario viene del token (middlewares verifyFirebaseToken + loadSiraUser).
 * - No tocamos nada del front/visual. G_RFQForm ya consume /borrador. :contentReference[oaicite:2]{index=2}
 * =================================================================================================
 */

const pool = require('../../db/pool');

// ================================================================================================
// Helpers
// ================================================================================================

const parsePositiveInt = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ================================================================================================
// GET /api/rfq/:id/borrador
// ================================================================================================
const getMiBorradorRfq = async (req, res) => {
  try {
    const requisicionId = parsePositiveInt(req.params.id);

    if (!requisicionId) {
      return res.status(400).json({ error: 'Parámetro requisicion_id inválido.' });
    }

    // Nota: ya NO filtramos por usuario. Snapshot compartido.
    const { rows } = await pool.query(
      `
      SELECT
        data,
        actualizado_en,
        actualizado_por_usuario_id
      FROM public.rfq_borradores
      WHERE requisicion_id = $1
      `,
      [requisicionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró borrador para este RFQ.' });
    }

    return res.status(200).json(rows[0]);
  } catch (e) {
    console.error('[rfq_borradores] getMiBorradorRfq error:', e);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

// ================================================================================================
// POST /api/rfq/:id/borrador
// ================================================================================================
const upsertMiBorradorRfq = async (req, res) => {
  try {
    const requisicionId = parsePositiveInt(req.params.id);
    const usuarioId = req?.usuarioSira?.id ? parsePositiveInt(req.usuarioSira.id) : null;
    const { data } = req.body;

    if (!requisicionId) {
      return res.status(400).json({ error: 'Parámetro requisicion_id inválido.' });
    }
    if (!usuarioId) {
      // Debe venir del token; si no, hay un problema con middlewares
      return res.status(401).json({ error: 'Usuario no autenticado o token inválido.' });
    }
    if (!data || !isPlainObject(data)) {
      return res.status(400).json({ error: 'El campo "data" (objeto) es obligatorio.' });
    }

    // UPSERT por requisicion_id (PK)
    const query = `
      INSERT INTO public.rfq_borradores (requisicion_id, data, actualizado_por_usuario_id)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (requisicion_id)
      DO UPDATE SET
        data = EXCLUDED.data,
        actualizado_por_usuario_id = EXCLUDED.actualizado_por_usuario_id,
        actualizado_en = now()
      RETURNING actualizado_en, actualizado_por_usuario_id;
    `;

    const { rows } = await pool.query(query, [requisicionId, data, usuarioId]);

    return res.status(200).json({
      ok: true,
      actualizado_en: rows[0]?.actualizado_en,
      actualizado_por_usuario_id: rows[0]?.actualizado_por_usuario_id,
    });
  } catch (e) {
    console.error('[rfq_borradores] upsertMiBorradorRfq error:', e);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

module.exports = {
  // Mantengo nombres para no tocar rutas existentes
  getMiBorradorRfq,
  upsertMiBorradorRfq,
};
