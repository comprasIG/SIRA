// C:\SIRA\backend\controllers\proveedores.controller.js

const pool = require("../db/pool");

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const normalizeOptionalText = (value) => {
  if (value === undefined) return undefined;
  return normalizeText(value);
};

const normalizeBoolean = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
};

const normalizeOptionalBoolean = (value) => {
  if (value === undefined) return undefined;
  return normalizeBoolean(value);
};

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeOptionalNumber = (value) => {
  if (value === undefined) return undefined;
  return normalizeNumber(value);
};

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

/**
 * Crea un proveedor nuevo.
 */
const createProveedor = async (req, res) => {
  try {
    const {
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
    } = req.body || {};

    const marcaValue = normalizeText(marca);
    const razonSocialValue = normalizeText(razon_social);

    if (!marcaValue || !razonSocialValue) {
      return res.status(400).json({ error: "Marca y razón social son obligatorias." });
    }

    const query = `
      INSERT INTO proveedores (
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
        correo_notificaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING
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
        actualizado_en;
    `;

    const values = [
      marcaValue,
      razonSocialValue,
      normalizeText(rfc),
      normalizeText(contacto),
      normalizeText(telefono),
      normalizeText(correo),
      normalizeText(direccion),
      normalizeText(web),
      normalizeText(comentarios),
      normalizeNumber(dias_credito),
      normalizeBoolean(whatsapp_notificaciones),
      normalizeBoolean(correo_notificaciones),
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear proveedor:", error);
    res.status(500).json({ error: "Error interno al crear proveedor." });
  }
};

/**
 * Actualiza un proveedor existente.
 */
const updateProveedor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Identificador de proveedor inválido." });
    }

    const {
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
    } = req.body || {};

    const fields = {
      marca: normalizeOptionalText(marca),
      razon_social: normalizeOptionalText(razon_social),
      rfc: normalizeOptionalText(rfc),
      contacto: normalizeOptionalText(contacto),
      telefono: normalizeOptionalText(telefono),
      correo: normalizeOptionalText(correo),
      direccion: normalizeOptionalText(direccion),
      web: normalizeOptionalText(web),
      comentarios: normalizeOptionalText(comentarios),
      dias_credito: normalizeOptionalNumber(dias_credito),
      whatsapp_notificaciones: normalizeOptionalBoolean(whatsapp_notificaciones),
      correo_notificaciones: normalizeOptionalBoolean(correo_notificaciones),
    };

    const updates = [];
    const values = [];

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        values.push(value);
        updates.push(`${key} = $${values.length}`);
      }
    });

    if (!updates.length) {
      return res.status(400).json({ error: "No hay campos para actualizar." });
    }

    values.push(id);

    const query = `
      UPDATE proveedores
      SET ${updates.join(", ")}, actualizado_en = NOW()
      WHERE id = $${values.length}
      RETURNING
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
        actualizado_en;
    `;

    const result = await pool.query(query, values);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Proveedor no encontrado." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al actualizar proveedor:", error);
    res.status(500).json({ error: "Error interno al actualizar proveedor." });
  }
};

module.exports = {
  getProveedores,
  listProveedores,
  createProveedor,
  updateProveedor,
};
