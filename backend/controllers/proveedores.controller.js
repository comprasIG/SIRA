// C:\SIRA\backend\controllers\proveedores.controller.js

const pool = require("../db/pool");

/**
 * Busca proveedores por término de búsqueda para autocompletado.
 */
const getProveedores = async (req, res) => {
  try {
    const searchTerm = req.query.query || '';
    if (!searchTerm) {
      return res.json([]);
    }

    // <-- VERIFICA ESTA LÍNEA: Debe seleccionar 'marca as nombre'
    const query = `
      SELECT id, marca as nombre, razon_social
      FROM proveedores
      WHERE unaccent(LOWER(marca)) LIKE unaccent(LOWER($1))
      ORDER BY marca ASC
      LIMIT 20;
    `;
    const values = [`%${searchTerm}%`];

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al buscar proveedores:", error);
    res.status(500).json({ error: "Error interno al buscar proveedores." });
  }
};

/**
 * Lista proveedores con filtros opcionales.
 */
const listProveedores = async (req, res) => {
  try {
    const {
      search = '',
      marca = '',
      razon_social = '',
      rfc = '',
      contacto = '',
    } = req.query;

    const filters = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      filters.push(`(
        unaccent(LOWER(marca)) LIKE unaccent(LOWER($${idx}))
        OR unaccent(LOWER(razon_social)) LIKE unaccent(LOWER($${idx}))
        OR unaccent(LOWER(rfc)) LIKE unaccent(LOWER($${idx}))
        OR unaccent(LOWER(contacto)) LIKE unaccent(LOWER($${idx}))
      )`);
    }

    if (marca) {
      values.push(`%${marca}%`);
      filters.push(`unaccent(LOWER(marca)) LIKE unaccent(LOWER($${values.length}))`);
    }

    if (razon_social) {
      values.push(`%${razon_social}%`);
      filters.push(`unaccent(LOWER(razon_social)) LIKE unaccent(LOWER($${values.length}))`);
    }

    if (rfc) {
      values.push(`%${rfc}%`);
      filters.push(`unaccent(LOWER(rfc)) LIKE unaccent(LOWER($${values.length}))`);
    }

    if (contacto) {
      values.push(`%${contacto}%`);
      filters.push(`unaccent(LOWER(contacto)) LIKE unaccent(LOWER($${values.length}))`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : '';

    const query = `
      SELECT
        id,
        marca,
        razon_social,
        rfc,
        contacto,
        telefono,
        correo,
        direccion,
        web,
        comentarios,
        dias_credito,
        whatsapp_notificaciones,
        correo_notificaciones,
        creado_en,
        actualizado_en
      FROM proveedores
      ${whereClause}
      ORDER BY marca ASC;
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al listar proveedores:", error);
    res.status(500).json({ error: "Error interno al listar proveedores." });
  }
};

module.exports = {
  getProveedores,
  listProveedores,
};
