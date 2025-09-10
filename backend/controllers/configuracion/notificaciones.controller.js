//C:\SIRA\backend\controllers\configuracion\notificaciones.controller.js

/**
 * =================================================================================================
 * CONTROLADOR: Gestión de Grupos de Notificación
 * =================================================================================================
 * @file notificaciones.controller.js
 * @description Maneja toda la lógica CRUD para los grupos de notificación y la asignación
 * de usuarios a dichos grupos.
 */

const pool = require('../../db/pool');

// --- SECCIÓN: CRUD para Grupos ---

/**
 * @route GET /api/configuracion/notificaciones
 * @description Obtiene todos los grupos de notificación con un conteo de sus miembros.
 */
const getAllGrupos = async (req, res) => {
    try {
        const query = `
            SELECT 
                g.id, g.codigo, g.nombre, g.descripcion,
                COUNT(gu.usuario_id) AS total_miembros
            FROM notificacion_grupos g
            LEFT JOIN notificacion_grupo_usuarios gu ON g.id = gu.grupo_id
            GROUP BY g.id
            ORDER BY g.nombre;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener grupos de notificación:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * @route GET /api/configuracion/notificaciones/:id
 * @description Obtiene el detalle de un grupo, incluyendo la lista de usuarios miembros.
 */
const getGrupoDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        const grupoQuery = await pool.query(`SELECT * FROM notificacion_grupos WHERE id = $1`, [id]);
        if (grupoQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado.' });
        }
        
        const usuariosQuery = await pool.query(`
            SELECT u.id, u.nombre, u.correo 
            FROM usuarios u
            JOIN notificacion_grupo_usuarios gu ON u.id = gu.usuario_id
            WHERE gu.grupo_id = $1 ORDER BY u.nombre;
        `, [id]);
        
        const grupoConDetalle = {
            ...grupoQuery.rows[0],
            usuarios: usuariosQuery.rows
        };
        res.status(200).json(grupoConDetalle);
    } catch (error) {
        console.error(`Error al obtener detalle del grupo ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const crearGrupo = async (req, res) => {
    const { codigo, nombre, descripcion } = req.body;
    if (!codigo || !nombre) {
        return res.status(400).json({ error: "El código y el nombre son obligatorios." });
    }
    try {
        const result = await pool.query(
            `INSERT INTO notificacion_grupos (codigo, nombre, descripcion) VALUES ($1, $2, $3) RETURNING *`,
            [codigo.toUpperCase(), nombre, descripcion]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: "El código del grupo ya existe." });
        }
        console.error("Error al crear grupo de notificación:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * @route PUT /api/configuracion/notificaciones/:id
 * @description Actualiza el nombre o descripción de un grupo existente.
 */
const actualizarGrupo = async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: "El nombre es obligatorio." });
    }
    try {
        const result = await pool.query(
            `UPDATE notificacion_grupos SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *`,
            [nombre, descripcion, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Grupo no encontrado." });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Error al actualizar el grupo ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * @route DELETE /api/configuracion/notificaciones/:id
 * @description Elimina un grupo de notificación.
 */
const eliminarGrupo = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM notificacion_grupos WHERE id = $1`, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Grupo no encontrado." });
        }
        res.status(200).json({ mensaje: "Grupo eliminado correctamente." });
    } catch (error) {
        console.error(`Error al eliminar el grupo ${id}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};



// --- SECCIÓN: Gestión de Miembros (Usuarios) ---

/**
 * @route POST /api/configuracion/notificaciones/:id/usuarios
 * @description Asigna un usuario a un grupo de notificación.
 */
const asignarUsuario = async (req, res) => {
    const { id: grupoId } = req.params;
    const { usuario_id: usuarioId } = req.body;

    if (!usuarioId) {
        return res.status(400).json({ error: "Se requiere el ID del usuario." });
    }

    try {
        await pool.query(
            `INSERT INTO notificacion_grupo_usuarios (grupo_id, usuario_id) VALUES ($1, $2)`,
            [grupoId, usuarioId]
        );
        res.status(201).json({ mensaje: "Usuario asignado al grupo correctamente." });
    } catch (error) {
        // Manejo de error si el usuario ya está en el grupo (violación de primary key)
        if (error.code === '23505') { 
            return res.status(409).json({ error: "El usuario ya es miembro de este grupo." });
        }
        console.error(`Error al asignar usuario al grupo ${grupoId}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * @route DELETE /api/configuracion/notificaciones/:id/usuarios/:usuarioId
 * @description Remueve un usuario de un grupo de notificación.
 */
const removerUsuario = async (req, res) => {
    const { id: grupoId, usuarioId } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM notificacion_grupo_usuarios WHERE grupo_id = $1 AND usuario_id = $2`,
            [grupoId, usuarioId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "El usuario no era miembro de este grupo." });
        }
        res.status(200).json({ mensaje: "Usuario removido del grupo correctamente." });
    } catch (error) {
        console.error(`Error al remover usuario del grupo ${grupoId}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};


module.exports = {
    getAllGrupos,
    getGrupoDetalle,
    crearGrupo,
    actualizarGrupo,
    eliminarGrupo,
    asignarUsuario,
    removerUsuario,
};