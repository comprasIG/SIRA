// C:\SIRA\backend\controllers\oc-directa.controller.js
/**
 * =================================================================================================
 * CONTROLADOR: OC Directa (VB_OC)
 * =================================================================================================
 * Permite crear Órdenes de Compra directamente, sin pasar por el flujo de
 * Requisición → RFQ → Aprobación. Los materiales se seleccionan del catálogo,
 * se asignan proveedor y precio, y la OC se crea con status 'POR_AUTORIZAR'.
 *
 * Endpoints:
 * - GET  /api/oc-directa/datos-iniciales  → catálogos para el form
 * - POST /api/oc-directa/crear            → crear OC(s) directa(s)
 * =================================================================================================
 */

const pool = require('../db/pool');
const { generatePurchaseOrderPdf } = require('../services/purchaseOrderPdfService');
const { uploadOcPdfBuffer, downloadFileBuffer } = require('../services/googleDrive');
const { sendEmailWithAttachments } = require('../services/emailService');

/* ================================================================================================
 * Helpers: números / redondeo / strings
 * ==============================================================================================*/

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const round4 = (n) => Math.round((toNum(n) + Number.EPSILON) * 10000) / 10000;

const safeText = (v, fallback = 'N/D') => {
    const s = String(v ?? '').trim();
    return s.length ? s : fallback;
};

const formatOcForDisplay = (numeroOcRaw, padDigits = 4) => {
    const raw = String(numeroOcRaw ?? '').trim();
    const match = raw.match(/(\d+)/);
    if (!match) return raw || 'OC-S/N';
    const digits = match[1];
    const padded = digits.length >= padDigits ? digits : digits.padStart(padDigits, '0');
    return `OC-${padded}`;
};

const sanitizeFileName = (s) => {
    return String(s ?? '')
        .trim()
        .replace(/[\/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/\s-\s/g, ' - ')
        .trim();
};

const getProveedorNombre = (proveedorMarca, proveedorRazon) => {
    const razon = String(proveedorRazon ?? '').trim();
    if (razon) return razon;
    const marca = String(proveedorMarca ?? '').trim();
    return marca || 'PROVEEDOR';
};

/* ================================================================================================
 * Helpers: cálculo de totales (IVA/ISR) - reutiliza la misma lógica que vistoBueno
 * ==============================================================================================*/

const normalizeConfig = (raw) => {
    let cfg = raw;
    if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
    }
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    return {
        moneda: cfg.moneda || 'MXN',
        ivaRate: cfg.ivaRate != null ? toNum(cfg.ivaRate) : 0.16,
        isIvaActive: cfg.isIvaActive !== false,
        isrRate: cfg.isrRate != null ? toNum(cfg.isrRate) : 0,
        isIsrActive: cfg.isIsrActive === true,
        forcedTotal: cfg.forcedTotal != null ? toNum(cfg.forcedTotal) : 0,
        isForcedTotalActive: cfg.isForcedTotalActive === true,
    };
};

const getBaseUnitPrice = ({ precioUnitario, esPrecioNeto, ivaRate, ivaActive }) => {
    const pu = toNum(precioUnitario);
    if (!ivaActive || ivaRate <= 0) return pu;
    if (!esPrecioNeto) return pu;
    return pu / (1 + ivaRate);
};

