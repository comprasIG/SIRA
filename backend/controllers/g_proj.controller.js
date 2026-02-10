// C:\SIRA\backend\controllers\g_proj.controller.js
/**
 * CONTROLADOR: Generación de Proyectos (G_PROJ)
 * - Crear nuevo proyecto (con status, fechas, finanzas y hitos opcionales)
 */

const pool = require('../db/pool');
const { sendEmailWithAttachments } = require('../services/emailService');
const { generateProjectAuthorizationPdf } = require('../services/projectPdfService');

const ALLOWED_STATUS = new Set([
  'POR_APROBAR',
  'EN_EJECUCION',
  'EN_PAUSA',
  'CANCELADO',
  'CERRADO',
]);

function asTrimString(v) {
  return typeof v === 'string' ? v.trim() : (v === null || v === undefined ? '' : String(v).trim());
}

function parseOptionalInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseRequiredInt(v, fieldName) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`Campo inválido: ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

function parseOptionalDecimalNonNeg(v, fieldName) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    const err = new Error(`Campo inválido (numérico): ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  if (n < 0) {
    const err = new Error(`El campo no puede ser negativo: ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  // Redondeo suave a 4 decimales (coincide con numeric(14,4))
  return Math.round(n * 10000) / 10000;
}

function parseOptionalDecimal(v, fieldName) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    const err = new Error(`Campo invalido (numerico): ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return Math.round(n * 10000) / 10000;
}

function parseOptionalDateISO(v, fieldName) {
  if (v === null || v === undefined || v === '') return null;
  const s = asTrimString(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const err = new Error(`Formato de fecha inválido (${fieldName}). Usa YYYY-MM-DD.`);
    err.statusCode = 400;
    throw err;
  }
  return s;
}

function normalizeMonedaCode(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = asTrimString(v).toUpperCase();
  if (s.length !== 3) return null;
  return s;
}

async function validarMonedaSiExiste(client, codigo, fieldName) {
  if (!codigo) return;
  const r = await client.query(
    `SELECT 1 FROM public.catalogo_monedas WHERE codigo = $1`,
    [codigo]
  );
  if (r.rowCount === 0) {
    const err = new Error(`Moneda inválida en ${fieldName}: ${codigo}`);
    err.statusCode = 400;
    throw err;
  }
}

function pickHitosArray(body) {
  if (Array.isArray(body?.hitos)) return body.hitos;
  if (Array.isArray(body?.milestones)) return body.milestones;
  return [];
}

function safeText(v, fallback = 'N/D') {
  const s = asTrimString(v);
  return s || fallback;
}

function sanitizeFileName(s) {
  return String(s ?? '')
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s-\s/g, ' - ')
    .trim();
}

function formatProjectCode(id, pad = 4) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return 'PROY-S/N';
  return `PROY-${String(n).padStart(pad, '0')}`;
}

