const pool = require('../../db/pool'); 

// --- Función auxiliar para calcular edad ---
const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    return edad;
};

// ========================================================================================
// Obtener Empleados
// ========================================================================================
const obtenerEmpleados = async (req, res) => {
    try {
        const { status_trabajador_id, search, limit } = req.query;
        const params = [];
        let i = 1;

        // Se agregó el JOIN para nivel_academico
        let sql = `
            SELECT 
                e.*, 
                d.nombre AS nombre_departamento,
                emp.razon_social AS nombre_empresa,
                a.nombre_area AS nombre_area,
                p.nombre_puesto AS nombre_puesto,
                drh.nombre AS nombre_departamento_rh,
                st.nombre_status AS nombre_status,
                na.nivel AS nombre_nivel_academico
            FROM empleados e
            LEFT JOIN departamentos d ON e.departamento_id = d.id
            LEFT JOIN empresas emp ON e.empresa_id = emp.id
            LEFT JOIN areas a ON e.area_id = a.id
            LEFT JOIN puestos p ON e.puesto_id = p.id
            LEFT JOIN departamentos_rh drh ON e.departamento_rh_id = drh.id
            LEFT JOIN status_trabajador st ON e.status_trabajador_id = st.id
            LEFT JOIN nivel_academico na ON e.nivel_academico_id = na.id
        `;
        
        const where = [];

        if (status_trabajador_id) {
            where.push(`e.status_trabajador_id = $${i++}`);
            params.push(status_trabajador_id);
        }

        if (search) {
            where.push(`(
                e.num_empl ILIKE $${i} OR
                e.empleado ILIKE $${i} OR
                p.nombre_puesto ILIKE $${i} OR
                d.nombre ILIKE $${i} OR
                emp.razon_social ILIKE $${i}
            )`);
            params.push(`%${search}%`);
            i++;
        }

        if (where.length) sql += ' WHERE ' + where.join(' AND ');

        sql += ' ORDER BY e.empleado ASC';

        if (limit) {
            const lim = parseInt(limit, 10);
            if (!Number.isNaN(lim) && lim > 0) {
                sql += ` LIMIT ${lim}`;
            }
        }

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error en la consulta:", error);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
};

// ========================================================================================
// Crear Empleado 
// ========================================================================================
const crearEmpleado = async (req, res) => {
    try {
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, departamento_id, 
            empresa_id, area_id, puesto_id, departamento_rh_id, status_trabajador_id,
            status_laboral, 
            fecha_reingreso, foto_emp, nivel_academico_id // <-- AÑADIDO
        } = req.body;

        const fechaIngresoDB = fecha_ingreso === '' ? null : fecha_ingreso;
        const fechaNacimientoDB = fecha_nacimiento === '' ? null : fecha_nacimiento;
        const fechaReingresoDB = fecha_reingreso === '' ? null : fecha_reingreso;
        const aniosCalculados = calcularEdad(fechaNacimientoDB);

        const query = `
            INSERT INTO empleados (
                num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
                genero, fecha_nacimiento, años, departamento_id,
                empresa_id, area_id, puesto_id, departamento_rh_id, status_trabajador_id,
                status_laboral,
                fecha_reingreso, foto_emp, nivel_academico_id,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, 
                $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19,
                NOW(), NOW()
            )
            RETURNING *;
        `;

        const values = [
            num_empl, empleado, fechaIngresoDB, rfc, nss, curp, 
            genero, fechaNacimientoDB, aniosCalculados, departamento_id || null, 
            empresa_id || null, area_id || null, puesto_id || null, departamento_rh_id || null, status_trabajador_id || null,
            status_laboral || 'Activo', 
            fechaReingresoDB, foto_emp || null, nivel_academico_id || null // <-- AÑADIDO
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("❌ ERROR AL INSERTAR:", error.message); 
        res.status(500).json({ error: error.message });
    }
};

// ========================================================================================
// Actualizar Empleado 
// ========================================================================================
const actualizarEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, departamento_id,
            empresa_id, area_id, puesto_id, departamento_rh_id, status_trabajador_id,
            status_laboral, 
            fecha_reingreso, foto_emp, nivel_academico_id // <-- AÑADIDO
        } = req.body;

        const aniosCalculados = calcularEdad(fecha_nacimiento);
        const fechaIngresoDB = fecha_ingreso === '' ? null : fecha_ingreso;
        const fechaReingresoDB = fecha_reingreso === '' ? null : fecha_reingreso;

        const query = `
            UPDATE empleados SET
                num_empl = $1, empleado = $2, fecha_ingreso = $3, rfc = $4, nss = $5, 
                curp = $6, genero = $7, fecha_nacimiento = $8, años = $9, 
                departamento_id = $10,
                empresa_id = $11, area_id = $12, puesto_id = $13, departamento_rh_id = $14, status_trabajador_id = $15,
                status_laboral = $16,
                fecha_reingreso = $17, foto_emp = COALESCE($18, foto_emp),
                nivel_academico_id = $19, -- <-- AÑADIDO
                updated_at = NOW()
            WHERE id = $20
            RETURNING *;
        `;

        const values = [
            num_empl, empleado, fechaIngresoDB, rfc, nss, curp, 
            genero, fecha_nacimiento || null, aniosCalculados, 
            departamento_id || null,
            empresa_id || null, area_id || null, puesto_id || null, departamento_rh_id || null, status_trabajador_id || null,
            status_laboral || 'activo', 
            fechaReingresoDB, foto_emp || null, nivel_academico_id || null, // <-- AÑADIDO
            id
        ];

        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al actualizar:", error.message);
        res.status(500).json({ error: error.message });
    }
}; 

// ========================================================================================
// Obtener Departamentos
// ========================================================================================
const obtenerDepartamentos = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre FROM departamentos ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener departamentos:", error);
        res.status(500).json({ error: 'Error al obtener la lista de departamentos' });
    }
};

// ========================================================================================
// Eliminar Empleado 
// ========================================================================================
const eliminarEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM empleados WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Empleado no encontrado" });
        }
        res.sendStatus(204);
    } catch (error) {
        console.error("Error al eliminar:", error.message);
        res.status(500).json({ error: error.message });
    }
};

// Exportar funciones para usarlas en las rutas
module.exports = { 
    obtenerDepartamentos, 
    obtenerEmpleados, 
    crearEmpleado, 
    actualizarEmpleado,
    eliminarEmpleado
};