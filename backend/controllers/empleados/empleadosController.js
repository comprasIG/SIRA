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

        // Fíjate en el JOIN con periodos_laborales y cómo filtramos
        let sql = `
            SELECT 
                e.*, 
                -- ¡AQUÍ ESTÁ LA MAGIA! Traemos los IDs del periodo activo para tu formulario
                pl.empresa_id,
                pl.area_id,
                pl.puesto_id,
                pl.departamento_rh_id,
                pl.status_trabajador_id,
                pl.fecha_ingreso,
                
                -- Y aquí siguen los nombres para que tu tabla visual (verEmpleados) se vea bonita
                emp.razon_social AS nombre_empresa,
                a.nombre_area AS nombre_area,
                p.nombre_puesto AS nombre_puesto,
                drh.nombre AS nombre_departamento_rh,
                st.nombre_status AS nombre_status,
                na.nivel AS nombre_nivel_academico
            FROM empleados e
            LEFT JOIN periodos_laborales pl ON e.id = pl.empleado_id AND pl.fecha_baja IS NULL
            LEFT JOIN empresas emp ON pl.empresa_id = emp.id
            LEFT JOIN areas a ON pl.area_id = a.id
            LEFT JOIN puestos p ON pl.puesto_id = p.id
            LEFT JOIN departamentos_rh drh ON pl.departamento_rh_id = drh.id
            LEFT JOIN status_trabajador st ON pl.status_trabajador_id = st.id
            LEFT JOIN nivel_academico na ON e.nivel_academico_id = na.id
        `;
        
        const where = [];

        // Aseguramos que el status_trabajador_id busque en la tabla correcta (pl)
        if (status_trabajador_id) {
            where.push(`pl.status_trabajador_id = $${i++}`);
            params.push(status_trabajador_id);
        }

        if (search) {
            where.push(`(
                e.num_empl ILIKE $${i} OR
                e.empleado ILIKE $${i} OR
                p.nombre_puesto ILIKE $${i} OR
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
// Crear Empleado (Sin Depto SIRA y con Nivel Académico)
// ========================================================================================
const crearEmpleado = async (req, res) => {
    // Obtenemos un cliente dedicado para la transacción
    const client = await pool.connect(); 

    try {
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, 
            empresa_id, area_id, puesto_id, departamento_rh_id, status_trabajador_id,
            status_laboral, nivel_academico_id
        } = req.body;

        const fechaNacimientoDB = fecha_nacimiento === '' ? null : fecha_nacimiento;
        const aniosCalculados = calcularEdad(fechaNacimientoDB);
        const foto_emp = req.file ? `uploads/fotos_empleados/${req.file.filename}` : null;

        // INICIAMOS LA TRANSACCIÓN
        await client.query('BEGIN');

        // PASO 1: Insertar en la tabla 'empleados'
        const queryEmpleados = `
            INSERT INTO empleados (
                num_empl, empleado, rfc, nss, curp, 
                genero, fecha_nacimiento, años, 
                status_laboral, foto_emp, nivel_academico_id,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, 
                $9, $10, $11,
                NOW(), NOW()
            )
            RETURNING id; -- Solo necesitamos que nos devuelva el ID nuevo
        `;
        
        const valuesEmpleados = [
            num_empl, empleado, rfc, nss, curp, 
            genero || null, fechaNacimientoDB, aniosCalculados, 
            status_laboral || 'activo', foto_emp, nivel_academico_id || null
        ];

        const resultEmpleado = await client.query(queryEmpleados, valuesEmpleados);
        const nuevoEmpleadoId = resultEmpleado.rows[0].id;

        // PASO 2: Insertar en la tabla 'periodos_laborales'
        const queryPeriodos = `
            INSERT INTO periodos_laborales (
                empleado_id, empresa_id, area_id, departamento_rh_id, 
                puesto_id, status_trabajador_id, fecha_ingreso, fecha_baja,
                creado_en, actualizado_en
            ) VALUES (
                $1, $2, $3, $4, 
                $5, $6, $7, NULL, -- fecha_baja nace nula
                NOW(), NOW()
            )
        `;

        const valuesPeriodos = [
            nuevoEmpleadoId, 
            empresa_id || null, area_id || null, departamento_rh_id || null, 
            puesto_id || null, status_trabajador_id || null, 
            fecha_ingreso || new Date()
        ];

        await client.query(queryPeriodos, valuesPeriodos);

        // SI TODO SALIÓ BIEN, GUARDAMOS LOS CAMBIOS DEFINITIVAMENTE
        await client.query('COMMIT');
        
        res.status(201).json({ 
            message: 'Empleado y periodo laboral creados exitosamente',
            id: nuevoEmpleadoId 
        });

    } catch (error) {
        // SI ALGO FALLÓ, REVERTIMOS TODO (Ni empleado, ni periodo)
        await client.query('ROLLBACK');
        console.error("❌ ERROR AL INSERTAR (Transacción revertida):", error.message); 
        res.status(500).json({ error: 'Error al crear el empleado. ' + error.message });
    } finally {
        // Liberamos el cliente para que otros lo puedan usar
        client.release();
    }
};

// ========================================================================================
// Actualizar Empleado (Sin Depto SIRA y con Nivel Académico)
// ========================================================================================
const actualizarEmpleado = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { 
            num_empl, empleado, fecha_ingreso, rfc, nss, curp, 
            genero, fecha_nacimiento, 
            empresa_id, area_id, puesto_id, departamento_rh_id, status_trabajador_id,
            status_laboral, motivo_baja, fecha_baja, nivel_academico_id
        } = req.body;

        const aniosCalculados = calcularEdad(fecha_nacimiento);
        const foto_emp = req.file ? `uploads/fotos_empleados/${req.file.filename}` : null;

        await client.query('BEGIN');

        // =========================================================================
        // PASO 1: Obtener el estado ACTUAL del empleado antes de cambiar nada
        // =========================================================================
        const queryEstadoActual = `
            SELECT e.status_laboral, pl.id AS periodo_activo_id, 
                   pl.puesto_id, pl.area_id, pl.departamento_rh_id, 
                   pl.empresa_id, pl.status_trabajador_id
            FROM empleados e
            LEFT JOIN periodos_laborales pl ON e.id = pl.empleado_id AND pl.fecha_baja IS NULL
            WHERE e.id = $1
        `;
        const { rows: estadoActualRows } = await client.query(queryEstadoActual, [id]);
        
        if (estadoActualRows.length === 0) {
            throw new Error('Empleado no encontrado');
        }

        const estadoActual = estadoActualRows[0];
        const periodoActivoId = estadoActual.periodo_activo_id;

        // =========================================================================
        // PASO 2: Actualizar siempre los datos personales (Tabla empleados)
        // =========================================================================
        const queryUpdateEmpleados = `
            UPDATE empleados SET
                num_empl = $1, empleado = $2, rfc = $3, nss = $4, curp = $5, 
                genero = $6, fecha_nacimiento = $7, años = $8, 
                status_laboral = $9, foto_emp = COALESCE($10, foto_emp),
                nivel_academico_id = $11, updated_at = NOW()
            WHERE id = $12
        `;
        const valuesUpdateEmpleados = [
            num_empl, empleado, rfc, nss, curp, 
            genero || null, fecha_nacimiento || null, aniosCalculados, 
            status_laboral || 'activo', foto_emp, nivel_academico_id || null, id
        ];
        await client.query(queryUpdateEmpleados, valuesUpdateEmpleados);

        // =========================================================================
        // PASO 3: Lógicas de Movimiento Laboral (El corazón del sistema)
        // =========================================================================

        // ESCENARIO A: Lo están dando de BAJA
        if (status_laboral === 'baja' && estadoActual.status_laboral !== 'baja') {
            if (periodoActivoId) {
                // Cerramos su periodo activo actual
                await client.query(`
                    UPDATE periodos_laborales 
                    SET fecha_baja = $1, motivo_baja = $2, actualizado_en = NOW() 
                    WHERE id = $3
                `, [fecha_baja || new Date(), motivo_baja || 'No especificado', periodoActivoId]);
            }
        } 
        
        // ESCENARIO B: Sigue activo, pero REINGRESÓ o tuvo un CAMBIO DE PUESTO/CONTRATO
        else if (status_laboral === 'activo') {
            // Verificamos si cambió algún dato operativo clave
            const huboCambioOperativo = 
                String(estadoActual.puesto_id) !== String(puesto_id) ||
                String(estadoActual.area_id) !== String(area_id) ||
                String(estadoActual.departamento_rh_id) !== String(departamento_rh_id) ||
                String(estadoActual.empresa_id) !== String(empresa_id) ||
                String(estadoActual.status_trabajador_id) !== String(status_trabajador_id);

            // Si estaba de baja y regresó (Reingreso) o si hubo promoción/cambio de área
            if (estadoActual.status_laboral === 'baja' || huboCambioOperativo) {
                
                // Si tenía un periodo abierto (caso de promoción/cambio interno), lo cerramos
                if (periodoActivoId) {
                    await client.query(`
                        UPDATE periodos_laborales 
                        SET fecha_baja = CURRENT_DATE, motivo_baja = 'Cambio de puesto/contrato', actualizado_en = NOW() 
                        WHERE id = $1
                    `, [periodoActivoId]);
                }

                // Insertamos el NUEVO periodo (Aplica para reingreso o para el nuevo puesto)
                const queryNuevoPeriodo = `
                    INSERT INTO periodos_laborales (
                        empleado_id, empresa_id, area_id, departamento_rh_id, 
                        puesto_id, status_trabajador_id, fecha_ingreso, fecha_baja,
                        creado_en, actualizado_en
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, NULL, NOW(), NOW()
                    )
                `;
                const valuesNuevoPeriodo = [
                    id, empresa_id || null, area_id || null, departamento_rh_id || null, 
                    puesto_id || null, status_trabajador_id || null, 
                    fecha_ingreso || new Date() // Si es reingreso, RH debe mandar esta fecha
                ];
                await client.query(queryNuevoPeriodo, valuesNuevoPeriodo);
            }
        }

        // Si llegó hasta aquí sin errores, guardamos todo en la base de datos
        await client.query('COMMIT');
        res.json({ message: 'Empleado actualizado correctamente' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al actualizar:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

// ========================================================================================
// Obtener Historial de un Empleado (Para el Modal del Frontend)
// ========================================================================================
const obtenerHistorialEmpleado = async (req, res) => {
    try {
        const { id } = req.params; // El ID del empleado que el frontend manda al hacer clic

        const query = `
            SELECT 
                pl.id AS periodo_id,
                pl.fecha_ingreso,
                pl.fecha_baja,
                pl.motivo_baja,
                emp.razon_social AS nombre_empresa,
                a.nombre_area AS nombre_area,
                drh.nombre AS nombre_departamento_rh,
                p.nombre_puesto AS nombre_puesto,
                st.nombre_status AS nombre_status_trabajador
            FROM periodos_laborales pl
            LEFT JOIN empresas emp ON pl.empresa_id = emp.id
            LEFT JOIN areas a ON pl.area_id = a.id
            LEFT JOIN departamentos_rh drh ON pl.departamento_rh_id = drh.id
            LEFT JOIN puestos p ON pl.puesto_id = p.id
            LEFT JOIN status_trabajador st ON pl.status_trabajador_id = st.id
            WHERE pl.empleado_id = $1
            ORDER BY pl.fecha_ingreso DESC; -- El cargo más reciente aparecerá primero
        `;

        const result = await pool.query(query, [id]);

        // Si todo sale bien, devolvemos el arreglo de periodos
        res.json(result.rows);

    } catch (error) {
        console.error("Error al obtener el historial del empleado:", error.message);
        res.status(500).json({ error: 'Error al obtener el historial' });
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

// Exportar funciones
module.exports = { 
    obtenerEmpleados, 
    crearEmpleado, 
    actualizarEmpleado,
    eliminarEmpleado,
    obtenerHistorialEmpleado
};