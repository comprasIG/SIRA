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

// Obtener Empleados (Con JOIN para traer el nombre del departamento)
const obtenerEmpleados = async (req, res) => {
    try {
        const { status_laboral, search, limit } = req.query;
        const params = [];
        let i = 1;

        let sql = `
            SELECT e.*, d.nombre AS nombre_departamento 
            FROM empleados e
            LEFT JOIN departamentos d ON e.departamento_id = d.id
        `;
        
        const where = [];

        if (status_laboral) {
            where.push(`e.status_laboral = $${i++}`);
            params.push(status_laboral);
        }

        if (search) {
            where.push(`(
                e.num_empl ILIKE $${i} OR
                e.empleado ILIKE $${i} OR
                e.puesto ILIKE $${i} OR
                d.nombre ILIKE $${i}
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

// Crear Empleado 
const crearEmpleado = async (req, res) => {
    try {
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, empresa, puesto, departamento_id, status_laboral 
        } = req.body;

        const fechaIngresoDB = fecha_ingreso === '' ? null : fecha_ingreso;
        const fechaNacimientoDB = fecha_nacimiento === '' ? null : fecha_nacimiento;
        const aniosCalculados = calcularEdad(fechaNacimientoDB);

        const query = `
            INSERT INTO empleados (
                num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
                genero, fecha_nacimiento, años, empresa, puesto, departamento_id, status_laboral, 
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            RETURNING *;
        `;

        const values = [
            num_empl, empleado, fechaIngresoDB, rfc, nss, curp, 
            genero, fechaNacimientoDB, aniosCalculados, empresa, puesto, 
            departamento_id, status_laboral 
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("❌ ERROR AL INSERTAR:", error.message); 
        res.status(500).json({ error: error.message });
    }
};

// Actualizar Empleado
const actualizarEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, empresa, puesto, departamento_id, status_laboral 
        } = req.body;

        const aniosCalculados = calcularEdad(fecha_nacimiento);

        const query = `
            UPDATE empleados SET
                num_empl = $1, empleado = $2, fecha_ingreso = $3, rfc = $4, nss = $5, 
                curp = $6, genero = $7, fecha_nacimiento = $8, años = $9, 
                empresa = $10, puesto = $11, departamento_id = $12, status_laboral = $13,
                updated_at = NOW()
            WHERE id = $14
            RETURNING *;
        `;

        const values = [
            num_empl, empleado, fecha_ingreso || null, rfc, nss, curp, 
            genero, fecha_nacimiento || null, aniosCalculados, empresa, puesto, 
            departamento_id, status_laboral, id
        ];

        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al actualizar:", error.message);
        res.status(500).json({ error: error.message });
    }
}; 

//  Obtener Departamentos
const obtenerDepartamentos = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre FROM departamentos ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener departamentos:", error);
        res.status(500).json({ error: 'Error al obtener la lista de departamentos' });
    }
};

// Eliminar Empleado (Por si lo borraste sin querer en tu archivo, aquí lo regreso)
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