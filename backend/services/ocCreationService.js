//C:\SIRA\backend\services\ocCreationService.js
/**
 * =================================================================================================
 * SERVICIO: Creación de Órdenes de Compra (OC)
 * =================================================================================================
 * @file ocCreationService.js
 * @description ¡CAMBIO! Se corrige el INSERT para que no guarde el prefijo 'OC-'.
 */

// --- Importaciones ---
const pool = require('../db/pool');

// ===============================================================================================
// --- Funciones de Ayuda (Helpers) Internas ---
// ===============================================================================================

const calcularTotales = (opciones) => {
  // ... (sin cambios)
  const subTotal = opciones.reduce((sum, item) => {
    const cantidad = Number(item.cantidad_cotizada) || 0;
    const precio = Number(item.precio_unitario) || 0;
    return sum + (cantidad * precio);
  }, 0);
  const iva = subTotal * 0.16;
  const total = subTotal + iva;
  return { subTotal, iva, total };
};

const esOrdenDeImportacion = (opciones) => {
  // ... (sin cambios)
  return opciones.some(item => item.es_importacion === true);
};


// ===============================================================================================
// --- Lógica Principal del Servicio (Función Exportada) ---
// ===============================================================================================

const crearOrdenDeCompraDesdeRfq = async ({ rfqId, usuarioId, opcionIds }) => {
  if (!opcionIds || opcionIds.length === 0) {
    throw new Error("Se requiere al menos una opción seleccionada para generar la OC.");
  }
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener toda la información necesaria (Sin cambios)
    const opcionesQuery = await client.query(
      `SELECT
        ro.*,
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
    
    const infoComun = opcionesSeleccionadas[0];
    const { sitio_id, proyecto_id, lugar_entrega, proveedor_id } = infoComun;
    
    // 2. Calcular totales y determinar si es de importación (Sin cambios)
    const { subTotal, iva, total } = calcularTotales(opcionesSeleccionadas);
    const esImportacion = esOrdenDeImportacion(opcionesSeleccionadas);

    // =================================================================
    // --- ¡CORRECCIÓN BUG "OC-OC-" (Paso 3)! ---
    // Se quita el prefijo 'OC-' del INSERT.
    // =================================================================
    const ocInsertResult = await client.query(
      `INSERT INTO ordenes_compra
        (numero_oc, usuario_id, rfq_id, sitio_id, proyecto_id, lugar_entrega, sub_total, iva, total, impo, status, proveedor_id)
       VALUES
        (nextval('ordenes_compra_id_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'POR_AUTORIZAR', $10)
       RETURNING id, numero_oc`,
      [usuarioId, rfqId, sitio_id, proyecto_id, lugar_entrega, subTotal, iva, total, esImportacion, proveedor_id]
    );

    const nuevaOc = ocInsertResult.rows[0]; // 'numero_oc' es solo el NÚMERO
    const nuevaOcId = nuevaOc.id;

    // 4. Insertar las líneas de detalle (Sin cambios)
    for (const item of opcionesSeleccionadas) {
      await client.query(
        `INSERT INTO ordenes_compra_detalle
          (orden_compra_id, requisicion_detalle_id, comparativa_precio_id, material_id, cantidad, precio_unitario, moneda, plazo_entrega)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [nuevaOcId, item.requisicion_detalle_id, item.id, item.material_id, item.cantidad_cotizada, item.precio_unitario, item.moneda, item.plazo_entrega]
      );

      // 5. Actualizar el estado de la línea de requisición original (Sin cambios)
      await client.query(
        `UPDATE requisiciones_detalle SET status_compra = $1 WHERE id = $2`,
        [nuevaOcId, item.requisicion_detalle_id]
      );
    }
    
    await client.query('COMMIT');
    
    return nuevaOc; // Retorna la OC con 'numero_oc' siendo solo el NÚMERO

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en la transacción de creación de OC:', error);
    throw error;
  } finally {
    client.release();
  }
};

// --- Exportaciones del Módulo ---
module.exports = {
  crearOrdenDeCompraDesdeRfq,
};