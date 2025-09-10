// C:\SIRA\backend\controllers\usuarios.controller.js

const pool = require("../db/pool");

/**
 * Devuelve todos los usuarios junto con sus funciones permitidas.
 */
const getUsuariosConFunciones = async (req, res) => {
  try {
    const usuariosResult = await pool.query(`
      SELECT 
        u.id,
        u.nombre AS nombre_completo,
        u.correo_google,
        r.nombre AS rol,
        u.es_superusuario
      FROM usuarios u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id;
    `);

    const funcionesTodasResult = await pool.query(`SELECT codigo FROM funciones ORDER BY codigo`);
    const todasLasFunciones = funcionesTodasResult.rows.map(f => f.codigo);

    const usuarios = await Promise.all(
      usuariosResult.rows.map(async (u) => {
        if (u.es_superusuario) {
          return {
            ...u,
            funciones: todasLasFunciones,
          };
        }

        const funcionesPorRol = await pool.query(`
          SELECT f.codigo
          FROM rol_funcion rf
          JOIN funciones f ON f.id = rf.funcion_id
          WHERE rf.rol_id = (
            SELECT role_id FROM usuarios WHERE id = $1
          )
          ORDER BY f.codigo
        `, [u.id]);
        return {
          ...u,
          funciones: funcionesPorRol.rows.map(f => f.codigo),
        };
      })
    );

    res.json(usuarios);
  } catch (error) {
    console.error("Error al obtener usuarios con funciones:", error);
    res.status(500).json({ error: "Error interno al consultar usuarios" });
  }
};

/**
 * Endpoint seguro: Devuelve el usuario autenticado con sus datos SIRA,
 * SOLO si está en la base y activo. Agrega Cache-Control: no-store para evitar caché.
 */
const getUsuarioActual = async (req, res) => {
  const correo_google = req.usuario?.correo_google;

  if (!correo_google) {
    return res.status(400).json({ error: "No se proporcionó correo_google desde el token" });
  }

  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.nombre, u.correo, u.correo_google,
        u.whatsapp, u.activo, u.es_superusuario,
        u.departamento_id,
        d.codigo AS abreviatura,
        r.nombre AS rol,
        d.nombre AS departamento
      FROM usuarios u
      JOIN roles r ON u.role_id = r.id
      JOIN departamentos d ON u.departamento_id = d.id
      WHERE u.correo_google = $1
      LIMIT 1;
    `, [correo_google]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const usuario = result.rows[0];

    // Si el usuario existe pero NO está activo
    if (!usuario.activo) {
      return res.status(403).json({ error: "Usuario inactivo o no autorizado" });
    }

    // Superusuario: obtiene todas las funciones
    if (usuario.es_superusuario) {
      const todas = await pool.query(`SELECT codigo FROM funciones ORDER BY codigo`);
      usuario.funciones = todas.rows.map(f => f.codigo);
    } else {
      const funciones = await pool.query(`
        SELECT f.codigo
        FROM rol_funcion rf
        JOIN funciones f ON f.id = rf.funcion_id
        WHERE rf.rol_id = (
          SELECT role_id FROM usuarios WHERE correo_google = $1
        )
        ORDER BY f.codigo
      `, [correo_google]);
      usuario.funciones = funciones.rows.map(f => f.codigo);
    }

    // 👇🏽 SOLUCIÓN: Desactiva caché para este endpoint
    res.set('Cache-Control', 'no-store');
    return res.json(usuario);

  } catch (err) {
    console.error("Error al obtener usuario actual:", err);
    return res.status(500).json({ error: "Error al consultar usuario actual" });
  }
};

/**
 * Crea un nuevo usuario SIRA en la base de datos.
 */
/**
 * =================================================================================================
 * ¡NUEVA FUNCIÓN!
 * =================================================================================================

 * @route   GET /api/usuarios/search
 * @desc    Busca usuarios por nombre para el componente Autocomplete.
 * @access  Privado (requiere autenticación)
 */
const searchUsuarios = async (req, res) => {
    const { query } = req.query; // Obtiene el término de búsqueda de la URL (ej. ?query=Agustin)

    if (!query || query.length < 3) {
        return res.json([]); // No busca si el término es muy corto
    }

    try {
        const searchTerm = `%${query}%`; // Prepara el término para la búsqueda LIKE
        const result = await pool.query(
            `SELECT id, nombre, correo FROM usuarios WHERE unaccent(nombre) ILIKE unaccent($1) AND activo = true LIMIT 10`,
            [searchTerm]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al buscar usuarios:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};


const crearUsuario = async (req, res) => {
  const {
    nombre,
    correo,
    correo_google,
    whatsapp,
    role_id,
    departamento_id,
    activo = true,
    es_superusuario = false,
  } = req.body;

  try {
    if (!nombre || !correo || !correo_google || !role_id || !departamento_id) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const exist = await pool.query(
      `SELECT id FROM usuarios WHERE correo_google = $1 OR correo = $2`,
      [correo_google, correo]
    );
    if (exist.rows.length > 0) {
      return res.status(409).json({ error: "Ya existe un usuario con ese correo o correo_google" });
    }

    const result = await pool.query(`
      INSERT INTO usuarios (
        nombre, correo, correo_google, whatsapp,
        role_id, departamento_id, activo, es_superusuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, nombre, correo, correo_google, es_superusuario
    `, [
      nombre,
      correo,
      correo_google,
      whatsapp || null,
      role_id,
      departamento_id,
      activo,
      es_superusuario
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return res.status(500).json({ error: "Error al crear usuario" });
  }
};

module.exports = {
  getUsuariosConFunciones,
  crearUsuario,
  getUsuarioActual, 
  searchUsuarios,
};
