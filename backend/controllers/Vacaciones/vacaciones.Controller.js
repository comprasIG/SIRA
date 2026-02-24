const pool = require("../../db/pool");
const { generateVacacionesPdf } = require('../../services/VacacionesPdfServices');

/**
 * ============================================================================
 *  CONSULTAR SALDO DE VACACIONES
 * ============================================================================
 * Calcula cuántos días de vacaciones le tocan a un empleado por ley,
 * cuántos ha gastado y cuántos le quedan disponibles.
 */
const consultarSaldoVacaciones = async (req, res) => {
    const { empleado_id } = req.params;

    try {
        // 1. Obtener la fecha de ingreso del empleado
        const empleadoResult = await pool.query(
            `SELECT fecha_ingreso FROM empleados WHERE id = $1`,
            [empleado_id]
        );

        if (empleadoResult.rows.length === 0) {
            return res.status(404).json({ error: "Empleado no encontrado" });
        }

        const fechaIngreso = new Date(empleadoResult.rows[0].fecha_ingreso);
        const hoy = new Date();

        // 2. Calcular los años de antigüedad exactos
        let anosAntiguedad = hoy.getFullYear() - fechaIngreso.getFullYear();
        const mes = hoy.getMonth() - fechaIngreso.getMonth();
        
        // Si aún no pasa su mes de aniversario (o es el mes pero no ha llegado el día), restamos 1 año
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaIngreso.getDate())) {
            anosAntiguedad--;
        }

        // Si tiene menos de 1 año, por ley aún no tiene días exigibles, pero podemos considerarlo como "Año 1 en curso"
        // Dependiendo de la política de la empresa, a veces se adelantan. Por ahora, seremos estrictos con la ley.
        const anosEfectivosParaLey = anosAntiguedad < 1 ? 0 : anosAntiguedad;

        let diasQueLeTocan = 0;

        // 3. Buscar en el catálogo cuántos días le tocan según su antigüedad
        if (anosEfectivosParaLey > 0) {
            const leyResult = await pool.query(
                `SELECT dias_otorgados FROM dias_ley_vacaciones WHERE anos_antiguedad = $1`,
                [anosEfectivosParaLey]
            );
            
            // Si por alguna razón alguien lleva 40 años y no está en la tabla, buscamos el valor máximo configurado
            if (leyResult.rows.length === 0) {
                 const maxLeyResult = await pool.query(`SELECT dias_otorgados FROM dias_ley_vacaciones ORDER BY anos_antiguedad DESC LIMIT 1`);
                 diasQueLeTocan = maxLeyResult.rows[0]?.dias_otorgados || 0;
            } else {
                 diasQueLeTocan = leyResult.rows[0].dias_otorgados;
            }
        }

        // 4. Calcular cuántos días ya ha consumido (Aprobadas o Pendientes) de ese periodo específico
        // Asumimos que queremos saber el saldo del año "actual" ganado.
        const consumidosResult = await pool.query(
            `SELECT SUM(dias_solicitados) as total_gastados 
             FROM vacaciones 
             WHERE empleado_id = $1 
             AND periodo_antiguedad = $2 
             AND estatus IN ('Aprobada', 'Pendiente')`,
            [empleado_id, anosEfectivosParaLey]
        );

        const diasGastados = parseInt(consumidosResult.rows[0].total_gastados) || 0;
        const diasDisponibles = diasQueLeTocan - diasGastados;

        // 5. Enviar la respuesta al frontend
        res.status(200).json({
            empleado_id,
            antiguedad_anios: anosAntiguedad,
            periodo_actual: anosEfectivosParaLey, // Año del que está gozando
            dias_por_ley: diasQueLeTocan,
            dias_gastados: diasGastados,
            dias_disponibles: diasDisponibles > 0 ? diasDisponibles : 0
        });

    } catch (error) {
        console.error("Error al consultar saldo de vacaciones:", error);
        res.status(500).json({ error: "Error interno al calcular saldo de vacaciones" });
    }
};

/**
 * ============================================================================
 *  SOLICITAR VACACIONES
 * ============================================================================
 * Guarda una nueva petición de vacaciones en la base de datos.
 */
