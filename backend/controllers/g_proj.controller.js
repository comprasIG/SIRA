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

async function getUsuariosByIds(client, userIds = []) {
  const uniqueIds = [...new Set((userIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (uniqueIds.length === 0) return [];

  const q = await client.query(
    `
    SELECT id, nombre, COALESCE(correo_google, correo) AS correo
    FROM public.usuarios
    WHERE id = ANY($1::int[]);
    `,
    [uniqueIds]
  );

  const mapById = new Map(q.rows.map((r) => [Number(r.id), r]));
  return uniqueIds.map((id) => mapById.get(Number(id))).filter(Boolean);
}

function formatDateEsMx(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
}

function sendHitoAssignedEmails({ proyectoNombre, hitoNombre, descripcion, targetDate, responsables, asignador }) {
  if (!Array.isArray(responsables) || responsables.length === 0) return;

  const fechaStr = formatDateEsMx(targetDate);
  const descripcionHtml = descripcion
    ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;white-space:nowrap;">Descripción</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${descripcion}</td></tr>`
    : '';
  const fechaHtml = fechaStr
    ? `<tr><td style="padding:8px 12px;color:#6b7280;font-weight:600;white-space:nowrap;">Fecha objetivo</td><td style="padding:8px 12px;">${fechaStr}</td></tr>`
    : '';
  const subject = `Nuevo hito asignado: ${hitoNombre} — ${proyectoNombre}`;

  for (const r of responsables) {
    if (!r?.correo) continue;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;max-width:600px;">
        <p>Estimado/a <strong>${r.nombre}</strong>,</p>
        <p>Se le ha asignado un nuevo hito dentro del sistema <strong>SIRA</strong>.
           A continuación se detallan los datos correspondientes:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0;">
          <tr style="background:#f9fafb;">
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;white-space:nowrap;">Hito</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;">${hitoNombre}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;white-space:nowrap;">Proyecto</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${proyectoNombre}</td>
          </tr>
          ${descripcionHtml}
          ${fechaHtml}
          <tr style="background:#f9fafb;">
            <td style="padding:8px 12px;color:#6b7280;font-weight:600;white-space:nowrap;">Asignado por</td>
            <td style="padding:8px 12px;">${asignador}</td>
          </tr>
        </table>
        <p>Le solicitamos atender este hito conforme a los tiempos establecidos.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px;">
          Este es un correo automático generado por SIRA. Por favor, no responda directamente a este mensaje.
        </p>
      </div>
    `;

    sendEmailWithAttachments([r.correo], subject, htmlBody, []).catch((emailErr) => {
      console.error(`[G_PROJ] Error al enviar correo de hito a ${r.correo}:`, emailErr);
    });
  }
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
      ph.id,
      ph.proyecto_id,
      ph.nombre,
      ph.descripcion,
      ph.target_date,
      ph.fecha_realizacion,
      COALESCE(
        (SELECT STRING_AGG(u2.nombre, ', ' ORDER BY u2.nombre)
         FROM public.proyectos_hitos_responsables phr2
         JOIN public.usuarios u2 ON u2.id = phr2.usuario_id
         WHERE phr2.hito_id = ph.id),
        ''
      ) AS responsables_nombres
    FROM public.proyectos_hitos ph
    WHERE ph.proyecto_id = $1
    ORDER BY ph.target_date ASC NULLS LAST, ph.id ASC;
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

        // Soporta responsable_ids[] (nuevo) y responsable_id (legado)
        const responsableHIds = Array.isArray(h?.responsable_ids)
          ? h.responsable_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
          : (parseOptionalInt(h?.responsable_id) ? [parseOptionalInt(h.responsable_id)] : []);
        const responsablesData = await getUsuariosByIds(client, responsableHIds);

        if (new Set(responsableHIds).size !== responsablesData.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Uno o mas responsables del hito "${nombreH || '(sin nombre)'}" no existen.` });
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

        const hitoRow = rH.rows[0];

        for (const rId of responsableHIds) {
          await client.query(
            `INSERT INTO public.proyectos_hitos_responsables (hito_id, usuario_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [hitoRow.id, rId]
          );
        }

        hitosInsertados.push({ ...hitoRow, responsable_ids: responsableHIds });
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
    } catch (_) { }

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

const actualizarProyecto = async (req, res) => {
  const proyectoId = Number(req.params.id);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
    return res.status(400).json({ error: 'ID de proyecto invalido.' });
  }

  const client = await pool.connect();
  try {
    // -----------------------------
    // 1) Inputs base (requeridos para update)
    // -----------------------------
    // Nota: Permitimos actualización parcial de algunos campos, pero validamos integridad si vienen.
    // Para simplificar, asumimos que el frontend manda el objeto completo o los campos a cambiar.

    // Obtenemos el proyecto actual para comparar o rellenar si fuera necesario (opcional, aqui haremos update directo de lo que venga)

    // Validaciones basicas de formato si vienen los campos
    const nombre = req.body.nombre !== undefined ? asTrimString(req.body.nombre) : undefined;
    const descripcion = req.body.descripcion !== undefined ? asTrimString(req.body.descripcion) : undefined;

    if (nombre !== undefined && !nombre) {
      return res.status(400).json({ error: 'El nombre del proyecto no puede quedar vacio.' });
    }
    if (nombre !== undefined && nombre.length > 100) {
      return res.status(400).json({ error: 'El nombre del proyecto no puede exceder 100 caracteres.' });
    }
    if (descripcion !== undefined && !descripcion) {
      return res.status(400).json({ error: 'La descripción del proyecto no puede quedar vacia.' });
    }
    if (descripcion !== undefined && descripcion.length > 400) {
      return res.status(400).json({ error: 'La descripción del proyecto no puede exceder 400 caracteres.' });
    }

    // Fechas
    const fecha_inicio = req.body.fecha_inicio !== undefined ? parseOptionalDateISO(req.body.fecha_inicio, 'fecha_inicio') : undefined;
    const fecha_cierre = req.body.fecha_cierre !== undefined ? parseOptionalDateISO(req.body.fecha_cierre, 'fecha_cierre') : undefined;

    if (fecha_inicio && fecha_cierre && fecha_cierre < fecha_inicio) {
      return res.status(400).json({ error: 'La fecha de cierre no puede ser menor a la fecha de inicio.' });
    }

    // Finanzas
    const total_facturado = req.body.total_facturado !== undefined ? parseOptionalDecimalNonNeg(req.body.total_facturado, 'total_facturado') : undefined;
    const total_facturado_moneda = req.body.total_facturado_moneda !== undefined ? normalizeMonedaCode(req.body.total_facturado_moneda) : undefined;

    const costo_total = req.body.costo_total !== undefined ? parseOptionalDecimalNonNeg(req.body.costo_total, 'costo_total') : undefined;
    const costo_total_moneda = req.body.costo_total_moneda !== undefined ? normalizeMonedaCode(req.body.costo_total_moneda) : undefined;

    const margen_estimado = req.body.margen_estimado !== undefined ? parseOptionalDecimal(req.body.margen_estimado, 'margen_estimado') : undefined;
    const margen_moneda = req.body.margen_moneda !== undefined ? normalizeMonedaCode(req.body.margen_moneda) : undefined;
    const margen_es_forzado = req.body.margen_es_forzado !== undefined ? Boolean(req.body.margen_es_forzado) : undefined;

    // Status
    const statusRaw = req.body.status !== undefined ? asTrimString(req.body.status) : undefined;
    const status = statusRaw ? statusRaw.toUpperCase() : undefined;
    if (status && !ALLOWED_STATUS.has(status)) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${Array.from(ALLOWED_STATUS).join(', ')}`,
      });
    }

    // Responsable (si se cambia)
    const responsable_id = req.body.responsable_id !== undefined ? parseOptionalInt(req.body.responsable_id) : undefined;

    await client.query('BEGIN');

    // Validar Responsable si cambia
    if (responsable_id) {
      const respResult = await client.query(`SELECT id FROM public.usuarios WHERE id = $1`, [responsable_id]);
      if (respResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Responsable inválido.' });
      }
    }

    // -----------------------------
    // 2) Update Proyecto
    // -----------------------------
    // Construimos dinamicamente el query
    const updates = [];
    const params = [proyectoId];
    let idx = 2;

    if (nombre !== undefined) { updates.push(`nombre = $${idx++}`); params.push(nombre); }
    if (descripcion !== undefined) { updates.push(`descripcion = $${idx++}`); params.push(descripcion); }
    if (responsable_id !== undefined) { updates.push(`responsable_id = $${idx++}`); params.push(responsable_id); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }

    if (fecha_inicio !== undefined) { updates.push(`fecha_inicio = $${idx++}`); params.push(fecha_inicio); }
    if (fecha_cierre !== undefined) { updates.push(`fecha_cierre = $${idx++}`); params.push(fecha_cierre); }

    if (total_facturado !== undefined) { updates.push(`total_facturado = $${idx++}`); params.push(total_facturado); }
    if (total_facturado_moneda !== undefined) { updates.push(`total_facturado_moneda = $${idx++}`); params.push(total_facturado_moneda); }

    if (costo_total !== undefined) { updates.push(`costo_total = $${idx++}`); params.push(costo_total); }
    if (costo_total_moneda !== undefined) { updates.push(`costo_total_moneda = $${idx++}`); params.push(costo_total_moneda); }

    if (margen_estimado !== undefined) { updates.push(`margen_estimado = $${idx++}`); params.push(margen_estimado); }
    if (margen_moneda !== undefined) { updates.push(`margen_moneda = $${idx++}`); params.push(margen_moneda); }
    if (margen_es_forzado !== undefined) { updates.push(`margen_es_forzado = $${idx++}`); params.push(margen_es_forzado); }

    if (updates.length > 0) {
      await client.query(
        `UPDATE public.proyectos SET ${updates.join(', ')} WHERE id = $1`,
        params
      );
    }

    // -----------------------------
    // 3) Sync Hitos (Insert/Update/Delete)
    // -----------------------------
    // hitosIn puede ser undefined (no tocar hitos), [] (borrar todos los que no vengan), o array de objetos.
    // Si req.body.hitos no viene definido, asumimos NO TOCAR los hitos.
    // Si req.body.hitos viene [], significa que el usuario borró todos en el front.

    const nuevosHitosParaNotificar = [];

    if (req.body.hitos !== undefined) {
      const hitosIn = pickHitosArray(req.body);

      // Obtener hitos actuales
      const hitosActualesQ = await client.query(`SELECT id FROM public.proyectos_hitos WHERE proyecto_id = $1`, [proyectoId]);
      const hitosActualesIds = new Set(hitosActualesQ.rows.map(h => h.id));

      const hitosEntrantesIds = new Set();

      for (const h of hitosIn) {
        const nombreH = asTrimString(h.nombre);
        const descripcionH = asTrimString(h.descripcion);
        const targetDate = parseOptionalDateISO(h.target_date, 'hitos.target_date');
        const fechaReal = parseOptionalDateISO(h.fecha_realizacion, 'hitos.fecha_realizacion');
        const hId = parseOptionalInt(h.id); // Si trae ID es update, si no es insert

        // Soporta responsable_ids[] (nuevo) y responsable_id (legado)
        const responsableHIds = Array.isArray(h?.responsable_ids)
          ? h.responsable_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
          : (parseOptionalInt(h?.responsable_id) ? [parseOptionalInt(h.responsable_id)] : []);
        const responsablesData = await getUsuariosByIds(client, responsableHIds);

        if (new Set(responsableHIds).size !== responsablesData.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Uno o mas responsables del hito "${nombreH || '(sin nombre)'}" no existen.` });
        }

        // Si la fila viene vacía y sin ID, la ignoramos
        const filaVacia = !nombreH && !descripcionH && !targetDate && !fechaReal;
        if (filaVacia && !hId) continue;

        if (!nombreH) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Cada hito requiere un nombre.' });
        }

        if (hId) {
          // Update
          if (!hitosActualesIds.has(hId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Hito con ID ${hId} no pertenece al proyecto o no existe.` });
          }

          await client.query(
            `UPDATE public.proyectos_hitos
                 SET nombre = $1, descripcion = $2, target_date = $3, fecha_realizacion = $4
                 WHERE id = $5`,
            [nombreH, descripcionH || null, targetDate, fechaReal, hId]
          );

          // Sync responsables en tabla puente: reemplazar todos
          await client.query(
            `DELETE FROM public.proyectos_hitos_responsables WHERE hito_id = $1`,
            [hId]
          );
          for (const r of responsablesData) {
            await client.query(
              `INSERT INTO public.proyectos_hitos_responsables (hito_id, usuario_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [hId, r.id]
            );
          }

          hitosEntrantesIds.add(hId);
        } else {
          // Insert
          const newH = await client.query(
            `INSERT INTO public.proyectos_hitos (proyecto_id, nombre, descripcion, target_date, fecha_realizacion)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [proyectoId, nombreH, descripcionH || null, targetDate, fechaReal]
          );
          const newHitoId = newH.rows[0].id;

          for (const r of responsablesData) {
            await client.query(
              `INSERT INTO public.proyectos_hitos_responsables (hito_id, usuario_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [newHitoId, r.id]
            );
          }

          nuevosHitosParaNotificar.push({
            nombre: nombreH,
            descripcion: descripcionH || null,
            target_date: targetDate,
            responsables: responsablesData,
          });

          hitosEntrantesIds.add(newHitoId);
        }
      }

      // Delete: Los que estaban en BD pero no vinieron en la lista (y tenian ID)
      const aBorrar = [...hitosActualesIds].filter(id => !hitosEntrantesIds.has(id));
      if (aBorrar.length > 0) {
        await client.query(
          `DELETE FROM public.proyectos_hitos WHERE id = ANY($1::int[])`,
          [aBorrar]
        );
      }
    }

    await client.query('COMMIT');

    // Devolver proyecto actualizado
    const dataFinal = await getProyectoDataForPdf(client, proyectoId);

    if (nuevosHitosParaNotificar.length > 0) {
      const asignador = req.usuarioSira?.nombre || req.usuario?.nombre || 'Un usuario de SIRA';
      const proyectoNombreNoti = dataFinal?.proyecto?.nombre || nombre || `Proyecto ${proyectoId}`;

      for (const hito of nuevosHitosParaNotificar) {
        sendHitoAssignedEmails({
          proyectoNombre: proyectoNombreNoti,
          hitoNombre: hito.nombre,
          descripcion: hito.descripcion,
          targetDate: hito.target_date,
          responsables: hito.responsables,
          asignador,
        });
      }
    }

    return res.json({
      mensaje: 'Proyecto actualizado correctamente.',
      proyecto: dataFinal.proyecto,
      hitos: dataFinal.hitos
    });

  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    console.error('Error al actualizar proyecto (G_PROJ UPDATE):', error);
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      error: error?.message || 'Error interno al actualizar proyecto.'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  crearProyecto,
  actualizarProyecto,
  descargarProyectoPdf,
};
