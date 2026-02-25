const pool = require("../../db/pool");
const { generateVacacionesPdf } = require('../../services/VacacionesPdfServices');
// 👇 1. IMPORTAMOS TU SERVICIO DE CORREOS
const { sendEmailWithAttachments } = require('../../services/emailService');

/**
 * ============================================================================
 * FUNCIÓN 1: CONSULTAR SALDO DE VACACIONES
 * ============================================================================
 */
const consultarSaldoVacaciones = async (req, res) => {
    const { empleado_id } = req.params;

    try {
        const empleadoResult = await pool.query(
            `SELECT fecha_ingreso FROM empleados WHERE id = $1`,
            [empleado_id]
        );

        if (empleadoResult.rows.length === 0) {
            return res.status(404).json({ error: "Empleado no encontrado" });
        }

        const fechaIngreso = new Date(empleadoResult.rows[0].fecha_ingreso);
        const hoy = new Date();

        let anosAntiguedad = hoy.getFullYear() - fechaIngreso.getFullYear();
        const mes = hoy.getMonth() - fechaIngreso.getMonth();
        
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaIngreso.getDate())) {
            anosAntiguedad--;
        }

        const anosEfectivosParaLey = anosAntiguedad < 1 ? 0 : anosAntiguedad;

        let diasQueLeTocan = 0;

        if (anosEfectivosParaLey > 0) {
            const leyResult = await pool.query(
                `SELECT dias_otorgados FROM dias_ley_vacaciones WHERE anos_antiguedad = $1`,
                [anosEfectivosParaLey]
            );
            
            if (leyResult.rows.length === 0) {
                 const maxLeyResult = await pool.query(`SELECT dias_otorgados FROM dias_ley_vacaciones ORDER BY anos_antiguedad DESC LIMIT 1`);
                 diasQueLeTocan = maxLeyResult.rows[0]?.dias_otorgados || 0;
            } else {
                 diasQueLeTocan = leyResult.rows[0].dias_otorgados;
            }
        }

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

        res.status(200).json({
            empleado_id,
            antiguedad_anios: anosAntiguedad,
            periodo_actual: anosEfectivosParaLey,
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
 * FUNCIÓN 2: SOLICITAR VACACIONES (ACTUALIZADA CON CORREO)
 * ============================================================================
 */
const solicitarVacaciones = async (req, res) => {
    const { 
        empleado_id, fecha_inicio, fecha_fin, fecha_retorno, 
        dias_solicitados, periodo_antiguedad, observaciones 
    } = req.body;

    try {
        if (!empleado_id || !fecha_inicio || !fecha_fin || !dias_solicitados || !periodo_antiguedad) {
            return res.status(400).json({ error: "Faltan campos obligatorios para la solicitud." });
        }

        if (new Date(fecha_inicio) > new Date(fecha_fin)) {
            return res.status(400).json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin." });
        }

        // 1. Guardamos la solicitud en la base de datos
        const result = await pool.query(
            `INSERT INTO vacaciones (
                empleado_id, fecha_inicio, fecha_fin, fecha_retorno, 
                dias_solicitados, periodo_antiguedad, observaciones
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                empleado_id, fecha_inicio, fecha_fin, fecha_retorno || null, 
                dias_solicitados, periodo_antiguedad, observaciones || null
            ]
        );
        const nuevaSolicitud = result.rows[0];

        // ====================================================================
        // 2. LÓGICA DE NOTIFICACIÓN POR CORREO
        // ====================================================================
        try {
            // A) Obtener todos los datos del empleado y solicitud para el PDF
            const datosCompletosResult = await pool.query(`
                SELECT 
                    v.id, v.empleado_id, v.fecha_solicitud, v.fecha_inicio, v.fecha_fin, v.fecha_retorno, 
                    v.dias_solicitados, v.periodo_antiguedad, v.estatus, v.observaciones,
                    e.empleado, e.num_empl, e.puesto, e.fecha_ingreso,
                    d.nombre AS departamento
                FROM vacaciones v
                JOIN empleados e ON v.empleado_id = e.id
                LEFT JOIN departamentos d ON e.departamento_id = d.id
                WHERE v.id = $1
            `, [nuevaSolicitud.id]);

            if (datosCompletosResult.rows.length > 0) {
                const datosVacaciones = datosCompletosResult.rows[0];

                // B) Calcular los días restantes para inyectarlos al PDF
                const leyResult = await pool.query(`SELECT dias_otorgados FROM dias_ley_vacaciones WHERE anos_antiguedad = $1`, [datosVacaciones.periodo_antiguedad]);
                const diasPorLey = leyResult.rows.length > 0 ? leyResult.rows[0].dias_otorgados : 0;
                
                const consumidosResult = await pool.query(`SELECT SUM(dias_solicitados) as total_gastados FROM vacaciones WHERE empleado_id = $1 AND periodo_antiguedad = $2 AND estatus IN ('Aprobada', 'Pendiente')`, [datosVacaciones.empleado_id, datosVacaciones.periodo_antiguedad]);
                const diasGastados = parseInt(consumidosResult.rows[0].total_gastados) || 0;
                
                datosVacaciones.dias_restantes = diasPorLey - diasGastados;

                // C) Generar el Buffer del PDF en memoria
                const pdfBuffer = await generateVacacionesPdf(datosVacaciones);

                // D) Buscar los correos del grupo SOLI_VAC
                // NOTA:Se Ajusta "grupos_notificaciones" y "grupo_usuarios" si tus tablas se llaman diferente
                const correosResult = await pool.query(`
                    SELECT u.correo, u.correo_google
                    FROM usuarios u
                    JOIN notificacion_grupo_usuarios gu ON u.id = gu.usuario_id
                    JOIN notificacion_grupos gn ON gn.id = gu.grupo_id
                    WHERE gn.codigo = 'SOLI_VAC' AND u.activo = true
                `);

                // Juntamos los correos encontrados (damos prioridad al correo principal)
                const recipients = correosResult.rows.map(row => row.correo || row.correo_google).filter(Boolean);

                if (recipients.length > 0) {
                    // E) Armar y Enviar el Correo
                    const subject = `Nueva Solicitud de Vacaciones - ${datosVacaciones.empleado} (Folio ${datosVacaciones.id})`;
                    
                    // Formateamos fechas para el cuerpo del correo
                    const fInicio = new Date(datosVacaciones.fecha_inicio).toLocaleDateString('es-MX', {timeZone: 'UTC'});
                    const fFin = new Date(datosVacaciones.fecha_fin).toLocaleDateString('es-MX', {timeZone: 'UTC'});
                    const fRetorno = new Date(datosVacaciones.fecha_retorno).toLocaleDateString('es-MX', {timeZone: 'UTC'});

                    const htmlBody = `
                        <div style="font-family: Arial, sans-serif; color: #333;">
                            <h2 style="color: #002D62;">Nueva Solicitud de Vacaciones Registrada</h2>
                            <p>El colaborador <strong>${datosVacaciones.empleado}</strong> ha registrado una nueva solicitud de vacaciones en el sistema.</p>
                            
                            <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin-top: 15px; margin-bottom: 15px;">
                                <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold; width: 40%;">Folio de Solicitud:</td><td style="padding: 8px; border: 1px solid #ddd;">${datosVacaciones.id}</td></tr>
                                <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Departamento:</td><td style="padding: 8px; border: 1px solid #ddd;">${datosVacaciones.departamento || 'N/A'}</td></tr>
                                <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Periodo a disfrutar:</td><td style="padding: 8px; border: 1px solid #ddd;">Del ${fInicio} al ${fFin}</td></tr>
                                <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Días a descontar:</td><td style="padding: 8px; border: 1px solid #ddd;">${datosVacaciones.dias_solicitados} días</td></tr>
                                <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Reincorporación:</td><td style="padding: 8px; border: 1px solid #ddd;">${fRetorno}</td></tr>
                            </table>

                            <p>Se adjunta el <strong>formato oficial en PDF</strong> para su revisión.</p>
                            <p>Por favor, ingrese al sistema SIRA para autorizar o rechazar esta solicitud.</p>
                        </div>
                    `;

                    const attachments = [{
                        filename: `Solicitud_Vacaciones_Folio_${datosVacaciones.id}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }];

                    // Usamos .catch() para que si falla el correo, no cancele la solicitud en la base de datos
                    sendEmailWithAttachments(recipients, subject, htmlBody, attachments)
                        .catch(err => console.error("[Correo Vacaciones] Error al enviar notificación:", err));
                } else {
                    console.log("[Correo Vacaciones] No se encontraron usuarios en el grupo SOLI_VAC.");
                }
            }
        } catch (emailProcessError) {
            console.error("[Correo Vacaciones] Error interno en la generación del correo/PDF:", emailProcessError);
            // No detenemos la respuesta al usuario porque la solicitud sí se guardó en BD
        }
        // ====================================================================

        res.status(201).json({
            mensaje: "Solicitud de vacaciones creada exitosamente.",
            solicitud: nuevaSolicitud
        });

    } catch (error) {
        console.error("Error al crear solicitud de vacaciones:", error);
        res.status(500).json({ error: "Error interno al guardar la solicitud." });
    }
};

