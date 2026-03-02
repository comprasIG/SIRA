// backend/controllers/finanzas/gasolina.controller.js
/**
 * CRUD de cargas y pagos de gasolina.
 *
 * Tablas involucradas:
 *   - public.fin_gasolina_cargas  (cada carga de gasolina por unidad)
 *   - public.fin_gasolina_pagos   (depósito que cubre N cargas)
 *   - public.unidades_historial   (bitácora de la unidad)
 *
 * Invariantes:
 *   - El trigger trg_fin_gasolina_cargas_set_derived mantiene
 *     tipo_combustible, pagado y fuente_pago_id en fin_gasolina_cargas.
 *   - crearCarga escribe en AMBAS tablas dentro de una transacción.
 */

const path = require('path');
const pool = require('../../db/pool');
const { uploadGasolinaReceipt } = require('../../services/googleDrive');

// ---------------------------------------------------------------------------
// GET /api/finanzas/gasolina/cargas
// Parámetros query opcionales:
//   pagado=true|false   filtro por estado de pago
//   unidad_id           filtro por unidad
//   fecha_desde         ISO date string
//   fecha_hasta         ISO date string
// ---------------------------------------------------------------------------
const listarCargas = async (req, res) => {
  const { pagado, unidad_id, fecha_desde, fecha_hasta } = req.query;

  try {
    const params = [];
    let where = 'WHERE 1 = 1';

    if (pagado !== undefined && pagado !== '') {
      params.push(pagado === 'true' || pagado === true);
      where += ` AND c.pagado = $${params.length}`;
    }

    if (unidad_id) {
      params.push(parseInt(unidad_id, 10));
      where += ` AND c.unidad_id = $${params.length}`;
    }

    if (fecha_desde) {
      params.push(fecha_desde);
      where += ` AND c.fecha_carga >= $${params.length}::date`;
    }

    if (fecha_hasta) {
      params.push(fecha_hasta);
      where += ` AND c.fecha_carga < ($${params.length}::date + interval '1 day')`;
    }

    const query = `
      SELECT
        c.id,
        c.fecha_carga,
        c.kilometraje,
        c.costo_total_mxn,
        c.tipo_combustible,
        c.pagado,
        c.pago_id,
        c.creado_en,
        u.id          AS unidad_id,
        u.unidad      AS unidad_nombre,
        u.no_eco,
        s.id          AS sitio_destino_id,
        s.nombre      AS sitio_destino_nombre,
        p.id          AS proyecto_destino_id,
        p.nombre      AS proyecto_destino_nombre,
        usr.id        AS usuario_id,
        usr.nombre    AS usuario_nombre,
        fp.id         AS fuente_pago_id,
        fp.nombre     AS fuente_pago_nombre
      FROM public.fin_gasolina_cargas c
      JOIN  public.unidades            u   ON u.id = c.unidad_id
      LEFT JOIN public.sitios          s   ON s.id = c.sitio_destino_id
      LEFT JOIN public.proyectos       p   ON p.id = c.proyecto_destino_id
      LEFT JOIN public.usuarios        usr ON usr.id = c.usuario_id
      LEFT JOIN public.catalogo_fuentes_pago fp ON fp.id = c.fuente_pago_id
      ${where}
      ORDER BY c.fecha_carga DESC, c.id DESC
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error al listar cargas de gasolina:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/finanzas/gasolina/cargas
// Body: { unidad_id, kilometraje, costo_total_mxn, sitio_destino_id?,
//         proyecto_destino_id?, descripcion? }
// Crea registro en fin_gasolina_cargas Y en unidades_historial (COMBUSTIBLE).
// ---------------------------------------------------------------------------
const crearCarga = async (req, res) => {
  const { id: usuarioId } = req.usuarioSira;
  const {
    unidad_id,
    kilometraje,
    costo_total_mxn,
    sitio_destino_id,
    proyecto_destino_id,
    descripcion,
  } = req.body;

  if (!unidad_id || !kilometraje || !costo_total_mxn) {
    return res.status(400).json({
      error: 'unidad_id, kilometraje y costo_total_mxn son obligatorios.',
    });
  }

  const kmNum   = parseInt(kilometraje, 10);
  const costoNum = parseFloat(costo_total_mxn);

  if (isNaN(kmNum) || kmNum < 0) {
    return res.status(400).json({ error: 'kilometraje debe ser un entero >= 0.' });
  }
  if (isNaN(costoNum) || costoNum <= 0) {
    return res.status(400).json({ error: 'costo_total_mxn debe ser un número > 0.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Validar km actual de la unidad
    const kmRes = await client.query(
      'SELECT km FROM public.unidades WHERE id = $1 FOR UPDATE',
      [unidad_id]
    );
    if (kmRes.rowCount === 0) {
      throw new Error(`Unidad con id ${unidad_id} no encontrada.`);
    }
    const kmActual = kmRes.rows[0].km || 0;
    if (kmNum < kmActual) {
      throw new Error(
        `El kilometraje (${kmNum}) no puede ser menor al último registrado (${kmActual} km).`
      );
    }

    // 2) Obtener ID del tipo de evento COMBUSTIBLE
    const tipoRes = await client.query(
      `SELECT id FROM public.unidades_evento_tipos
       WHERE codigo = 'COMBUSTIBLE' AND activo = true
       LIMIT 1`
    );
    if (tipoRes.rowCount === 0) {
      throw new Error('No existe un tipo de evento activo con código COMBUSTIBLE.');
    }
    const eventoTipoId = tipoRes.rows[0].id;

    // 3) INSERT en fin_gasolina_cargas
    //    El trigger trg_fin_gasolina_cargas_set_derived pondrá tipo_combustible
    const cargaRes = await client.query(
      `INSERT INTO public.fin_gasolina_cargas
         (unidad_id, kilometraje, costo_total_mxn, sitio_destino_id, proyecto_destino_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, fecha_carga, tipo_combustible, pagado`,
      [
        unidad_id,
        kmNum,
        costoNum,
        sitio_destino_id || null,
        proyecto_destino_id || null,
        usuarioId,
      ]
    );
    const carga = cargaRes.rows[0];

    // 4) INSERT en unidades_historial (bitácora)
    const histDesc = descripcion?.trim() ||
      `Carga de gasolina — $${costoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

    const histRes = await client.query(
      `INSERT INTO public.unidades_historial
         (unidad_id, fecha, kilometraje, evento_tipo_id, descripcion, costo_total, usuario_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)
       RETURNING id`,
      [unidad_id, kmNum, eventoTipoId, histDesc, costoNum, usuarioId]
    );
    const historialId = histRes.rows[0].id;

    // 5) Actualizar km en la unidad
    await client.query(
      'UPDATE public.unidades SET km = $1 WHERE id = $2',
      [kmNum, unidad_id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      mensaje: 'Carga de gasolina registrada correctamente.',
      carga: { ...carga, id: carga.id },
      historial_id: historialId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear carga de gasolina:', err);
    res.status(400).json({ error: err.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// GET /api/finanzas/gasolina/pagos
// Lista todos los depósitos de pago con conteo de cargas asociadas.
// ---------------------------------------------------------------------------
const listarPagos = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.fecha_pago,
        p.total_mxn,
        p.comprobante_link,
        p.comentario,
        p.creado_en,
        fp.id     AS fuente_pago_id,
        fp.nombre AS fuente_pago_nombre,
        fp.tipo   AS fuente_pago_tipo,
        usr.id    AS usuario_id,
        usr.nombre AS usuario_nombre,
        (
          SELECT COUNT(*) FROM public.fin_gasolina_cargas c
          WHERE c.pago_id = p.id
        ) AS cargas_count
      FROM public.fin_gasolina_pagos p
      JOIN  public.catalogo_fuentes_pago fp ON fp.id = p.fuente_pago_id
      LEFT JOIN public.usuarios          usr ON usr.id = p.usuario_id
      ORDER BY p.fecha_pago DESC, p.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al listar pagos de gasolina:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/finanzas/gasolina/pagos
// Recibe multipart/form-data con campos:
//   fuente_pago_id  (número)
//   carga_ids       (JSON array string, e.g. "[1,2,3]")
//   fecha_pago      (ISO date, opcional)
//   comentario      (texto, opcional)
//   comprobante     (archivo opcional; obligatorio si fuente != EFECTIVO)
// Crea el depósito en Drive (si hay archivo) y marca las cargas como pagadas.
// ---------------------------------------------------------------------------
const crearPago = async (req, res) => {
  const { id: usuarioId } = req.usuarioSira;

  // Campos del body (llegan como strings en multipart)
  const fuente_pago_id = Number(req.body?.fuente_pago_id);
  const fecha_pago     = req.body?.fecha_pago   || null;
  const comentario     = req.body?.comentario   || null;
  const archivo        = req.file;              // multer → undefined si no viene

  // carga_ids puede venir como JSON string o como array repetido
  let carga_ids_raw = req.body?.carga_ids;
  let idsNumericos;
  try {
    const parsed = typeof carga_ids_raw === 'string'
      ? JSON.parse(carga_ids_raw)
      : carga_ids_raw;
    idsNumericos = (Array.isArray(parsed) ? parsed : [parsed]).map(id => parseInt(id, 10));
  } catch {
    return res.status(400).json({ error: 'carga_ids inválido (debe ser un JSON array).' });
  }

  if (!Number.isInteger(fuente_pago_id) || fuente_pago_id <= 0) {
    return res.status(400).json({ error: 'fuente_pago_id es obligatorio y debe ser numérico.' });
  }
  if (!idsNumericos.length || idsNumericos.some(isNaN)) {
    return res.status(400).json({ error: 'carga_ids debe tener al menos un id numérico.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Verificar fuente de pago y si es EFECTIVO (comprobante opcional)
    const fuenteQ = await client.query(
      `SELECT id, tipo FROM public.catalogo_fuentes_pago WHERE id = $1`,
      [fuente_pago_id]
    );
    if (fuenteQ.rowCount === 0) {
      return res.status(400).json({ error: 'fuente_pago_id no existe en el catálogo.' });
    }
    const esEfectivo = (fuenteQ.rows[0].tipo || '').toUpperCase() === 'EFECTIVO';

    if (!archivo && !esEfectivo) {
      return res.status(400).json({ error: 'El comprobante de pago es obligatorio para esta fuente.' });
    }

    // 2) Verificar que las cargas existen y están pendientes
    const verificar = await client.query(
      `SELECT id, costo_total_mxn, pagado
       FROM public.fin_gasolina_cargas
       WHERE id = ANY($1::int[])
       FOR UPDATE`,
      [idsNumericos]
    );

    if (verificar.rowCount !== idsNumericos.length) {
      throw new Error('Una o más cargas no existen.');
    }

    const yaPagadas = verificar.rows.filter(r => r.pagado);
    if (yaPagadas.length > 0) {
      throw new Error(
        `Las siguientes cargas ya están pagadas: ${yaPagadas.map(r => r.id).join(', ')}`
      );
    }

    // 3) Calcular total
    const totalMxn = verificar.rows.reduce(
      (sum, r) => sum + parseFloat(r.costo_total_mxn),
      0
    );

    // 4) Subir comprobante a Drive (si hay archivo)
    let comprobanteLink = null;
    if (archivo) {
      const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const extFromName = path.extname(archivo.originalname || '');
      const guessedPdf = (archivo.mimetype || '').includes('pdf');
      const ext = extFromName || (guessedPdf ? '.pdf' : '');
      const safeMonto = totalMxn.toFixed(2).replace('.', '_');
      const fileName = `COMPROBANTE_GASOLINA_${ts}_${safeMonto}${ext}`;

      const driveFile = await uploadGasolinaReceipt(archivo, fileName);
      if (!driveFile?.webViewLink) {
        throw new Error('Falló la subida del comprobante a Drive.');
      }
      comprobanteLink = driveFile.webViewLink;
    }

    // 5) INSERT en fin_gasolina_pagos
    const pagoRes = await client.query(
      `INSERT INTO public.fin_gasolina_pagos
         (fecha_pago, fuente_pago_id, usuario_id, total_mxn, comprobante_link, comentario)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, fecha_pago, total_mxn`,
      [
        fecha_pago || new Date().toISOString(),
        fuente_pago_id,
        usuarioId,
        totalMxn,
        comprobanteLink,
        comentario || null,
      ]
    );
    const pago = pagoRes.rows[0];

    // 6) Asignar pago_id a las cargas
    //    El trigger trg_fin_gasolina_cargas_set_derived marcará pagado=true y copiará fuente_pago_id
    await client.query(
      `UPDATE public.fin_gasolina_cargas
       SET pago_id = $1
       WHERE id = ANY($2::int[])`,
      [pago.id, idsNumericos]
    );

    await client.query('COMMIT');
    res.status(201).json({
      mensaje: `Pago registrado: ${idsNumericos.length} carga(s) — $${totalMxn.toFixed(2)} MXN.`,
      pago,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al registrar pago de gasolina:', err);
    res.status(400).json({ error: err.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

module.exports = { listarCargas, crearCarga, listarPagos, crearPago };
