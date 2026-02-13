// C:\SIRA\backend\controllers\usuarios.controller.js
const pool = require("../db/pool");

/**
 * Devuelve todos los usuarios junto con sus funciones permitidas.
 * CORREGIDO: Ahora incluye correo, whatsapp, role_id y activo para que la edición funcione.
 */
const getUsuariosConFunciones = async (req, res) => {
  try {
   const usuariosResult = await pool.query(`
  SELECT 
    u.id,
    u.nombre AS nombre_completo,
    u.correo,          -- AGREGADO: Necesario para editar
    u.correo_google,
    u.whatsapp,        -- AGREGADO: Necesario para editar
    u.role_id,         -- AGREGADO: Para que el select de rol cargue directo
    r.nombre AS rol,
    u.es_superusuario,
    u.departamento_id,
    d.nombre AS departamento,
    u.activo           -- AGREGADO: Para el switch de activo
  FROM usuarios u
  JOIN roles r ON u.role_id = r.id
  LEFT JOIN departamentos d ON u.departamento_id = d.id
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
          WHERE rf.rol_id = $1
          ORDER BY f.codigo
        `, [u.role_id]); // Usamos u.role_id que ahora sí viene en el query
        
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
 * Devuelve el usuario autenticado con sus datos SIRA
 * y una lista de OBJETOS de función completos para el sidebar dinámico.
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
        u.departamento_id, u.role_id,
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
      return res.status(404).json({ error: "Usuario no encontrado en SIRA" });
    }

    const usuario = result.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({ error: "Usuario inactivo o no autorizado" });
    }

    let funcionesResult;
    const camposDeFuncion = 'f.codigo, f.nombre, f.modulo, f.icono, f.ruta';

    if (usuario.es_superusuario) {
      funcionesResult = await pool.query(`SELECT ${camposDeFuncion} FROM funciones f ORDER BY f.modulo, f.nombre`);
    } else {
      funcionesResult = await pool.query(`
        (
          SELECT ${camposDeFuncion}
          FROM rol_funcion rf
          JOIN funciones f ON f.id = rf.funcion_id
          WHERE rf.rol_id = $1
        )
        UNION
        (
          SELECT ${camposDeFuncion}
          FROM funciones f
          WHERE f.modulo = 'Dashboard'
        )
        ORDER BY modulo, nombre
      `, [usuario.role_id]);
    }

    usuario.funciones = funcionesResult.rows;

    res.set('Cache-Control', 'no-store');
    return res.json(usuario);

  } catch (err) {
    console.error("Error al obtener usuario actual:", err);
    return res.status(500).json({ error: "Error al consultar usuario actual" });
  }
};

const searchUsuarios = async (req, res) => {
    const { query } = req.query; 

    if (!query || query.length < 3) {
        return res.json([]); 
    }

    try {
        const searchTerm = `%${query}%`; 
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
    nombre, correo, correo_google, whatsapp,
    role_id, departamento_id, activo = true, es_superusuario = false,
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
    `, [nombre, correo, correo_google, whatsapp || null, role_id, departamento_id, activo, es_superusuario]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return res.status(500).json({ error: "Error al crear usuario" });
  }
};

const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const {
    nombre, correo, correo_google, whatsapp,
    role_id, departamento_id, activo, es_superusuario
  } = req.body;

  try {
    const exist = await pool.query(
      `SELECT id FROM usuarios WHERE (correo_google = $1 OR correo = $2) AND id != $3`,
      [correo_google, correo, id]
    );

    if (exist.rows.length > 0) {
      return res.status(409).json({ error: "Ya existe otro usuario con ese correo" });
    }

    const result = await pool.query(`
      UPDATE usuarios
      SET nombre = $1, 
          correo = $2, 
          correo_google = $3, 
          whatsapp = $4,
          role_id = $5, 
          departamento_id = $6, 
          activo = $7, 
          es_superusuario = $8
      WHERE id = $9
      RETURNING *
    `, [nombre, correo, correo_google, whatsapp || null, role_id, departamento_id, activo, es_superusuario, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    return res.status(500).json({ error: "Error al actualizar usuario" });
  }
};

const eliminarUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`DELETE FROM usuarios WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.status(204).send(); 
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return res.status(500).json({ error: "Error al eliminar usuario" });
  }
};

module.exports = {
  getUsuariosConFunciones,
  crearUsuario,
  getUsuarioActual, 
  searchUsuarios,
  actualizarUsuario,
  eliminarUsuario,
};