function shouldNotifyFlag(v) {
  const raw = String(v ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function getNotificationEmails(groupCode, clientOrPool = pool) {
  const q = `
    SELECT COALESCE(u.correo_google, u.correo) AS correo
    FROM usuarios u
    JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
    JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
    WHERE ng.codigo = $1 AND u.activo = true;
  `;
  const result = await clientOrPool.query(q, [groupCode]);
  return [...new Set(result.rows.map((r) => r.correo).filter(Boolean))];
}

async function getProyectoDataForPdf(client, proyectoId) {
  const proyectoQ = await client.query(
    `
    SELECT
      p.id,
      p.nombre,
      p.descripcion,
      p.status,
      p.fecha_inicio,
      p.fecha_cierre,
      p.total_facturado,
      p.total_facturado_moneda,
      p.costo_total,
      p.costo_total_moneda,
      p.margen_estimado,
      p.margen_moneda,
      p.margen_es_forzado,
      s.nombre AS sitio_nombre,
      c.razon_social AS cliente_nombre,
      u.nombre AS responsable_nombre,
      COALESCE(u.correo_google, u.correo) AS responsable_correo
    FROM public.proyectos p
    LEFT JOIN public.sitios s ON s.id = p.sitio_id
    LEFT JOIN public.clientes c ON c.id = p.cliente_id
    LEFT JOIN public.usuarios u ON u.id = p.responsable_id
    WHERE p.id = $1
    LIMIT 1;
    `,
    [proyectoId]
  );

  if (proyectoQ.rowCount === 0) return null;

  const hitosQ = await client.query(
    `
    SELECT
      id,
      proyecto_id,
      nombre,
      descripcion,
      target_date,
      fecha_realizacion
    FROM public.proyectos_hitos
    WHERE proyecto_id = $1
    ORDER BY target_date ASC NULLS LAST, id ASC;
    `,
    [proyectoId]
  );

  return {
    proyecto: proyectoQ.rows[0],
    hitos: hitosQ.rows || [],
  };
}

const crearProyecto = async (req, res) => {
  const client = await pool.connect();
  try {
    // -----------------------------
    // 1) Inputs base (requeridos)
    // -----------------------------
    const responsable_id = parseRequiredInt(req.body?.responsable_id, 'responsable_id');
    const sitio_id = parseRequiredInt(req.body?.sitio_id, 'sitio_id');

    const nombre = asTrimString(req.body?.nombre);
    const descripcion = asTrimString(req.body?.descripcion);

    if (!nombre) {
      return res.status(400).json({ error: 'Falta nombre del proyecto.' });
    }
    if (!descripcion) {
      return res.status(400).json({ error: 'Falta descripción del proyecto.' });
    }
    if (nombre.length > 100) {
      return res.status(400).json({ error: 'El nombre del proyecto no puede exceder 100 caracteres.' });
    }
    if (descripcion.length > 400) {
      return res.status(400).json({ error: 'La descripción del proyecto no puede exceder 400 caracteres.' });
    }

    // -----------------------------
    // 2) Inputs nuevos (opcionales)
    // -----------------------------
    const statusRaw = asTrimString(req.body?.status);
    const status = statusRaw ? statusRaw.toUpperCase() : null;
    if (status && !ALLOWED_STATUS.has(status)) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${Array.from(ALLOWED_STATUS).join(', ')}`,
      });
    }

    const total_facturado = parseOptionalDecimalNonNeg(req.body?.total_facturado, 'total_facturado');
    let total_facturado_moneda = normalizeMonedaCode(req.body?.total_facturado_moneda);

    const costo_total = parseOptionalDecimalNonNeg(req.body?.costo_total, 'costo_total');
    let costo_total_moneda = normalizeMonedaCode(req.body?.costo_total_moneda);

    let margen_estimado = parseOptionalDecimal(req.body?.margen_estimado, 'margen_estimado');
    let margen_moneda = normalizeMonedaCode(req.body?.margen_moneda);
    let margen_es_forzado = Boolean(req.body?.margen_es_forzado);

    const fecha_inicio = parseOptionalDateISO(req.body?.fecha_inicio, 'fecha_inicio');
    const fecha_cierre = parseOptionalDateISO(req.body?.fecha_cierre, 'fecha_cierre');

    if (fecha_inicio && fecha_cierre && fecha_cierre < fecha_inicio) {
      return res.status(400).json({ error: 'La fecha de cierre no puede ser menor a la fecha de inicio.' });
    }

    // Si no hay monto, no guardamos moneda (evita inconsistencias semánticas)
    if (total_facturado === null) total_facturado_moneda = null;
    if (costo_total === null) costo_total_moneda = null;

    // Si el usuario manda margen, lo consideramos "forzado" (editable)
    if (margen_estimado !== null) {
      margen_es_forzado = true;
      if (!margen_moneda) {
        // Fallback seguro: si hay facturado_moneda úsala, si no, costo_moneda
        margen_moneda = total_facturado_moneda || costo_total_moneda || null;
      }
    } else {
      // Si no manda margen, queda no forzado por default (a menos que mande margen_es_forzado explícito)
      // margen_es_forzado ya está en Boolean(req.body?.margen_es_forzado)
      if (margen_es_forzado) {
        // Si dice "forzado" pero no manda margen, dejamos null (es válido)
        margen_moneda = margen_moneda || total_facturado_moneda || costo_total_moneda || null;
      }
    }

    // Propuesta automática de margen (solo si NO viene forzado y ambas monedas coinciden)
    if (!margen_es_forzado && margen_estimado === null) {
      if (
        total_facturado !== null &&
        costo_total !== null &&
        total_facturado_moneda &&
        costo_total_moneda &&
        total_facturado_moneda === costo_total_moneda
      ) {
        const calc = Math.round((total_facturado - costo_total) * 10000) / 10000;
        margen_estimado = calc;
        margen_moneda = total_facturado_moneda;
        margen_es_forzado = false;
      }
    }

    // -----------------------------
    // 3) Validaciones referenciales
    // -----------------------------
    await client.query('BEGIN');

    // responsable válido
    const respResult = await client.query(
      `SELECT id FROM public.usuarios WHERE id = $1`,
      [responsable_id]
    );
    if (respResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Responsable inválido.' });
    }

    // sitio válido + cliente derivado del sitio
    const sitioResult = await client.query(
      `SELECT s.id, s.cliente
         FROM public.sitios s
        WHERE s.id = $1`,
      [sitio_id]
    );
    if (sitioResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sitio inválido.' });
    }

    const clienteFinalId = sitioResult.rows[0].cliente;
    if (!clienteFinalId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El sitio seleccionado no tiene cliente asignado.' });
    }

    // Validar monedas si vienen
    await validarMonedaSiExiste(client, total_facturado_moneda, 'total_facturado_moneda');
    await validarMonedaSiExiste(client, costo_total_moneda, 'costo_total_moneda');
    await validarMonedaSiExiste(client, margen_moneda, 'margen_moneda');

    // -----------------------------
    // 4) Insert Proyecto
    // -----------------------------
    const insertProyecto = await client.query(
      `
      INSERT INTO public.proyectos (
        nombre,
        descripcion,
        responsable_id,
        sitio_id,
        cliente_id,
        activo,
        status,
        total_facturado,
        total_facturado_moneda,
        costo_total,
        costo_total_moneda,
        margen_estimado,
        margen_moneda,
        margen_es_forzado,
        fecha_inicio,
        fecha_cierre
      )
      VALUES (
        $1,$2,$3,$4,$5,true,
        COALESCE($6, 'POR_APROBAR'::public.proyecto_status),
        $7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      RETURNING
        id,
        nombre,
        status,
        fecha_inicio,
        fecha_cierre,
        total_facturado,
        total_facturado_moneda,
        costo_total,
        costo_total_moneda,
        margen_estimado,
        margen_moneda,
        margen_es_forzado;
      `,
      [
        nombre,
        descripcion,
        responsable_id,
        sitio_id,
        clienteFinalId,
        status,
        total_facturado,
        total_facturado_moneda,
        costo_total,
        costo_total_moneda,
        margen_estimado,
        margen_moneda,
        margen_es_forzado,
        fecha_inicio,
        fecha_cierre,
      ]
    );

    const proyecto = insertProyecto.rows[0];

    // -----------------------------
    // 5) Insert Hitos (opcionales)
    // -----------------------------
    const hitosIn = pickHitosArray(req.body);

    if (hitosIn && hitosIn.length > 0) {
      if (!Array.isArray(hitosIn)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Formato inválido: hitos debe ser un arreglo.' });
      }

      const hitosInsertados = [];

      for (const h of hitosIn) {
        const nombreH = asTrimString(h?.nombre);
        const descripcionH = asTrimString(h?.descripcion);
        const targetDate = parseOptionalDateISO(h?.target_date, 'hitos.target_date');
        const fechaReal = parseOptionalDateISO(h?.fecha_realizacion, 'hitos.fecha_realizacion');

        // Si la fila viene vacía, la ignoramos
        const filaVacia =
          !nombreH && !descripcionH && !targetDate && !fechaReal;

        if (filaVacia) continue;

        if (!nombreH) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Cada hito requiere un nombre si se incluye en el arreglo.' });
        }

        const rH = await client.query(
          `
          INSERT INTO public.proyectos_hitos (
            proyecto_id, nombre, descripcion, target_date, fecha_realizacion
          )
          VALUES ($1,$2,$3,$4,$5)
          RETURNING id, proyecto_id, nombre, descripcion, target_date, fecha_realizacion;
          `,
          [proyecto.id, nombreH, descripcionH || null, targetDate, fechaReal]
        );

        hitosInsertados.push(rH.rows[0]);
      }

      await client.query('COMMIT');
      return res.status(201).json({
        mensaje: 'Proyecto creado correctamente.',
        proyecto,
        hitos: hitosInsertados,
      });
    }

    await client.query('COMMIT');
    return res.status(201).json({
      mensaje: 'Proyecto creado correctamente.',
      proyecto,
      hitos: [],
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    const statusCode = error?.statusCode || 500;
    console.error('Error al crear proyecto (G_PROJ):', error);

    return res.status(statusCode).json({
      error: error?.message || 'Error interno del servidor.',
    });
  } finally {
    client.release();
  }
};

const descargarProyectoPdf = async (req, res) => {
  const proyectoId = Number(req.params?.id);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
    return res.status(400).json({ error: 'Parametro de proyecto invalido.' });
  }

  const notify = shouldNotifyFlag(req.query?.notify);
  const client = await pool.connect();

  try {
    const data = await getProyectoDataForPdf(client, proyectoId);
    if (!data) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    const actorNombre = safeText(req.usuarioSira?.nombre || req.usuario?.nombre, 'Usuario SIRA');
    const actorCorreo = asTrimString(req.usuario?.correo_google);

    const pdfBuffer = await generateProjectAuthorizationPdf({
      proyecto: data.proyecto,
      hitos: data.hitos,
      generadoPor: { nombre: actorNombre, correo: actorCorreo || 'N/D' },
      generatedAt: new Date(),
    });

    const projectCode = formatProjectCode(data.proyecto.id);
    const fileBase = `${projectCode} - ${safeText(data.proyecto.sitio_nombre, 'SITIO')} - ${safeText(data.proyecto.nombre, 'PROYECTO')}`;
    const fileName = `${sanitizeFileName(fileBase)}.pdf`;

    if (notify) {
      const recipients = await getNotificationEmails('NOT_GEN_PROY', client);
      if (recipients.length > 0) {
        const subject = `Nuevo proyecto para autorizacion | ${projectCode} - ${safeText(data.proyecto.nombre, 'Proyecto')}`;
        const htmlBody = `
          <p>El usuario <b>${actorNombre}</b> ha generado un nuevo proyecto para autorizacion.</p>
          <ul>
            <li><b>Proyecto:</b> ${safeText(data.proyecto.nombre)}</li>
            <li><b>Codigo:</b> ${projectCode}</li>
            <li><b>Sitio:</b> ${safeText(data.proyecto.sitio_nombre)}</li>
            <li><b>Cliente:</b> ${safeText(data.proyecto.cliente_nombre)}</li>
            <li><b>Responsable:</b> ${safeText(data.proyecto.responsable_nombre)}</li>
            <li><b>Estado:</b> ${safeText(data.proyecto.status)}</li>
          </ul>
          <p>Se adjunta el PDF del proyecto para revision y autorizacion.</p>
        `;

        await sendEmailWithAttachments(recipients, subject, htmlBody, [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]);
      } else {
        console.warn(`[G_PROJ] Grupo NOT_GEN_PROY sin destinatarios activos para proyecto ${proyectoId}.`);
      }
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar/enviar PDF de proyecto:', error);
    return res.status(500).json({
      error: error?.message || 'Error interno al generar el PDF del proyecto.',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  crearProyecto,
  descargarProyectoPdf,
};