const calcularTotalesOcDirecta = (items, configCalculo) => {
    if (!items || items.length === 0) {
        return { subTotal: 0, iva: 0, retIsr: 0, total: 0, ivaRate: 0, isrRate: 0, moneda: 'MXN', esImportacion: false };
    }

    const cfg = normalizeConfig(configCalculo);
    const esImportacion = items.some(i => i.es_importacion === true);

    const ivaActive = !esImportacion && cfg.isIvaActive && cfg.ivaRate > 0;
    const isrActive = !esImportacion && cfg.isIsrActive && cfg.isrRate > 0;

    let subTotal = 0;

    for (const it of items) {
        const qty = toNum(it.cantidad);
        if (qty <= 0) continue;

        const basePU = getBaseUnitPrice({
            precioUnitario: it.precio_unitario,
            esPrecioNeto: it.es_precio_neto === true,
            ivaRate: cfg.ivaRate,
            ivaActive
        });

        subTotal += qty * basePU;
    }

    subTotal = round4(subTotal);
    const iva = ivaActive ? round4(subTotal * cfg.ivaRate) : 0;
    const retIsr = isrActive ? round4(subTotal * cfg.isrRate) : 0;
    const total = cfg.isForcedTotalActive ? round4(cfg.forcedTotal) : round4(subTotal + iva - retIsr);

    return {
        subTotal,
        iva,
        retIsr,
        total,
        ivaRate: ivaActive ? cfg.ivaRate : 0,
        isrRate: isrActive ? cfg.isrRate : 0,
        moneda: cfg.moneda || 'MXN',
        esImportacion
    };
};

/* ================================================================================================
 * Helpers: Notificaciones (email)
 * ==============================================================================================*/

const _getRecipientEmailsByGroup = async (codigoGrupo, client) => {
    const query = `
    SELECT u.correo
    FROM usuarios u
    JOIN notificacion_grupo_usuarios ngu ON u.id = ngu.usuario_id
    JOIN notificacion_grupos ng ON ngu.grupo_id = ng.id
    WHERE ng.codigo = $1 AND u.activo = true;
  `;
    const result = await client.query(query, [codigoGrupo]);
    return result.rows.map(row => row.correo);
};

/* ================================================================================================
 * Endpoints
 * ==============================================================================================*/

/**
 * GET /api/oc-directa/datos-iniciales
 * Devuelve sitios y proyectos para los dropdowns del formulario VB_OC.
 */
