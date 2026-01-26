// C:\SIRA\backend\controllers\uiPreferencias.controller.js
/**
 * ================================================================================================
 * CONTROLADOR: Preferencias de UI por Usuario
 * ================================================================================================
 * Objetivo:
 * - Persistir preferencias "personales" (por usuario) en BD.
 * - Ejemplo principal: toggle "Mostrar SKU" en G_RFQ.
 *
 * Tabla:
 *   public.usuarios_ui_preferencias (
 *     usuario_id int PK REFERENCES usuarios(id),
 *     data jsonb NOT NULL DEFAULT '{}',
 *     actualizado_en timestamptz NOT NULL DEFAULT now()
 *   )
 *
 * Endpoints:
 *  - GET  /api/ui-preferencias
 *  - PUT  /api/ui-preferencias
 *
 * Notas:
 * - Requiere auth: verifyFirebaseToken + loadSiraUser (req.usuarioSira.id)
 * - Actualizaciones parciales: se hace merge sobre el JSON existente.
 * ================================================================================================
 */

const pool = require('../db/pool');

// Defaults de UI (si el usuario no tiene registro aún)
const DEFAULT_PREFS = {
  showSku: false,
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const sanitizePrefsPatch = (patch) => {
  // Permitimos solo llaves conocidas (whitelist) para mantener robustez.
  const out = {};
  if (!isPlainObject(patch)) return out;

  if (typeof patch.showSku === 'boolean') out.showSku = patch.showSku;

  return out;
};

/**
 * GET /api/ui-preferencias
 * Devuelve las preferencias del usuario actual.
 */
const getUiPreferencias = async (req, res) => {
  try {
    const usuarioId = req?.usuarioSira?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: 'Usuario no autenticado o token inválido.' });
    }

    const { rows } = await pool.query(
      `
      SELECT data, actualizado_en
      FROM public.usuarios_ui_preferencias
      WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    if (rows.length === 0) {
      // Sin registro: devolvemos defaults (sin escribir en BD)
      return res.status(200).json({
        data: DEFAULT_PREFS,
        actualizado_en: null,
      });
    }

    const data = rows[0]?.data && isPlainObject(rows[0].data) ? rows[0].data : {};
    const merged = { ...DEFAULT_PREFS, ...data };

    return res.status(200).json({
      data: merged,
      actualizado_en: rows[0].actualizado_en || null,
    });
  } catch (e) {
    console.error('[ui-preferencias] get error:', e);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

/**
 * PUT /api/ui-preferencias
 * Actualiza (merge) preferencias de UI del usuario actual.
 *
 * Body esperado (patch parcial):
 *  { showSku: true }
 */
const upsertUiPreferencias = async (req, res) => {
  try {
    const usuarioId = req?.usuarioSira?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: 'Usuario no autenticado o token inválido.' });
    }

    const patch = sanitizePrefsPatch(req.body);

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error: 'Body inválido. Envía al menos una preferencia válida (ej. { "showSku": true }).',
      });
    }

    /**
     * Merge robusto:
     * - Si existe fila: data = data || patch (jsonb merge)
     * - Si no existe: inserta patch como data
     */
    const { rows } = await pool.query(
      `
      INSERT INTO public.usuarios_ui_preferencias (usuario_id, data)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (usuario_id)
      DO UPDATE SET
        data = public.usuarios_ui_preferencias.data || EXCLUDED.data,
        actualizado_en = now()
      RETURNING data, actualizado_en;
      `,
      [usuarioId, JSON.stringify(patch)]
    );

    const data = rows[0]?.data && isPlainObject(rows[0].data) ? rows[0].data : {};
    const merged = { ...DEFAULT_PREFS, ...data };

    return res.status(200).json({
      ok: true,
      data: merged,
      actualizado_en: rows[0]?.actualizado_en || null,
    });
  } catch (e) {
    console.error('[ui-preferencias] upsert error:', e);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

module.exports = {
  getUiPreferencias,
  upsertUiPreferencias,
};