/**
 * ============================================================================
 * FUNCIÓN 3: OBTENER HISTORIAL DE VACACIONES
 * ============================================================================
 */
const obtenerHistorialVacaciones = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                v.id, 
                e.empleado, 
                d.nombre AS departamento,
                e.departamento_id,
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

/**
 * ============================================================================
 * FUNCIÓN 4: ACTUALIZAR ESTATUS (APROBAR / RECHAZAR)
 * ============================================================================
 */
const actualizarEstatus = async (req, res) => {
    const { id } = req.params;
    const { estatus } = req.body;

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

/**
 * ============================================================================
 * FUNCIÓN 5: DESCARGAR PDF
 * ============================================================================
 */
const descargarPdfVacaciones = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                v.id, v.fecha_solicitud, v.fecha_inicio, v.fecha_fin, v.fecha_retorno, 
                v.dias_solicitados, v.periodo_antiguedad, v.estatus, v.observaciones,
                e.id AS empleado_id, e.empleado, e.num_empl, e.puesto, e.fecha_ingreso,
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

        const leyResult = await pool.query(
            `SELECT dias_otorgados FROM dias_ley_vacaciones WHERE anos_antiguedad = $1`,
            [datosVacaciones.periodo_antiguedad]
        );
        const diasPorLey = leyResult.rows.length > 0 ? leyResult.rows[0].dias_otorgados : 0;

        const consumidosResult = await pool.query(
            `SELECT SUM(dias_solicitados) as total_gastados 
             FROM vacaciones 
             WHERE empleado_id = $1 
             AND periodo_antiguedad = $2 
             AND estatus IN ('Aprobada', 'Pendiente')`,
            [datosVacaciones.empleado_id, datosVacaciones.periodo_antiguedad]
        );
        const diasGastados = parseInt(consumidosResult.rows[0].total_gastados) || 0;

        datosVacaciones.dias_restantes = diasPorLey - diasGastados;

        const pdfBuffer = await generateVacacionesPdf(datosVacaciones);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Solicitud_Vacaciones_Folio_${id}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.end(pdfBuffer);

    } catch (error) {
        console.error("Error al generar el PDF de vacaciones:", error);
        res.status(500).json({ error: "Error interno al generar el documento PDF." });
    }
};

// EXPORTAR TODAS LAS FUNCIONES
module.exports = {
    consultarSaldoVacaciones,
    solicitarVacaciones,
    obtenerHistorialVacaciones,
    actualizarEstatus,
    descargarPdfVacaciones
};