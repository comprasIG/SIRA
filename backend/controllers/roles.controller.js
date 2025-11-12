// backend/controllers/roles.controller.js
const pool = require("../db/pool");

/**
 * @description Obtiene todos los roles con sus usuarios y funciones asignadas.
 * (Anteriormente 'getRoles')
 */
const getRolesConDetalle = async (req, res) => {
  try {
    // 1. Obtener todos los roles
    const rolesResult = await pool.query(`
      SELECT id, codigo, nombre FROM roles ORDER BY nombre
    `);
    const roles = rolesResult.rows;

    // 2. Obtener todos los usuarios agrupados por rol
    const usuariosResult = await pool.query(`
      SELECT role_id, id, nombre FROM usuarios WHERE activo = true ORDER BY nombre
    `);
    const usuariosPorRol = usuariosResult.rows.reduce((acc, user) => {
      const rolId = user.role_id;
      if (!acc[rolId]) acc[rolId] = [];
      acc[rolId].push({ id: user.id, nombre: user.nombre });
      return acc;
    }, {});

    // 3. Obtener todas las funciones agrupadas por rol
    const funcionesResult = await pool.query(`
      SELECT rf.rol_id, f.id, f.codigo, f.nombre, f.modulo
      FROM rol_funcion rf
      JOIN funciones f ON rf.funcion_id = f.id
      ORDER BY f.modulo, f.nombre
    `);
    const funcionesPorRol = funcionesResult.rows.reduce((acc, func) => {
      const rolId = func.rol_id;
      if (!acc[rolId]) acc[rolId] = [];
      acc[rolId].push({ id: func.id, codigo: func.codigo, nombre: func.nombre, modulo: func.modulo });
      return acc;
    }, {});

    // 4. Combinar todo
    const rolesConDetalle = roles.map(rol => ({
      ...rol,
      usuarios: usuariosPorRol[rol.id] || [],
      funciones: funcionesPorRol[rol.id] || [],
    }));

    res.json(rolesConDetalle);
  } catch (error) {
    console.error("Error al obtener roles con detalle:", error);
    res.status(500).json({ error: "Error al consultar roles" });
  }
};

/**
 * @description (¡NUEVO!) Obtiene la lista maestra de TODAS las funciones.
 * Utilizado para poblar la lista de checkboxes de permisos.
 */
const getAllFunciones = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, codigo, nombre, modulo 
      FROM funciones 
      ORDER BY modulo, nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener todas las funciones:", error);
    res.status(500).json({ error: "Error al consultar funciones" });
  }
};

/**
 * @description (¡NUEVO!) Crea un nuevo rol.
 */
const crearRol = async (req, res) => {
  const { codigo, nombre } = req.body;
  if (!codigo || !nombre) {
    return res.status(400).json({ error: "El código y el nombre son obligatorios." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO roles (codigo, nombre) VALUES ($1, $2)
       ON CONFLICT (codigo) DO NOTHING
       RETURNING *`,
      [codigo.toUpperCase(), nombre]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: `El código de rol '${codigo}' ya existe.` });
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear rol:", error);
    res.status(500).json({ error: "Error al crear rol." });
  }
};

/**
 * @description (¡NUEVO!) Sincroniza los permisos (funciones) de un rol.
 * Borra los permisos actuales e inserta los nuevos.
 */
const syncFuncionesRol = async (req, res) => {
  const { rolId } = req.params;
  const { funcionIds } = req.body; // Se espera un array de IDs [1, 5, 22]

  if (!Array.isArray(funcionIds)) {
    return res.status(400).json({ error: "Se esperaba un array de 'funcionIds'." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Borrar todos los permisos actuales de este rol
    await client.query('DELETE FROM rol_funcion WHERE rol_id = $1', [rolId]);

    // 2. Insertar los nuevos permisos
    if (funcionIds.length > 0) {
      const values = funcionIds.map((funcId, index) => `($1, $${index + 2})`).join(',');
      const params = [rolId, ...funcionIds];
      
      await client.query(
        `INSERT INTO rol_funcion (rol_id, funcion_id) VALUES ${values}`,
        params
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ mensaje: `Permisos del rol ${rolId} actualizados.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al sincronizar funciones del rol:", error);
    res.status(500).json({ error: "Error al actualizar permisos." });
  } finally {
    client.release();
  }
};

/**
 * @description (¡NUEVO!) Cambia el rol de un usuario.
 */
const cambiarRolUsuario = async (req, res) => {
  const { usuarioId } = req.params;
  const { nuevoRolId } = req.body;

  if (!nuevoRolId) {
    return res.status(400).json({ error: "El 'nuevoRolId' es obligatorio." });
  }

  try {
    const result = await pool.query(
      'UPDATE usuarios SET role_id = $1, actualizado_en = NOW() WHERE id = $2 RETURNING id, role_id',
      [nuevoRolId, usuarioId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Usuario con id ${usuarioId} no encontrado.` });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error al cambiar rol de usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario." });
  }
};

module.exports = {
  getRolesConDetalle, // <--- Modificado
  getAllFunciones,    // <--- Nuevo
  crearRol,           // <--- Nuevo
  syncFuncionesRol,   // <--- Nuevo
  cambiarRolUsuario,  // <--- Nuevo
};