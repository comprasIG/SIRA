// backend/controllers/roles.controller.js
const pool = require("../db/pool");

const getRolesConDetalle = async (req, res) => {
  try {
    const rolesResult = await pool.query(`SELECT id, codigo, nombre FROM roles ORDER BY nombre`);
    const roles = rolesResult.rows;

    const usuariosResult = await pool.query(`SELECT role_id, id, nombre FROM usuarios WHERE activo = true ORDER BY nombre`);
    const usuariosPorRol = usuariosResult.rows.reduce((acc, user) => {
      if (!acc[user.role_id]) acc[user.role_id] = [];
      acc[user.role_id].push({ id: user.id, nombre: user.nombre });
      return acc;
    }, {});

    const funcionesResult = await pool.query(`
      SELECT rf.rol_id, f.id, f.codigo, f.nombre, f.modulo
      FROM rol_funcion rf JOIN funciones f ON rf.funcion_id = f.id
      ORDER BY f.modulo, f.nombre
    `);
    const funcionesPorRol = funcionesResult.rows.reduce((acc, func) => {
      if (!acc[func.rol_id]) acc[func.rol_id] = [];
      acc[func.rol_id].push({ id: func.id, codigo: func.codigo, nombre: func.nombre, modulo: func.modulo });
      return acc;
    }, {});

    res.json(roles.map(rol => ({ ...rol, usuarios: usuariosPorRol[rol.id] || [], funciones: funcionesPorRol[rol.id] || [] })));
  } catch (error) {
    console.error("Error al obtener roles con detalle:", error);
    res.status(500).json({ error: "Error al consultar roles" });
  }
};

const getAllFunciones = async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, codigo, nombre, modulo FROM funciones ORDER BY modulo, nombre`);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener todas las funciones:", error);
    res.status(500).json({ error: "Error al consultar funciones" });
  }
};

const crearRol = async (req, res) => {
  const { codigo, nombre } = req.body;
  if (!codigo || !nombre) return res.status(400).json({ error: "El código y el nombre son obligatorios." });
  try {
    const result = await pool.query(
      `INSERT INTO roles (codigo, nombre) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING RETURNING *`,
      [codigo.toUpperCase(), nombre]
    );
    if (result.rowCount === 0) return res.status(409).json({ error: `El código de rol '${codigo}' ya existe.` });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear rol:", error);
    res.status(500).json({ error: "Error al crear rol." });
  }
};

const syncFuncionesRol = async (req, res) => {
  const { rolId } = req.params;
  const { funcionIds } = req.body;
  if (!Array.isArray(funcionIds)) return res.status(400).json({ error: "Se esperaba un array de 'funcionIds'." });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM rol_funcion WHERE rol_id = $1', [rolId]);
    if (funcionIds.length > 0) {
      const values = funcionIds.map((funcId, index) => `($1, $${index + 2})`).join(',');
      await client.query(`INSERT INTO rol_funcion (rol_id, funcion_id) VALUES ${values}`, [rolId, ...funcionIds]);
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

const cambiarRolUsuario = async (req, res) => {
  const { usuarioId } = req.params;
  const { nuevoRolId } = req.body;
  if (!nuevoRolId) return res.status(400).json({ error: "El 'nuevoRolId' es obligatorio." });
  try {
    const result = await pool.query(
      'UPDATE usuarios SET role_id = $1, actualizado_en = NOW() WHERE id = $2 RETURNING id, role_id',
      [nuevoRolId, usuarioId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: `Usuario con id ${usuarioId} no encontrado.` });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error al cambiar rol de usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario." });
  }
};

// ── Acceso Flotilla ──────────────────────────────────────────────────────────

const getDeptAccesoUnidades = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.codigo, d.nombre, COALESCE(a.puede_ver_todo, false) AS puede_ver_todo
       FROM departamentos d
       LEFT JOIN departamentos_acceso_unidades a ON d.id = a.departamento_id
       ORDER BY d.nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener acceso unidades:", error);
    res.status(500).json({ error: "Error al consultar acceso a flotilla." });
  }
};

const updateDeptAccesoUnidades = async (req, res) => {
  const { deptoId } = req.params;
  const { puede_ver_todo } = req.body;
  if (typeof puede_ver_todo !== 'boolean') return res.status(400).json({ error: "El campo 'puede_ver_todo' debe ser booleano." });
  try {
    await pool.query(
      `INSERT INTO departamentos_acceso_unidades (departamento_id, puede_ver_todo)
       VALUES ($1, $2)
       ON CONFLICT (departamento_id)
       DO UPDATE SET puede_ver_todo = EXCLUDED.puede_ver_todo, actualizado_en = NOW()`,
      [deptoId, puede_ver_todo]
    );
    res.json({ mensaje: `Acceso actualizado para departamento ${deptoId}.` });
  } catch (error) {
    console.error("Error al actualizar acceso unidades:", error);
    res.status(500).json({ error: "Error al actualizar acceso a flotilla." });
  }
};

// ── Config Tipos de Evento ───────────────────────────────────────────────────

const getEventoTiposConfig = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, codigo, nombre, descripcion, activo,
              genera_requisicion, requiere_num_serie,
              km_intervalo, tipo_combustible_aplica, material_sku
       FROM unidades_evento_tipos ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener tipos de evento para config:", error);
    res.status(500).json({ error: "Error al consultar tipos de evento." });
  }
};

const updateEventoTipoConfig = async (req, res) => {
  const { id } = req.params;
  const { km_intervalo, genera_requisicion, requiere_num_serie, tipo_combustible_aplica, material_sku, activo } = req.body;
  try {
    const { rowCount } = await pool.query(
      `UPDATE unidades_evento_tipos SET
         km_intervalo = $1, genera_requisicion = $2, requiere_num_serie = $3,
         tipo_combustible_aplica = $4, material_sku = $5, activo = $6, actualizado_en = NOW()
       WHERE id = $7`,
      [km_intervalo ?? null, genera_requisicion === true, requiere_num_serie === true,
       tipo_combustible_aplica || null, material_sku || null, activo !== false, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Tipo de evento no encontrado.' });
    res.json({ mensaje: 'Tipo de evento actualizado.' });
  } catch (error) {
    console.error("Error al actualizar tipo de evento:", error);
    res.status(500).json({ error: "Error al actualizar tipo de evento." });
  }
};

module.exports = {
  getRolesConDetalle,
  getAllFunciones,
  crearRol,
  syncFuncionesRol,
  cambiarRolUsuario,
  getDeptAccesoUnidades,
  updateDeptAccesoUnidades,
  getEventoTiposConfig,
  updateEventoTipoConfig,
};
