// backend/controllers/inventario.controller.js
const pool = require('../db/pool');

/**
 * GET /api/inventario/datos-iniciales
 * Fetches data for KPIs (grouped by currency) and Filter options.
 */
const getDatosIniciales = async (req, res) => {
  try {
    // --- KPI Queries ---
    const kpiSkuQuery = `
            SELECT COUNT(DISTINCT material_id) AS kpi_skus
            FROM inventario_actual
            WHERE existencia_total > 0;
        `;
    const valorDisponibleQuery = `
            SELECT
                moneda,
                COALESCE(SUM(stock_actual * ultimo_precio_entrada), 0) AS valor_total
            FROM inventario_actual
            WHERE stock_actual > 0 AND ultimo_precio_entrada > 0 AND moneda IS NOT NULL
            GROUP BY moneda;
        `;
    const valorApartadoQuery = `
            SELECT
                moneda,
                COALESCE(SUM(cantidad * valor_unitario), 0) AS valor_total
            FROM inventario_asignado
            WHERE cantidad > 0 AND valor_unitario > 0 AND moneda IS NOT NULL
            GROUP BY moneda;
        `;

    // --- Filter Option Queries ---
    const sitiosQuery = `
            SELECT DISTINCT s.id, s.nombre FROM sitios s
            JOIN inventario_actual ia ON s.id = ia.ubicacion_id
            WHERE ia.existencia_total > 0
            UNION
            SELECT DISTINCT s.id, s.nombre FROM sitios s
            JOIN inventario_asignado ias ON s.id = ias.sitio_id
            WHERE ias.cantidad > 0
            ORDER BY nombre ASC;
        `;
    const proyectosQuery = `
            SELECT DISTINCT p.id, p.nombre, p.sitio_id FROM proyectos p
            JOIN inventario_asignado ias ON p.id = ias.proyecto_id
            WHERE ias.cantidad > 0
            ORDER BY nombre ASC;
        `;
    const todosProyectosQuery = `SELECT id, nombre, sitio_id FROM proyectos ORDER BY nombre ASC`;
    const todosSitiosQuery = `SELECT id, nombre FROM sitios ORDER BY nombre ASC`;

    // --- CORRECCIÓN AQUÍ ---
    // Se corrigió pool.query(sitiosRes.rows) a pool.query(sitiosQuery)
    // y pool.query(proyectosRes.rows) a pool.query(proyectosQuery)
    const [
      kpiSkuRes,
      valorDisponibleRes,
      valorApartadoRes,
      sitiosRes,
      proyectosRes,
      todosProyectosRes,
      todosSitiosRes
    ] = await Promise.all([
      pool.query(kpiSkuQuery),
      pool.query(valorDisponibleQuery),
      pool.query(valorApartadoQuery),
      pool.query(sitiosQuery),       // <-- CORREGIDO
      pool.query(proyectosQuery),      // <-- CORREGIDO
      pool.query(todosProyectosQuery),
      pool.query(todosSitiosQuery)
    ]);

    // Combinar resultados de KPIs
    const kpisResult = {
      kpi_skus: parseInt(kpiSkuRes.rows[0]?.kpi_skus || 0, 10),
      valores_disponibles: valorDisponibleRes.rows.map(r => ({ ...r, valor_total: parseFloat(r.valor_total).toFixed(2) })),
      valores_apartados: valorApartadoRes.rows.map(r => ({ ...r, valor_total: parseFloat(r.valor_total).toFixed(2) }))
    };

    res.json({
      kpis: kpisResult,
      filterOptions: {
        sitios: sitiosRes.rows,
        proyectos: proyectosRes.rows,
        todosSitios: todosSitiosRes.rows,
        todosProyectos: todosProyectosRes.rows
      }
    });

  } catch (error) {
    console.error('Error fetching initial data for /INV:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
};


/**
 * GET /api/inventario
 * Obtiene la lista principal de inventario con filtros aplicados.
 */
const getInventarioActual = async (req, res) => {
  const { estado, sitioId, proyectoId, search } = req.query;

  let params = [];
  let paramIndex = 1;
  // Agrupamos por material_id para tener una fila por material
  let queryBase = `
        SELECT
            ia.material_id,
            m.sku,
            m.nombre AS material_nombre,
            u.simbolo AS unidad_simbolo,
            SUM(ia.stock_actual) AS total_stock,
            SUM(ia.asignado) AS total_asignado,
            SUM(ia.existencia_total) AS total_existencia
        FROM inventario_actual ia
        JOIN catalogo_materiales m ON ia.material_id = m.id
        JOIN catalogo_unidades u ON m.unidad_de_compra = u.id
    `;
  let whereClauses = ["ia.existencia_total >= 0"];
  let havingClauses = [];

  // --- Filtro de Búsqueda ---
  if (search) {
    const searchWords = search.split(' ').filter(word => word.length > 0);
    searchWords.forEach(word => {
      whereClauses.push(`unaccent(m.nombre) ILIKE unaccent($${paramIndex++})`);
      params.push(`%${word}%`);
    });
  }

  // --- Filtros de Sitio/Proyecto (afectan con JOIN) ---
  // Se aplican solo si el estado es 'TODOS' o 'APARTADO'
  if ((estado === 'TODOS' || estado === 'APARTADO') && (sitioId || proyectoId)) {
    // Usamos un Sub-SELECT en WHERE para filtrar los material_id
    // que pertenecen a asignaciones con ese sitio/proyecto
    whereClauses.push(`
            ia.material_id IN (
                SELECT DISTINCT ia_inner.material_id
                FROM inventario_asignado ias
                JOIN inventario_actual ia_inner ON ias.inventario_id = ia_inner.id
                WHERE ias.cantidad > 0
                ${sitioId ? ` AND ias.sitio_id = $${paramIndex++}` : ''}
                ${proyectoId ? ` AND ias.proyecto_id = $${paramIndex++}` : ''}
            )
        `);
    if (sitioId) params.push(sitioId);
    if (proyectoId) params.push(proyectoId);
  }

  // --- Construir Query Final ---
  if (whereClauses.length > 0) {
    queryBase += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // Agrupación principal por material
  queryBase += ` GROUP BY ia.material_id, m.sku, m.nombre, u.simbolo`;

  // --- Filtro de Estado (afecta HAVING) ---
  if (estado === 'DISPONIBLE') {
    havingClauses.push(`SUM(ia.stock_actual) > 0`);
  } else if (estado === 'APARTADO') {
    havingClauses.push(`SUM(ia.asignado) > 0`);
  }

  if (havingClauses.length > 0) {
    queryBase += ` HAVING ${havingClauses.join(' AND ')}`;
  }

  queryBase += ` ORDER BY m.nombre ASC`;

  try {
    const { rows } = await pool.query(queryBase, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching inventory list:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
};

/**
 * GET /api/inventario/material/:materialId/asignaciones
 * Obtiene el detalle de a qué proyectos/sitios está asignado un material.
 */
const getDetalleAsignacionesMaterial = async (req, res) => {
  const { materialId } = req.params;
  try {
    const query = `
            SELECT
                ias.id AS asignacion_id,
                p.nombre AS proyecto_nombre,
                s.nombre AS sitio_nombre,
                ias.cantidad,
                ias.valor_unitario,
                ias.moneda
            FROM inventario_asignado ias
            JOIN proyectos p ON ias.proyecto_id = p.id
            JOIN sitios s ON ias.sitio_id = s.id
            JOIN inventario_actual ia ON ias.inventario_id = ia.id
            WHERE ia.material_id = $1 AND ias.cantidad > 0
            ORDER BY p.nombre, s.nombre;
        `;
    const { rows } = await pool.query(query, [materialId]);
    res.json(rows);
  } catch (error) {
    console.error(`Error fetching assignments for material ${materialId}:`, error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
};


const getKardex = async (req, res) => {

  try {
    const {
      materialId,
      proyectoId, // aplica a origen o destino
      ubicacionId,
      tipoMovimiento,
      ordenCompraId,
      requisicionId,
      usuarioId,
      fechaInicio, // YYYY-MM-DD
      fechaFin,    // YYYY-MM-DD
      includeAnulados = 'false',
      limit = '100',
      offset = '0',
      q, // búsqueda libre en observaciones (opcional)
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    const where = [];
    const values = [];
    let i = 1;

    // Anulados
    if (includeAnulados !== 'true') {
      where.push(`mi.estado = 'ACTIVO'`);
    }

    if (materialId) {
      where.push(`mi.material_id = $${i++}`);
      values.push(materialId);
    }

    if (proyectoId) {
      where.push(`(mi.proyecto_origen_id = $${i} OR mi.proyecto_destino_id = $${i})`);
      values.push(proyectoId);
      i++;
    }

    if (ubicacionId) {
      where.push(`mi.ubicacion_id = $${i++}`);
      values.push(ubicacionId);
    }

    if (tipoMovimiento) {
      where.push(`mi.tipo_movimiento = $${i++}`);
      values.push(tipoMovimiento);
    }

    if (ordenCompraId) {
      where.push(`mi.orden_compra_id = $${i++}`);
      values.push(ordenCompraId);
    }

    if (requisicionId) {
      where.push(`mi.requisicion_id = $${i++}`);
      values.push(requisicionId);
    }

    if (usuarioId) {
      where.push(`mi.usuario_id = $${i++}`);
      values.push(usuarioId);
    }

    if (fechaInicio) {
      where.push(`mi.fecha >= $${i++}::timestamptz`);
      values.push(`${fechaInicio} 00:00:00`);
    }

    if (fechaFin) {
      where.push(`mi.fecha <= $${i++}::timestamptz`);
      values.push(`${fechaFin} 23:59:59`);
    }

    if (q) {
      where.push(`COALESCE(mi.observaciones, '') ILIKE $${i++}`);
      values.push(`%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Query principal: incluye nombres para visualizar bonito en front
    const sql = `
      SELECT
        mi.id,
        mi.fecha,
        mi.tipo_movimiento,
        mi.material_id,
        cm.nombre AS material_descripcion,
        mi.cantidad,
        mi.valor_unitario,
        mi.valor_total,
        mi.moneda,
        mi.ubicacion_id,
        ua.nombre AS ubicacion_nombre,
        mi.proyecto_origen_id,
        po.nombre AS proyecto_origen_nombre,
        mi.proyecto_destino_id,
        pd.nombre AS proyecto_destino_nombre,
        mi.orden_compra_id,
        mi.requisicion_id,
        mi.usuario_id,
        u.nombre AS usuario_nombre,
        mi.observaciones,
        mi.estado,
        mi.anulado_en,
        mi.anulado_por,
        u2.nombre AS anulado_por_nombre,
        mi.motivo_anulacion,
        mi.reversa_de_movimiento_id
      FROM public.movimientos_inventario mi
      LEFT JOIN public.catalogo_materiales cm ON cm.id = mi.material_id
      LEFT JOIN public.ubicaciones_almacen ua ON ua.id = mi.ubicacion_id
      LEFT JOIN public.proyectos po ON po.id = mi.proyecto_origen_id
      LEFT JOIN public.proyectos pd ON pd.id = mi.proyecto_destino_id
      LEFT JOIN public.usuarios u ON u.id = mi.usuario_id
      LEFT JOIN public.usuarios u2 ON u2.id = mi.anulado_por
      ${whereSql}
      ORDER BY mi.fecha DESC, mi.id DESC
      LIMIT $${i++} OFFSET $${i++};
    `;

    values.push(lim, off);

    // Conteo total para paginación
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.movimientos_inventario mi
      ${whereSql};
    `;

    // count usa mismos filtros (sin limit/offset)
    const countValues = values.slice(0, values.length - 2);

    const [rowsResult, countResult] = await Promise.all([
      pool.query(sql, values),
      pool.query(countSql, countValues),
    ]);

    return res.status(200).json({
      total: countResult.rows[0]?.total ?? 0,
      limit: lim,
      offset: off,
      rows: rowsResult.rows,
    });
  } catch (error) {
    console.error('Error en getKardex:', error);
    return res.status(500).json({ error: 'Error al consultar el kardex.' });
  }
};


/**
 * POST /api/inventario/apartar
 * Aparta stock general para un proyecto específico.
 */
const apartarStock = async (req, res) => {
  const { material_id, cantidad, sitio_id, proyecto_id } = req.body;
  const { id: usuarioId } = req.usuarioSira;
  const cantidadNum = parseFloat(cantidad) || 0;

  if (!material_id || cantidadNum <= 0 || !sitio_id || !proyecto_id) {
    return res.status(400).json({ error: 'Faltan datos para apartar el material.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ubicacionesStock = await client.query(
      `SELECT id, ubicacion_id, stock_actual, ultimo_precio_entrada, moneda
             FROM inventario_actual
             WHERE material_id = $1 AND stock_actual > 0
             ORDER BY stock_actual DESC FOR UPDATE`,
      [material_id]
    );

    const stockTotalDisponible = ubicacionesStock.rows.reduce((sum, u) => sum + parseFloat(u.stock_actual), 0);
    if (ubicacionesStock.rows.length === 0 || stockTotalDisponible < cantidadNum) {
      throw new Error(`Stock insuficiente para el material ID ${material_id}. Solicitado: ${cantidadNum}, Disponible: ${stockTotalDisponible}`);
    }

    let cantidadRestante = cantidadNum;
    const movimientos = [];

    for (const ubi of ubicacionesStock.rows) {
      const stockEnUbicacion = parseFloat(ubi.stock_actual);
      const cantidadARestar = Math.min(cantidadRestante, stockEnUbicacion);
      const valorUnitario = parseFloat(ubi.ultimo_precio_entrada) || 0;
      const moneda = ubi.moneda;
      const inventarioId = ubi.id;

      await client.query(
        `UPDATE inventario_actual
                 SET stock_actual = stock_actual - $1,
                     asignado = asignado + $1,
                     actualizado_en = NOW()
                 WHERE id = $2`,
        [cantidadARestar, inventarioId]
      );

      await client.query(
        `INSERT INTO inventario_asignado
                    (inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario, moneda, asignado_en)
                 VALUES ($1, NULL, $2, $3, $4, $5, $6, NOW())`,
        [inventarioId, proyecto_id, sitio_id, cantidadARestar, valorUnitario, moneda]
      );

      await client.query(
        `INSERT INTO movimientos_inventario
                    (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
                 VALUES ($1, 'AJUSTE_NEGATIVO', $2, $3, $4, $5, $6, $7, $8)`,
        [material_id, cantidadARestar, usuarioId, ubi.ubicacion_id, proyecto_id, valorUnitario, moneda, 'Apartado de stock']
      );
      await client.query(
        `INSERT INTO movimientos_inventario
                    (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
                 VALUES ($1, 'AJUSTE_POSITIVO', $2, $3, $4, $5, $6, $7, $8)`,
        [material_id, cantidadARestar, usuarioId, ubi.ubicacion_id, proyecto_id, valorUnitario, moneda, 'Apartado a proyecto']
      );

      movimientos.push({ ubicacion_id: ubi.ubicacion_id, cantidad: cantidadARestar });
      cantidadRestante -= cantidadARestar;
      if (cantidadRestante <= 0) break;
    }

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Material apartado exitosamente.', detalles: movimientos });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al apartar stock:', error);
    res.status(500).json({ error: error.message || 'Error interno al apartar stock.' });
  } finally {
    client.release();
  }
};

/**
 * POST /api/inventario/mover-asignacion
 * Mueve una asignación existente de un proyecto/sitio a otro.
 */
const moverAsignacion = async (req, res) => {
  const { asignacion_id, nuevo_sitio_id, nuevo_proyecto_id } = req.body;
  const { id: usuarioId } = req.usuarioSira;

  if (!asignacion_id || !nuevo_sitio_id || !nuevo_proyecto_id) {
    return res.status(400).json({ error: 'Faltan datos para mover la asignación.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const asignacionOriginal = await client.query(
      `SELECT ia.*, inv.material_id, inv.ubicacion_id
             FROM inventario_asignado ia
             JOIN inventario_actual inv ON ia.inventario_id = inv.id
             WHERE ia.id = $1 FOR UPDATE`,
      [asignacion_id]
    );
    if (asignacionOriginal.rowCount === 0) {
      throw new Error(`Asignación con ID ${asignacion_id} no encontrada.`);
    }
    const { proyecto_id: origen_proyecto_id, sitio_id: origen_sitio_id, cantidad, valor_unitario, moneda, material_id, ubicacion_id } = asignacionOriginal.rows[0];

    await client.query(
      `UPDATE inventario_asignado
             SET sitio_id = $1, proyecto_id = $2
             WHERE id = $3`,
      [nuevo_sitio_id, nuevo_proyecto_id, asignacion_id]
    );

    await client.query(
      `INSERT INTO movimientos_inventario
                (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
                 proyecto_origen_id, proyecto_destino_id, valor_unitario, moneda, observaciones)
             VALUES ($1, 'TRASPASO', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [material_id, cantidad, usuarioId, ubicacion_id,
        origen_proyecto_id, nuevo_proyecto_id, valor_unitario, moneda,
        `Movimiento de asignación (AsigID: ${asignacion_id})`]
    );

    await client.query('COMMIT');
    res.status(200).json({ mensaje: 'Asignación movida exitosamente.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al mover asignación:', error);
    res.status(500).json({ error: error.message || 'Error interno al mover asignación.' });
  } finally {
    client.release();
  }
};

/**
 * POST /api/inventario/ajustes
 * Ajustes manuales (delta) sobre stock_actual. Solo superusuario.
 *
 * Body soportado:
 *  - Single: { material_id, delta, ubicacion_id?, observaciones, ultimo_precio_entrada?, moneda? }
 *  - Batch:  { ajustes: [ { ... }, { ... } ] }
 */
const ajustarInventario = async (req, res) => {
  const { id: usuarioId, es_superusuario } = req.usuarioSira;

  if (!es_superusuario) {
    return res.status(403).json({ error: 'No autorizado. Solo superusuario puede realizar ajustes.' });
  }

  const payload = req.body?.ajustes ? req.body.ajustes : req.body;
  const ajustes = Array.isArray(payload) ? payload : [payload];

  if (!Array.isArray(ajustes) || ajustes.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos un ajuste.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resultados = [];

    for (const a of ajustes) {
      const material_id = a?.material_id;
      const deltaNum = parseFloat(a?.delta);
      let ubicacion_id = a?.ubicacion_id ?? null;
      const observaciones = (a?.observaciones ?? '').toString().trim();

      const precioInput = a?.ultimo_precio_entrada;
      const monedaInput = a?.moneda;

      if (!material_id) throw new Error('material_id es requerido.');
      if (!Number.isFinite(deltaNum) || deltaNum === 0) throw new Error('delta debe ser un número distinto de 0.');
      if (!observaciones) throw new Error('observaciones es requerido (texto).');

      // Si no viene ubicacion_id: elegimos una "ubicación por defecto" NO asumida:
      // 1) si ya existe inventario_actual para ese material, usamos la ubicación con más stock_actual
      // 2) si no existe, usamos la primera ubicación de ubicaciones_almacen
      // ✅ Para AJUSTES: ubicacion_id debe ser SIEMPRE de ubicaciones_almacen
      if (!ubicacion_id) {
        const def = await client.query(`SELECT id FROM ubicaciones_almacen ORDER BY id ASC LIMIT 1`);
        if (def.rowCount === 0) {
          throw new Error('No existe ninguna ubicación de almacén en ubicaciones_almacen. Debes crear una o enviar ubicacion_id.');
        }
        ubicacion_id = def.rows[0].id;
      } else {
        const exists = await client.query(`SELECT 1 FROM ubicaciones_almacen WHERE id = $1`, [ubicacion_id]);
        if (exists.rowCount === 0) {
          throw new Error('ubicacion_id inválida: debe ser una ubicación de almacén (ubicaciones_almacen).');
        }
      }


      // Lock del renglón de inventario
      let invRes = await client.query(
        `SELECT id, stock_actual, asignado, ultimo_precio_entrada, moneda
           FROM inventario_actual
          WHERE material_id = $1 AND ubicacion_id = $2
          FOR UPDATE`,
        [material_id, ubicacion_id]
      );

      // Si no existe, lo creamos en 0 para poder ajustar
      if (invRes.rowCount === 0) {
        await client.query(
          `INSERT INTO inventario_actual (material_id, ubicacion_id, stock_actual, asignado, ultimo_precio_entrada, moneda)
           VALUES ($1, $2, 0, 0, 0, NULL)`,
          [material_id, ubicacion_id]
        );

        invRes = await client.query(
          `SELECT id, stock_actual, asignado, ultimo_precio_entrada, moneda
             FROM inventario_actual
            WHERE material_id = $1 AND ubicacion_id = $2
            FOR UPDATE`,
          [material_id, ubicacion_id]
        );
      }

      const inv = invRes.rows[0];
      const stockActual = parseFloat(inv.stock_actual) || 0;
      const asignado = parseFloat(inv.asignado) || 0;
      const totalAntes = stockActual + asignado;

      // No permitir negativos en disponible
      const stockNuevo = stockActual + deltaNum;
      if (stockNuevo < 0) {
        throw new Error(`Stock insuficiente para ajuste negativo. Disponible: ${stockActual}, delta: ${deltaNum}`);
      }

      // Regla de edición de precio:
      // solo si totalAntes == 0 y delta > 0
      const puedeEditarPrecio = totalAntes === 0 && deltaNum > 0;

      const traePrecio = precioInput !== undefined && precioInput !== null && `${precioInput}` !== '';
      const traeMoneda = monedaInput !== undefined && monedaInput !== null && `${monedaInput}` !== '';

      if ((traePrecio || traeMoneda) && !puedeEditarPrecio) {
        throw new Error('Solo se permite modificar precio/moneda cuando (disponible + asignado) = 0 y el ajuste es positivo.');
      }

      let precioFinal = parseFloat(inv.ultimo_precio_entrada) || 0;
      let monedaFinal = inv.moneda || null;

      if (puedeEditarPrecio && traePrecio) {
        const precioNum = parseFloat(precioInput);
        if (!Number.isFinite(precioNum) || precioNum <= 0) {
          throw new Error('ultimo_precio_entrada debe ser un número > 0 cuando se envía.');
        }
        if (!traeMoneda) {
          throw new Error('moneda es obligatoria cuando se envía ultimo_precio_entrada.');
        }
        const monedaStr = `${monedaInput}`.trim().toUpperCase();
        if (monedaStr.length !== 3) {
          throw new Error('moneda debe ser un código de 3 letras (ej. MXN, USD).');
        }

        precioFinal = precioNum;
        monedaFinal = monedaStr;
      } else if (puedeEditarPrecio && traeMoneda && !traePrecio) {
        // No permitimos mandar moneda sola
        throw new Error('Si envías moneda, debes enviar también ultimo_precio_entrada.');
      }

      // Actualizar inventario_actual
      if (puedeEditarPrecio && traePrecio) {
        await client.query(
          `UPDATE inventario_actual
              SET stock_actual = stock_actual + $1,
                  ultimo_precio_entrada = $2,
                  moneda = $3,
                  actualizado_en = NOW()
            WHERE id = $4`,
          [deltaNum, precioFinal, monedaFinal, inv.id]
        );
      } else {
        await client.query(
          `UPDATE inventario_actual
              SET stock_actual = stock_actual + $1,
                  actualizado_en = NOW()
            WHERE id = $2`,
          [deltaNum, inv.id]
        );
      }

      // Insertar movimiento kardex (cantidad siempre positiva)
      const tipo_movimiento = deltaNum > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';
      const cantidadMovimiento = Math.abs(deltaNum);

      const movRes = await client.query(
        `INSERT INTO movimientos_inventario
           (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id, valor_unitario, moneda, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, fecha`,
        [
          material_id,
          tipo_movimiento,
          cantidadMovimiento,
          usuarioId,
          ubicacion_id,
          precioFinal,
          monedaFinal,
          observaciones,
        ]
      );

      // Regresar estado actualizado
      const invFinalRes = await client.query(
        `SELECT material_id, ubicacion_id, stock_actual, asignado, existencia_total, ultimo_precio_entrada, moneda
           FROM inventario_actual
          WHERE material_id = $1 AND ubicacion_id = $2`,
        [material_id, ubicacion_id]
      );

      resultados.push({
        material_id,
        ubicacion_id,
        delta: deltaNum,
        movimiento: movRes.rows[0],
        inventario: invFinalRes.rows[0],
      });
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, resultados });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en ajustarInventario:', error);

    const msg = error.message || 'Error interno al ajustar inventario.';
    const isValidation =
      msg.includes('requerido') ||
      msg.includes('delta') ||
      msg.includes('Stock insuficiente') ||
      msg.includes('ubicacion_id inválida') ||
      msg.includes('Solo se permite modificar precio');

    return res.status(isValidation ? 400 : 500).json({ error: msg });
  }
  finally {
    client.release();
  }
};

/**
 * POST /api/inventario/movimientos/:id/reversar
 * Reversa de movimientos:
 *  - AJUSTE_POSITIVO -> AJUSTE_NEGATIVO (resta stock)
 *  - AJUSTE_NEGATIVO -> AJUSTE_POSITIVO (suma stock)
 *  - SALIDA -> devuelve a stock o a asignado (según origen)
 *
 * Body: { motivo: string }
 */
const reversarMovimiento = async (req, res) => {
  const { id: usuarioId, es_superusuario } = req.usuarioSira;
  if (!es_superusuario) {
    return res.status(403).json({ error: 'No autorizado. Solo superusuario puede reversar movimientos.' });
  }

  const movimientoId = parseInt(req.params.id, 10);
  const motivo = (req.body?.motivo ?? '').toString().trim();

  if (!Number.isFinite(movimientoId) || movimientoId <= 0) {
    return res.status(400).json({ error: 'ID de movimiento inválido.' });
  }
  if (!motivo) {
    return res.status(400).json({ error: 'motivo es requerido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Traer movimiento y bloquearlo
    const movRes = await client.query(
      `SELECT *
         FROM public.movimientos_inventario
        WHERE id = $1
        FOR UPDATE`,
      [movimientoId]
    );

    if (movRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Movimiento no encontrado.' });
    }

    const mov = movRes.rows[0];

    // Validaciones básicas
    if (mov.estado && mov.estado !== 'ACTIVO') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El movimiento no está ACTIVO (ya fue anulado o no es reversible).' });
    }

    // No permitir reversar un movimiento que YA ES una reversa de otro
    if (mov.reversa_de_movimiento_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se permite reversar un movimiento que ya es una reversa.' });
    }

    // Tipos permitidos
    const tipo = mov.tipo_movimiento;
    const tiposPermitidos = ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'SALIDA'];
    if (!tiposPermitidos.includes(tipo)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Tipo de movimiento no reversible: ${tipo}` });
    }

    // Si ya existe una reversa activa que apunta a este movimiento, bloquear
    const existsRev = await client.query(
      `SELECT id
         FROM public.movimientos_inventario
        WHERE reversa_de_movimiento_id = $1
          AND (estado IS NULL OR estado = 'ACTIVO')
        LIMIT 1`,
      [movimientoId]
    );
    if (existsRev.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Este movimiento ya tiene una reversa (movimiento ${existsRev.rows[0].id}).` });
    }

    const materialId = mov.material_id;
    const ubicacionId = mov.ubicacion_id ?? null;
    const cantidad = parseFloat(mov.cantidad) || 0;

    if (cantidad <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La cantidad del movimiento es inválida.' });
    }

    let reversaTipo = null;
    let reversaId = null;

    // Helper: obtener/crear inventario_actual para (material, ubicacion almacén)
    const ensureInventarioActual = async (matId, ubiId) => {
      let inv = await client.query(
        `SELECT id, stock_actual, asignado, ultimo_precio_entrada, moneda
           FROM public.inventario_actual
          WHERE material_id = $1 AND ubicacion_id = $2
          FOR UPDATE`,
        [matId, ubiId]
      );

      if (inv.rowCount === 0) {
        await client.query(
          `INSERT INTO public.inventario_actual (material_id, ubicacion_id, stock_actual, asignado, ultimo_precio_entrada, moneda)
           VALUES ($1, $2, 0, 0, 0, NULL)`,
          [matId, ubiId]
        );

        inv = await client.query(
          `SELECT id, stock_actual, asignado, ultimo_precio_entrada, moneda
             FROM public.inventario_actual
            WHERE material_id = $1 AND ubicacion_id = $2
            FOR UPDATE`,
          [matId, ubiId]
        );
      }
      return inv.rows[0];
    };

    // =========================================================================================
    // Caso 1: AJUSTE_POSITIVO / AJUSTE_NEGATIVO (siempre stock_actual)
    // =========================================================================================
    if (tipo === 'AJUSTE_POSITIVO' || tipo === 'AJUSTE_NEGATIVO') {
      if (!ubicacionId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El movimiento no tiene ubicacion_id; no se puede reversar automáticamente.' });
      }

      // Validar que ubicacionId sea de almacén (ajustes siempre sobre almacén)
      const ubiOk = await client.query(`SELECT 1 FROM public.ubicaciones_almacen WHERE id = $1`, [ubicacionId]);
      if (ubiOk.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ubicacion_id no corresponde a una ubicación de almacén; no se puede reversar automáticamente.' });
      }

      const inv = await ensureInventarioActual(materialId, ubicacionId);
      const stockActual = parseFloat(inv.stock_actual) || 0;

      if (tipo === 'AJUSTE_POSITIVO') {
        // Reversa: restar stock
        if (stockActual - cantidad < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `No se puede reversar: el stock actual (${stockActual}) no alcanza para restar ${cantidad}.` });
        }

        await client.query(
          `UPDATE public.inventario_actual
              SET stock_actual = stock_actual - $1, actualizado_en = NOW()
            WHERE id = $2`,
          [cantidad, inv.id]
        );

        reversaTipo = 'AJUSTE_NEGATIVO';
      } else {
        // AJUSTE_NEGATIVO -> sumar stock
        await client.query(
          `UPDATE public.inventario_actual
              SET stock_actual = stock_actual + $1, actualizado_en = NOW()
            WHERE id = $2`,
          [cantidad, inv.id]
        );

        reversaTipo = 'AJUSTE_POSITIVO';
      }

      // Moneda/valor_unitario: usamos los del movimiento original si existen, si no los del inventario
      const valorUnitario = mov.valor_unitario ?? inv.ultimo_precio_entrada ?? 0;
      const monedaFinal = mov.moneda ?? inv.moneda ?? null;

      const revIns = await client.query(
        `INSERT INTO public.movimientos_inventario
           (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
            valor_unitario, moneda, observaciones, reversa_de_movimiento_id,
            proyecto_origen_id, proyecto_destino_id, orden_compra_id, requisicion_id)
         VALUES ($1, $2, $3, $4, $5,
                 $6, $7, $8, $9,
                 $10, $11, $12, $13)
         RETURNING id, fecha`,
        [
          materialId,
          reversaTipo,
          cantidad,
          usuarioId,
          ubicacionId,
          valorUnitario,
          monedaFinal,
          `Reversa de movimiento #${movimientoId}. Motivo: ${motivo}`,
          movimientoId,
          mov.proyecto_origen_id ?? null,
          mov.proyecto_destino_id ?? null,
          mov.orden_compra_id ?? null,
          mov.requisicion_id ?? null,
        ]
      );

      reversaId = revIns.rows[0].id;
    }

    // =========================================================================================
    // Caso 2: SALIDA (puede ser STOCK o ASIGNADO)
    // =========================================================================================
    if (tipo === 'SALIDA') {
      if (!ubicacionId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La SALIDA no tiene ubicacion_id; no se puede reversar automáticamente.' });
      }

      // Detectar si fue retiro asignado por texto "AsigID: N"
      const obs = (mov.observaciones ?? '').toString();
      const match = obs.match(/AsigID:\s*(\d+)/i);
      const asignacionId = match ? parseInt(match[1], 10) : null;

      if (asignacionId) {
        // -------------------------
        // SALIDA desde ASIGNADO -> regresar a inventario_asignado + inventario_actual.asignado
        // -------------------------
        const asigRes = await client.query(
          `SELECT id, inventario_id, proyecto_id, sitio_id, valor_unitario, moneda
             FROM public.inventario_asignado
            WHERE id = $1
            FOR UPDATE`,
          [asignacionId]
        );
        if (asigRes.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `No existe inventario_asignado con id ${asignacionId}. No se puede reversar automáticamente.` });
        }

        const asig = asigRes.rows[0];

        // Sumar de regreso a la asignación
        await client.query(
          `UPDATE public.inventario_asignado
              SET cantidad = cantidad + $1
            WHERE id = $2`,
          [cantidad, asignacionId]
        );

        // Sumar de regreso al "asignado" físico en inventario_actual
        const invActRes = await client.query(
          `SELECT id, asignado, stock_actual, ultimo_precio_entrada, moneda
             FROM public.inventario_actual
            WHERE material_id = $1 AND ubicacion_id = $2
            FOR UPDATE`,
          [materialId, ubicacionId]
        );
        if (invActRes.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `No existe inventario_actual para material ${materialId} en ubicacion ${ubicacionId}. No se puede reversar automáticamente.` });
        }
        const inv = invActRes.rows[0];

        await client.query(
          `UPDATE public.inventario_actual
              SET asignado = asignado + $1,
                  actualizado_en = NOW()
            WHERE id = $2`,
          [cantidad, inv.id]
        );

        // Registrar movimiento de reversa (usamos AJUSTE_POSITIVO porque “regresa material”)
        reversaTipo = 'AJUSTE_POSITIVO';
        const valorUnitario = mov.valor_unitario ?? asig.valor_unitario ?? inv.ultimo_precio_entrada ?? 0;
        const monedaFinal = mov.moneda ?? asig.moneda ?? inv.moneda ?? null;

        // Para trazabilidad de “de dónde regresa y a dónde vuelve”
        const proyectoOrigen = mov.proyecto_destino_id ?? null; // a donde se fue
        const proyectoDestino = asig.proyecto_id ?? null;       // donde estaba asignado

        const revIns = await client.query(
          `INSERT INTO public.movimientos_inventario
             (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
              proyecto_origen_id, proyecto_destino_id,
              valor_unitario, moneda, observaciones, reversa_de_movimiento_id)
           VALUES ($1, $2, $3, $4, $5,
                   $6, $7,
                   $8, $9, $10, $11)
           RETURNING id, fecha`,
          [
            materialId,
            reversaTipo,
            cantidad,
            usuarioId,
            ubicacionId,
            proyectoOrigen,
            proyectoDestino,
            valorUnitario,
            monedaFinal,
            `Reversa de SALIDA asignada (mov #${movimientoId}, AsigID:${asignacionId}). Motivo: ${motivo}`,
            movimientoId,
          ]
        );

        reversaId = revIns.rows[0].id;
      } else {
        // -------------------------
        // SALIDA desde STOCK -> regresar a inventario_actual.stock_actual
        // -------------------------
        // Validar que ubicacionId sea de almacén (stock general)
        const ubiOk = await client.query(`SELECT 1 FROM public.ubicaciones_almacen WHERE id = $1`, [ubicacionId]);
        if (ubiOk.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'No se detectó AsigID y ubicacion_id no es almacén. No se puede reversar automáticamente.' });
        }

        const inv = await ensureInventarioActual(materialId, ubicacionId);

        await client.query(
          `UPDATE public.inventario_actual
              SET stock_actual = stock_actual + $1,
                  actualizado_en = NOW()
            WHERE id = $2`,
          [cantidad, inv.id]
        );

        reversaTipo = 'AJUSTE_POSITIVO';

        const valorUnitario = mov.valor_unitario ?? inv.ultimo_precio_entrada ?? 0;
        const monedaFinal = mov.moneda ?? inv.moneda ?? null;

        // Para trazabilidad: de qué proyecto “regresa”
        const proyectoOrigen = mov.proyecto_destino_id ?? null;

        const revIns = await client.query(
          `INSERT INTO public.movimientos_inventario
             (material_id, tipo_movimiento, cantidad, usuario_id, ubicacion_id,
              proyecto_origen_id,
              valor_unitario, moneda, observaciones, reversa_de_movimiento_id)
           VALUES ($1, $2, $3, $4, $5,
                   $6,
                   $7, $8, $9, $10)
           RETURNING id, fecha`,
          [
            materialId,
            reversaTipo,
            cantidad,
            usuarioId,
            ubicacionId,
            proyectoOrigen,
            valorUnitario,
            monedaFinal,
            `Reversa de SALIDA desde stock (mov #${movimientoId}). Motivo: ${motivo}`,
            movimientoId,
          ]
        );

        reversaId = revIns.rows[0].id;
      }
    }

    // 3) Marcar original como ANULADO
    await client.query(
      `UPDATE public.movimientos_inventario
          SET estado = 'ANULADO',
              anulado_en = NOW(),
              anulado_por = $2,
              motivo_anulacion = $3,
              actualizado_en = NOW()
        WHERE id = $1`,
      [movimientoId, usuarioId, motivo]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      ok: true,
      movimiento_original_id: movimientoId,
      movimiento_reversa_id: reversaId,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en reversarMovimiento:', error);

    const msg = error.message || 'Error interno al reversar movimiento.';
    const isValidation =
      msg.includes('No autorizado') ||
      msg.includes('requerido') ||
      msg.includes('inválido') ||
      msg.includes('no se puede reversar') ||
      msg.includes('ya tiene una reversa') ||
      msg.includes('Stock insuficiente') ||
      msg.includes('No existe');

    return res.status(isValidation ? 400 : 500).json({ error: msg });
  } finally {
    client.release();
  }
};



module.exports = {
  // getDatosFiltrosInventario, // <--- Eliminado, reemplazado por getDatosIniciales
  getInventarioActual,
  getDetalleAsignacionesMaterial,
  getKardex,
  ajustarInventario,
  apartarStock,
  reversarMovimiento,
  moverAsignacion,
  getDatosIniciales, // <<< Ruta principal de datos
};