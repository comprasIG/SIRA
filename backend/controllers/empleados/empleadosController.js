// backend/controllers/empleados/empleadosController.js
const pool = require('../../db/pool'); 
// Función para obtener todos los empleados
const obtenerEmpleados = async (req, res) => {
    try {
        // Ejecutamos la consulta SQL
        const result = await pool.query('SELECT * FROM empleados ORDER BY id ASC');
        
            // Enviamos los resultados como respuesta JSON
        res.json(result.rows); 
        
    } catch (error) {
        console.error("Error en la consulta:", error);
        res.status(500).json({ error: 'Error al obtener empleados de la BD' });
    }
};

// Función para crear un nuevo empleado
const crearEmpleado = async (req, res) => {
    try {
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, empresa, puesto, departamento, status_laboral 
        } = req.body;

        // Limpieza de fechas (para evitar error de sintaxis en DB)
        const fechaIngresoDB = fecha_ingreso === '' ? null : fecha_ingreso;
        const fechaNacimientoDB = fecha_nacimiento === '' ? null : fecha_nacimiento;

        // Calculamos la columna 'años' automáticamente
        const aniosCalculados = calcularEdad(fechaNacimientoDB);

        //  Query corregido (Incluyendo la columna 'años')
        const query = `
            INSERT INTO empleados (
                num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
                genero, fecha_nacimiento, años, empresa, puesto, departamento, status_laboral, 
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            RETURNING *;
        `;

        const values = [
            num_empl,           // $1
            empleado,           // $2
            fechaIngresoDB,     // $3
            rfc,                // $4
            nss,                // $5
            curp,               // $6
            genero,             // $7
            fechaNacimientoDB,  // $8
            aniosCalculados,    // $9  
            empresa,            // $10
            puesto,             // $11
            departamento,       // $12
            status_laboral      // $13
        ];

        const result = await pool.query(query, values);
        
        console.log("Empleado creado con éxito:", result.rows[0]); // Log para confirmar
        res.status(201).json(result.rows[0]);

    } catch (error) {
        // Este console.log es vital: te dirá el error exacto en la terminal negra
        console.error("❌ ERROR AL INSERTAR EN BD:", error.message); 
        res.status(500).json({ error: error.message });
    }
};

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

// --- Función para actualizar un empleado existente ---
const actualizarEmpleado = async (req, res) => {
    try {
        const { id } = req.params; // El ID viene en la URL (ej: /api/empleados/5)
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, empresa, puesto, departamento, status_laboral 
        } = req.body;

        // Limpieza de datos (Igual que al crear)
        const fechaIngresoDB = fecha_ingreso === '' ? null : fecha_ingreso;
        const fechaNacimientoDB = fecha_nacimiento === '' ? null : fecha_nacimiento;
        const aniosCalculados = calcularEdad(fechaNacimientoDB);

        // Query de Actualización
        const query = `
            UPDATE empleados SET
                num_empl = $1,
                empleado = $2,
                fecha_ingreso = $3,
                rfc = $4,
                nss = $5,
                curp = $6,
                genero = $7,
                fecha_nacimiento = $8,
                años = $9,
                empresa = $10,
                puesto = $11,
                departamento = $12,
                status_laboral = $13,
                updated_at = NOW()
            WHERE id = $14
            RETURNING *;
        `;

        const values = [
            num_empl, empleado, fechaIngresoDB, rfc, nss, curp, 
            genero, fechaNacimientoDB, aniosCalculados, empresa, puesto, 
            departamento, status_laboral, id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Empleado no encontrado" });
        }
        
        res.json(result.rows[0]);

    } catch (error) {
        console.error("Error al actualizar:", error.message);
        res.status(500).json({ error: error.message });
    }
};

// --- Función para eliminar un empleado ---
const eliminarEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM empleados WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Empleado no encontrado" });
        }

        res.sendStatus(204); // 204 significa "Hecho y no tengo nada más que decir"

    } catch (error) {
        console.error("Error al eliminar:", error.message);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    obtenerEmpleados
, crearEmpleado, actualizarEmpleado, eliminarEmpleado
};