const solicitarVacaciones = async (req, res) => {
    const { 
        empleado_id, 
        fecha_inicio, 
        fecha_fin, 
        fecha_retorno, 
        dias_solicitados, 
        periodo_antiguedad, 
        observaciones 
    } = req.body;

    try {
        // Validaciones básicas
        if (!empleado_id || !fecha_inicio || !fecha_fin || !dias_solicitados || !periodo_antiguedad) {
            return res.status(400).json({ error: "Faltan campos obligatorios para la solicitud." });
        }

        // Validación lógica: La fecha de fin no puede ser antes que la de inicio
        if (new Date(fecha_inicio) > new Date(fecha_fin)) {
            return res.status(400).json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin." });
        }

        // Insertar en la base de datos (Entra por defecto como 'Pendiente')
        const result = await pool.query(
            `INSERT INTO vacaciones (
                empleado_id, 
                fecha_inicio, 
                fecha_fin, 
                fecha_retorno, 
                dias_solicitados, 
                periodo_antiguedad, 
                observaciones
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                empleado_id, 
                fecha_inicio, 
                fecha_fin, 
                fecha_retorno || null, 
                dias_solicitados, 
                periodo_antiguedad, 
                observaciones || null
            ]
        );

        res.status(201).json({
            mensaje: "Solicitud de vacaciones creada exitosamente.",
            solicitud: result.rows[0]
        });

    } catch (error) {
        console.error("Error al crear solicitud de vacaciones:", error);
        res.status(500).json({ error: "Error interno al guardar la solicitud." });
    }
};

// Función adicional para obtener el historial de vacaciones (opcional, pero útil para el dashboard)
const obtenerHistorialVacaciones = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                v.id, 
                e.empleado, 
                d.nombre AS departamento,
                'Vacaciones' AS tipo, 
                v.fecha_solicitud,   
                v.fecha_inicio, 
                v.fecha_fin, 
                v.dias_solicitados AS dias, 
                v.estatus 
            FROM vacaciones v
            JOIN empleados e ON v.empleado_id = e.id
            LEFT JOIN departamentos d ON e.departamento_id = d.id
            ORDER BY v.fecha_solicitud DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener el historial de vacaciones:", error);
        res.status(500).json({ error: "Error al obtener historial" });
    }
};


// Función para actualizar el estatus de una solicitud (Aprobar o Rechazar)
const actualizarEstatus = async (req, res) => {
    const { id } = req.params;
    const { estatus } = req.body; // 'Aprobada' o 'Rechazada'

    try {
        const result = await pool.query(
            `UPDATE vacaciones SET estatus = $1, fecha_aprobacion = NOW() WHERE id = $2 RETURNING *`,
            [estatus, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Solicitud no encontrada" });
        }

        res.json({ mensaje: "Estatus actualizado", solicitud: result.rows[0] });
    } catch (error) {
        console.error("Error al actualizar estatus:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};


// Función para descargar el PDF de una solicitud de vacaciones
const descargarPdfVacaciones = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Buscamos los datos completos de la solicitud (Nota: agregué v.empleado_id a la consulta)
        const result = await pool.query(`
            SELECT 
                v.id, v.empleado_id, v.fecha_solicitud, v.fecha_inicio, v.fecha_fin, v.fecha_retorno, 
                v.dias_solicitados, v.periodo_antiguedad, v.estatus, v.observaciones,
                e.empleado, e.num_empl, e.puesto, e.fecha_ingreso,
                d.nombre AS departamento
            FROM vacaciones v
            JOIN empleados e ON v.empleado_id = e.id
            LEFT JOIN departamentos d ON e.departamento_id = d.id
            WHERE v.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Solicitud de vacaciones no encontrada." });
        }

        const datosVacaciones = result.rows[0];

        // =========================================================================
        // 2. CALCULAR DÍAS RESTANTES
        // =========================================================================
        
        // a) Obtenemos los días que le tocan por ley en ese periodo
        const leyResult = await pool.query(
            `SELECT dias_otorgados FROM dias_ley_vacaciones WHERE anos_antiguedad = $1`,
            [datosVacaciones.periodo_antiguedad]
        );
        const diasLey = leyResult.rows.length > 0 ? leyResult.rows[0].dias_otorgados : 0;

        // b) Obtenemos todos los días que el empleado ya tiene Aprobados o Pendientes en ese periodo
        const consumidosResult = await pool.query(
            `SELECT SUM(dias_solicitados) as total_gastados 
             FROM vacaciones 
             WHERE empleado_id = $1 
             AND periodo_antiguedad = $2 
             AND estatus IN ('Aprobada', 'Pendiente')`,
            [datosVacaciones.empleado_id, datosVacaciones.periodo_antiguedad]
        );
        const diasGastados = parseInt(consumidosResult.rows[0].total_gastados) || 0;

        // c) Hacemos la resta y lo inyectamos al objeto que leerá el PDF
        let restantes = diasLey - diasGastados;
        datosVacaciones.dias_restantes = restantes < 0 ? 0 : restantes;

        // =========================================================================

        // 3. Llamar al servicio PDF del Canvas
        const pdfBuffer = await generateVacacionesPdf(datosVacaciones);

        // 4. Enviar el archivo al navegador
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Solicitud_Vacaciones_Folio_${id}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.end(pdfBuffer);

    } catch (error) {
        console.error("Error al generar el PDF de vacaciones:", error);
        res.status(500).json({ error: "Error interno al generar el documento PDF." });
    }
};

module.exports = {
    consultarSaldoVacaciones,
    solicitarVacaciones,
    obtenerHistorialVacaciones,
    actualizarEstatus,
    descargarPdfVacaciones
};