const getDatosIniciales = async (req, res) => {
    try {
        const [sitiosResult, proyectosResult] = await Promise.all([
            pool.query(`SELECT id, nombre FROM sitios WHERE nombre != 'UNIDADES' ORDER BY nombre`),
            pool.query(`SELECT p.id, p.nombre, p.sitio_id FROM proyectos p JOIN sitios s ON p.sitio_id = s.id WHERE p.activo = true AND s.nombre != 'UNIDADES' ORDER BY p.nombre`)
        ]);

        res.json({
            sitios: sitiosResult.rows,
            proyectos: proyectosResult.rows,
        });
    } catch (error) {
        console.error("[OC-DIRECTA] Error al obtener datos iniciales:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

/**
 * POST /api/oc-directa/crear
 *
 * Payload esperado:
 * {
 *   sitio_id: number,
 *   proyecto_id: number,
 *   lugar_entrega: string|number,
 *   fecha_requerida: string (YYYY-MM-DD),
 *   comentario: string|null,
 *   es_urgente: boolean,
 *   comentarios_finanzas: string|null,
 *   items: [
 *     {
 *       material_id: number,
 *       cantidad: number,
 *       proveedor_id: number,
 *       precio_unitario: number,
 *       moneda: string,           // 'MXN' | 'USD'
 *       es_precio_neto: boolean,
 *       es_importacion: boolean,
 *       plazo_entrega: string|null,
 *     }
 *   ],
 *   config_por_proveedor: {
 *     [proveedor_id]: { moneda, ivaRate, isIvaActive, isrRate, isIsrActive, forcedTotal, isForcedTotalActive }
 *   }
 * }
 */
const crearOcDirecta = async (req, res) => {
    const { id: usuarioId } = req.usuarioSira;
    const {
        sitio_id,
        proyecto_id,
        lugar_entrega,
        fecha_requerida,
        comentario,
        es_urgente: esUrgenteRaw,
        comentarios_finanzas: comentariosRaw,
        items,
        config_por_proveedor: configPorProveedor = {},
        preferencias_por_proveedor: prefsPorProveedor = {}
    } = req.body;

    const esUrgente = Boolean(esUrgenteRaw);
    const comentariosFinanzas = typeof comentariosRaw === 'string' ? comentariosRaw.trim() : null;

    // Validaciones básicas
    if (!sitio_id || !proyecto_id || !lugar_entrega) {
        return res.status(400).json({ error: 'Sitio, proyecto y lugar de entrega son obligatorios.' });
    }
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Debe incluir al menos un material.' });
    }

    for (const item of items) {
        if (!item.material_id || !item.proveedor_id || !item.precio_unitario || !item.cantidad) {
            return res.status(400).json({ error: 'Cada material debe tener material_id, proveedor_id, precio_unitario y cantidad.' });
        }
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // =====================================================================
        // 0) Datos del usuario (departamento, etc.)
        // =====================================================================
        const userDeptQuery = await client.query(
            `SELECT u.departamento_id, d.codigo as depto_codigo
             FROM usuarios u
             JOIN departamentos d ON u.departamento_id = d.id
             WHERE u.id = $1 AND u.activo = true`,
            [usuarioId]
        );
        if (userDeptQuery.rowCount === 0) throw new Error('Usuario no autorizado o inactivo.');
        const { departamento_id, depto_codigo: deptoCodigo } = userDeptQuery.rows[0];

        // Resolver nombre de lugar de entrega para email
        const lugarEntregaNombreQuery = await client.query(
            `SELECT nombre FROM sitios WHERE id = $1`,
            [Number(lugar_entrega)]
        );
        const lugarEntregaNombre = lugarEntregaNombreQuery.rowCount > 0
            ? lugarEntregaNombreQuery.rows[0].nombre
            : null;

        // =====================================================================
        // 1) Crear REQUISICIÓN (el trigger genera numero_requisicion)
        // =====================================================================
        const reqInsert = await client.query(
            `INSERT INTO requisiciones
               (usuario_id, departamento_id, proyecto_id, sitio_id,
                fecha_requerida, lugar_entrega, comentario, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'ABIERTA')
             RETURNING id, numero_requisicion`,
            [
                usuarioId, departamento_id, proyecto_id, sitio_id,
                fecha_requerida || new Date().toISOString().slice(0, 10),
                lugar_entrega, comentario || null
            ]
        );
        const { id: requisicionId, numero_requisicion } = reqInsert.rows[0];

        // Simular aprobación VB_REQ: generar rfq_code y pasar a COTIZANDO
        const consecutivoResult = await client.query(
            "SELECT nextval('rfq_consecutivo_seq') as consecutivo"
        );
        const consecutivo = String(consecutivoResult.rows[0].consecutivo).padStart(4, '0');
        const numReqPart = numero_requisicion.split('_')[1] || '';
        const rfqCode = `${consecutivo}_R.${numReqPart}_${deptoCodigo}`;
        await client.query(
            `UPDATE requisiciones SET status = 'COTIZANDO', rfq_code = $1 WHERE id = $2`,
            [rfqCode, requisicionId]
        );

        // =====================================================================
        // 2) Crear REQUISICIONES_DETALLE (uno por material)
        // =====================================================================
        // Mapa material_id → requisicion_detalle_id
        const reqDetalleIdPorMaterial = {};
        for (const item of items) {
            const matId = Number(item.material_id);
            // Si ya insertamos un detalle para este material, reutilizar
            if (!reqDetalleIdPorMaterial[matId]) {
                const detInsert = await client.query(
                    `INSERT INTO requisiciones_detalle
                       (requisicion_id, material_id, cantidad, comentario, status_compra, cantidad_procesada)
                     VALUES ($1, $2, $3, $4, 'PROCESADO', $5)
                     RETURNING id`,
                    [requisicionId, matId, item.cantidad, null, item.cantidad]
                );
                reqDetalleIdPorMaterial[matId] = detInsert.rows[0].id;
            }
        }

        // =====================================================================
        // 3) Crear REQUISICIONES_OPCIONES (una por material+proveedor)
        // =====================================================================
        // Mapa "materialId_proveedorId" → opcion_id (comparativa_precio_id)
        const opcionIdMap = {};
        for (const item of items) {
            const matId = Number(item.material_id);
            const provIdNum = Number(item.proveedor_id);
            const key = `${matId}_${provIdNum}`;
            const reqDetId = reqDetalleIdPorMaterial[matId];
            const cfg = normalizeConfig(configPorProveedor[item.proveedor_id] || {});

            const optInsert = await client.query(
                `INSERT INTO requisiciones_opciones
                   (requisicion_id, requisicion_detalle_id, proveedor_id,
                    precio_unitario, cantidad_cotizada, moneda, seleccionado,
                    es_precio_neto, es_importacion, es_entrega_inmediata,
                    config_calculo)
                 VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
                 RETURNING id`,
                [
                    requisicionId, reqDetId, provIdNum,
                    item.precio_unitario, item.cantidad, item.moneda || cfg.moneda || 'MXN',
                    item.es_precio_neto === true,
                    item.es_importacion === true,
                    item.es_entrega_inmediata !== false,
                    JSON.stringify(cfg)
                ]
            );
            opcionIdMap[key] = optInsert.rows[0].id;
        }

        // =====================================================================
        // 4) Agrupar items por proveedor y crear OCs
        // =====================================================================
        const comprasPorProveedor = items.reduce((acc, item) => {
            (acc[item.proveedor_id] = acc[item.proveedor_id] || []).push(item);
            return acc;
        }, {});

        const ocsGeneradasInfo = [];

        for (const provId in comprasPorProveedor) {
            const provItems = comprasPorProveedor[provId];
            const provConfig = configPorProveedor[provId] || {};

            // Calcular totales financieros
            const tot = calcularTotalesOcDirecta(provItems, provConfig);

            // Generar nuevo ID de OC
            const seqResult = await client.query(`SELECT nextval('ordenes_compra_id_seq') AS id`);
            const nuevaOcId = seqResult.rows[0].id;
            const numeroOcDb = `OC-${nuevaOcId}`;
            const numeroOcDisplay = formatOcForDisplay(numeroOcDb);

            // Insertar OC (rfq_id = requisicionId para trazabilidad)
            await client.query(
                `INSERT INTO ordenes_compra
                   (id, numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega,
                    sub_total, iva, ret_isr, total, iva_rate, isr_rate,
                    impo, status, proveedor_id,
                    es_urgente, comentarios_finanzas)
                 VALUES
                   ($1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13,
                    $14, 'POR_AUTORIZAR', $15,
                    $16, $17)`,
                [
                    nuevaOcId,
                    numeroOcDb,
                    usuarioId,
                    requisicionId,           // FK → requisiciones.id
                    sitio_id,
                    proyecto_id,
                    lugar_entrega,
                    tot.subTotal,
                    tot.iva,
                    tot.retIsr,
                    tot.total,
                    tot.ivaRate,
                    tot.isrRate,
                    tot.esImportacion,
                    provId,
                    esUrgente,
                    comentariosFinanzas
                ]
            );

            // Registrar creación en historial
            await client.query(
                `INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
                 VALUES ($1, $2, 'CREACIÓN_OC', $3)`,
                [nuevaOcId, usuarioId, JSON.stringify({
                    origen: 'VB_OC',
                    numero_oc: numeroOcDb,
                    proveedor_id: provId,
                    total: tot.total,
                    impo: tot.esImportacion
                })]
            );

            // Guardar preferencias IMPO si aplica
            if (tot.esImportacion && prefsPorProveedor[provId]) {
                const prefs = prefsPorProveedor[provId];
                await client.query(
                    `INSERT INTO oc_preferencias_importacion
                       (orden_compra_id, imprimir_proyecto, sitio_entrega_id, imprimir_direccion_entrega, incoterm_id)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (orden_compra_id) DO NOTHING`,
                    [
                        nuevaOcId,
                        prefs.imprimir_proyecto !== false,
                        prefs.sitio_entrega_id || null,
                        prefs.imprimir_direccion_entrega !== false,
                        prefs.incoterm_id || null,
                    ]
                );
            }

            // Insertar detalle de cada línea (con los IDs reales)
            for (const item of provItems) {
                const cfg = normalizeConfig(provConfig);
                const esImportacion = item.es_importacion === true;
                const ivaActive = !esImportacion && cfg.isIvaActive && cfg.ivaRate > 0;

                const basePU = getBaseUnitPrice({
                    precioUnitario: item.precio_unitario,
                    esPrecioNeto: item.es_precio_neto === true,
                    ivaRate: cfg.ivaRate,
                    ivaActive
                });

                const matId = Number(item.material_id);
                const provIdNum = Number(item.proveedor_id);
                const reqDetId = reqDetalleIdPorMaterial[matId];
                const comparativaPrecioId = opcionIdMap[`${matId}_${provIdNum}`];

                await client.query(
                    `INSERT INTO ordenes_compra_detalle
                       (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id,
                        cantidad, precio_unitario, moneda, plazo_entrega)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        nuevaOcId,
                        reqDetId,               // FK → requisiciones_detalle.id
                        comparativaPrecioId,     // FK → requisiciones_opciones.id
                        matId,
                        item.cantidad,
                        round4(basePU),
                        item.moneda || tot.moneda,
                        item.plazo_entrega || null
                    ]
                );
            }

            // ========= Generar PDF =========
            const proveedorQuery = await client.query(
                `SELECT razon_social, marca, rfc, correo FROM proveedores WHERE id = $1`,
                [provId]
            );
            const provData = proveedorQuery.rows[0] || {};

            const ocDataQuery = await client.query(
                `SELECT
                    oc.*,
                    p.razon_social AS proveedor_razon_social,
                    p.marca        AS proveedor_marca,
                    p.rfc          AS proveedor_rfc,
                    proy.nombre    AS proyecto_nombre,
                    s.nombre       AS sitio_nombre,
                    s_entrega.nombre AS lugar_entrega_nombre,
                    u.nombre       AS usuario_nombre,
                    u.correo       AS usuario_correo,
                    (SELECT moneda FROM ordenes_compra_detalle WHERE orden_compra_id = oc.id LIMIT 1) AS moneda,
                    NOW() AS fecha_aprobacion,
                    opref.imprimir_proyecto          AS prefs_imprimir_proyecto,
                    opref.imprimir_direccion_entrega AS prefs_imprimir_direccion_entrega,
                    ci.abreviatura                   AS prefs_incoterm_abreviatura,
                    s_prefs.ubicacion                AS prefs_sitio_entrega_ubicacion
                 FROM ordenes_compra oc
                 JOIN proveedores p ON oc.proveedor_id = p.id
                 JOIN proyectos proy ON oc.proyecto_id = proy.id
                 JOIN sitios s ON oc.sitio_id = s.id
                 LEFT JOIN sitios s_entrega ON s_entrega.id = oc.lugar_entrega::int
                 JOIN usuarios u ON oc.usuario_id = u.id
                 LEFT JOIN oc_preferencias_importacion opref ON opref.orden_compra_id = oc.id
                 LEFT JOIN catalogo_incoterms ci ON ci.id = opref.incoterm_id
                 LEFT JOIN sitios s_prefs ON s_prefs.id = opref.sitio_entrega_id
                 WHERE oc.id = $1;`,
                [nuevaOcId]
            );

            const ocDataParaPdf = ocDataQuery.rows[0];
            ocDataParaPdf.rfq_code = rfqCode;

            const itemsDataQuery = await client.query(
                `SELECT ocd.*,
                        cm.nombre AS material_nombre,
                        cm.sku    AS sku,
                        cu.simbolo AS unidad_simbolo
                 FROM ordenes_compra_detalle ocd
                 JOIN catalogo_materiales cm ON ocd.material_id = cm.id
                 JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
                 WHERE ocd.orden_compra_id = $1;`,
                [nuevaOcId]
            );

            const pdfItems = itemsDataQuery.rows;
            const pdfBuffer = await generatePurchaseOrderPdf(ocDataParaPdf, pdfItems, client);

            // ========= Subject / filename =========
            const proveedorNombre = getProveedorNombre(provData.marca, provData.razon_social);
            const sitioNombre = safeText(ocDataParaPdf.sitio_nombre, '');
            const proyectoNombre = safeText(ocDataParaPdf.proyecto_nombre, '');

            const subject = esUrgente
                ? `${numeroOcDisplay} - URGENTE - ${sitioNombre} - ${proyectoNombre} - ${proveedorNombre}`
                : `${numeroOcDisplay} - ${sitioNombre} - ${proyectoNombre} - ${proveedorNombre}`;

            const pdfFileName = `${sanitizeFileName(subject)}.pdf`;

            // Subir PDF a Drive
            const driveFile = await uploadOcPdfBuffer(
                pdfBuffer,
                pdfFileName,
                deptoCodigo,
                numero_requisicion,
                numeroOcDb
            );

            if (!driveFile || !driveFile.webViewLink) {
                throw new Error('Falló la subida del archivo PDF a Google Drive.');
            }

            // ========= Email =========
            const attachments = [{ filename: pdfFileName, content: pdfBuffer }];
            const recipients = await _getRecipientEmailsByGroup('OC_GENERADA_NOTIFICAR', client);

            if (recipients.length > 0) {
                const notesHtml = comentariosFinanzas
                    ? `<p><b>Notas de finanzas:</b><br/>${comentariosFinanzas.replace(/\n/g, '<br/>')}</p>`
                    : '';

                const urgentHtml = esUrgente
                    ? `<p style="color:#C62828;font-weight:bold;font-size:14px;">URGENTE</p>`
                    : '';

                const htmlBody = `
                    ${urgentHtml}
                    <p>Se generó una Orden de Compra directa y requiere autorización final.</p>
                    <p>
                      <b>OC:</b> ${numeroOcDisplay}<br/>
                      <b>Requisición:</b> ${numero_requisicion}<br/>
                      <b>Proveedor:</b> ${proveedorNombre}<br/>
                      <b>Sitio:</b> ${sitioNombre}<br/>
                      <b>Proyecto:</b> ${proyectoNombre}<br/>
                      <b>Tipo:</b> OC Directa<br/>
                      <b>Lugar de entrega:</b> ${safeText(lugarEntregaNombre, safeText(lugar_entrega, 'N/D'))}
                    </p>
                    ${notesHtml}
                    <p>Link a Drive: <a href="${driveFile.webViewLink}">Ver Archivo</a></p>
                    <p>Se adjunta la Orden de Compra.</p>
                `;

                await sendEmailWithAttachments(recipients, subject, htmlBody, attachments);
            }

            ocsGeneradasInfo.push({ numero_oc: numeroOcDb, id: nuevaOcId });
        }

        // Cerrar el ciclo: la REQ queda en ESPERANDO_ENTREGA (simula VB_RFQ aprobando OCs)
        await client.query(
            `UPDATE requisiciones SET status = 'ESPERANDO_ENTREGA' WHERE id = $1`,
            [requisicionId]
        );

        await client.query('COMMIT');

        res.status(200).json({
            mensaje: `OC(s) creada(s): ${ocsGeneradasInfo.map(oc => oc.numero_oc).join(', ')}. Requisición: ${numero_requisicion}`,
            ocs: ocsGeneradasInfo,
            numero_requisicion
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[OC-DIRECTA] Error al crear OC directa:`, error);
        res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

module.exports = {
    getDatosIniciales,
    crearOcDirecta,
};
