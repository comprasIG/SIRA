/**
 * =================================================================================================
 * SERVICIO: Creación de Órdenes de Compra (OC)
 * =================================================================================================
 * @file ocCreationService.js
 * @description Este servicio encapsula toda la lógica de negocio para la creación de una nueva
 * Orden de Compra a partir de opciones seleccionadas en un RFQ. Se encarga de
 * la transacción de base de datos para garantizar la integridad de los datos.
 */

// --- Importaciones ---
const pool = require('../db/pool'); // Importamos el pool de conexiones a la BD.

// ===============================================================================================
// --- Funciones de Ayuda (Helpers) Internas ---
// ===============================================================================================

/**
 * Calcula los totales (subtotal, iva, total) para una nueva Orden de Compra.
 * @param {Array<object>} opciones - Un arreglo de las opciones de cotización seleccionadas.
 * @returns {object} Un objeto con { subTotal, iva, total }.
 */
const calcularTotales = (opciones) => {
  // Reduce el arreglo de opciones para sumar el producto de cantidad * precio.
  const subTotal = opciones.reduce((sum, item) => {
    // Se asegura de que los valores sean numéricos antes de operar.
    const cantidad = Number(item.cantidad_cotizada) || 0;
    const precio = Number(item.precio_unitario) || 0;
    return sum + (cantidad * precio);
  }, 0);

  // NOTA: El cálculo de IVA podría ser más complejo. Por ahora, se asume un 16% estándar.
  const iva = subTotal * 0.16;
  const total = subTotal + iva;

  return { subTotal, iva, total };
};

/**
 * Determina si la Orden de Compra es de importación.
 * Si al menos UN item está marcado como importación, toda la OC se considera de importación.
 * @param {Array<object>} opciones - Un arreglo de las opciones de cotización seleccionadas.
 * @returns {boolean} `true` si es de importación, de lo contrario `false`.
 */
const esOrdenDeImportacion = (opciones) => {
  return opciones.some(item => item.es_importacion === true);
};


// ===============================================================================================
// --- Lógica Principal del Servicio (Función Exportada) ---
// ===============================================================================================

/**
 * Orquesta la creación de una Orden de Compra dentro de una transacción de base de datos.
 * @param {object} params - Objeto con los parámetros para la creación.
 * @param {number} params.rfqId - ID de la requisición (RFQ) de origen.
 * @param {number} params.usuarioId - ID del usuario que autoriza la creación (el gerente).
 * @param {Array<number>} params.opcionIds - IDs de las `requisiciones_opciones` seleccionadas para esta OC.
 * @returns {Promise<object>} - El objeto de la Orden de Compra recién creada.
 */
const crearOrdenDeCompraDesdeRfq = async ({ rfqId, usuarioId, opcionIds }) => {
  // Se valida que se hayan proporcionado los IDs de las opciones.
  if (!opcionIds || opcionIds.length === 0) {
    throw new Error("Se requiere al menos una opción seleccionada para generar la OC.");
  }

  // Se inicia una conexión con la base de datos desde el pool.
  const client = await pool.connect();

  try {
    // --- INICIO DE LA TRANSACCIÓN ---
    await client.query('BEGIN');

    // 1. Obtener toda la información necesaria de las opciones seleccionadas y del RFQ.
    // Se usa un JOIN para traer datos del RFQ y de los materiales.
    const opcionesQuery = await client.query(
      `SELECT
        ro.*, -- Todos los campos de requisiciones_opciones
        rd.material_id,
        r.sitio_id,
        r.proyecto_id,
        r.lugar_entrega
       FROM requisiciones_opciones ro
       JOIN requisiciones_detalle rd ON ro.requisicion_detalle_id = rd.id
       JOIN requisiciones r ON ro.requisicion_id = r.id
       WHERE ro.id = ANY($1::int[]) AND ro.requisicion_id = $2`,
      [opcionIds, rfqId]
    );

    const opcionesSeleccionadas = opcionesQuery.rows;
    if (opcionesSeleccionadas.length === 0) {
      throw new Error("Las opciones seleccionadas no son válidas o no pertenecen al RFQ especificado.");
    }
    
    // Se extrae la información común de la primera opción (todas comparten la misma info de RFQ).
    const infoComun = opcionesSeleccionadas[0];
    const { sitio_id, proyecto_id, lugar_entrega, proveedor_id } = infoComun;
    
    // 2. Calcular totales y determinar si es de importación.
    const { subTotal, iva, total } = calcularTotales(opcionesSeleccionadas);
    const esImportacion = esOrdenDeImportacion(opcionesSeleccionadas);

    // 3. Insertar la cabecera de la nueva Orden de Compra.
    // El número de OC se genera a partir de una secuencia de la BD.
    // El estado inicial es 'POR_AUTORIZAR', como fue solicitado.
    const ocInsertResult = await client.query(
      `INSERT INTO ordenes_compra
        (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id)
       VALUES
        ('OC-' || nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'POR_AUTORIZAR', $10)
       RETURNING id, numero_oc`,
      [usuarioId, rfqId, sitio_id, proyecto_id, lugar_entrega, subTotal, iva, total, esImportacion, proveedor_id]
    );

    const nuevaOc = ocInsertResult.rows[0];
    const nuevaOcId = nuevaOc.id;

    // 4. Insertar las líneas de detalle de la Orden de Compra.
    for (const item of opcionesSeleccionadas) {
      await client.query(
        `INSERT INTO ordenes_compra_detalle
          (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [nuevaOcId, item.requisicion_detalle_id, item.id, item.material_id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.plazo_entrega]
      );

      // 5. Actualizar el estado de la línea de requisición original.
      // Se actualiza 'status_compra' con el ID de la OC recién creada para seguimiento.
      await client.query(
        `UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`,
        [nuevaOcId, item.requisicion_detalle_id]
      );
    }
    
    // --- FINALIZACIÓN DE LA TRANSACCIÓN ---
    await client.query('COMMIT');
    
    // Se retorna la OC creada para que el controlador la envíe como respuesta.
    return nuevaOc;

  } catch (error) {
    // Si ocurre cualquier error, se revierte toda la transacción.
    await client.query('ROLLBACK');
    console.error('Error en la transacción de creación de OC:', error);
    // Se relanza el error para que sea manejado por el controlador.
    throw error;
  } finally {
    // Se libera la conexión del cliente para devolverla al pool.
    client.release();
  }
};

// --- Exportaciones del Módulo ---
module.exports = {
  crearOrdenDeCompraDesdeRfq,
};