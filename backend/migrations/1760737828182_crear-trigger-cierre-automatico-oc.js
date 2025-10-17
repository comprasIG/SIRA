/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {

// 1. Crear la función que verifica si todos los detalles están completos
  pgm.sql(`
    CREATE OR REPLACE FUNCTION f_verificar_cierre_oc_completa()
    RETURNS TRIGGER AS $$
    DECLARE
        v_orden_compra_id INT;
        v_total_items INT;
        v_items_completos INT;
        v_fecha_entrada_proceso TIMESTAMPTZ;
        v_metodo_recoleccion INT;
        v_entrega_responsable VARCHAR(30);
    BEGIN
        -- Determinar el orden_compra_id afectado por el cambio en ordenes_compra_detalle
        IF TG_OP = 'UPDATE' THEN
            v_orden_compra_id := NEW.orden_compra_id;
        ELSIF TG_OP = 'INSERT' THEN
             -- Podríamos necesitarlo si se insertan detalles después, aunque no es el flujo principal
             v_orden_compra_id := NEW.orden_compra_id;
        ELSE
            -- No hacemos nada en DELETE
            RETURN NULL;
        END IF;

        -- Contar total de items y items completos para esa OC
        SELECT
            COUNT(*),
            COUNT(*) FILTER (WHERE cantidad_recibida >= cantidad)
        INTO
            v_total_items,
            v_items_completos
        FROM ordenes_compra_detalle
        WHERE orden_compra_id = v_orden_compra_id;

        -- Si todos los items están completos
        IF v_total_items > 0 AND v_total_items = v_items_completos THEN
            -- Actualizar la OC a ENTREGADA y resetear bandera parcial
            UPDATE ordenes_compra
            SET status = 'ENTREGADA',
                entrega_parcial = FALSE,
                actualizado_en = NOW()
            WHERE id = v_orden_compra_id AND status != 'ENTREGADA'; -- Evitar updates innecesarios

            -- Registrar en la tabla de KPIs si la actualización tuvo éxito
            IF FOUND THEN
                -- Obtener datos necesarios para el KPI
                SELECT MIN(h.fecha_registro), oc.metodo_recoleccion_id, oc.entrega_responsable
                INTO v_fecha_entrada_proceso, v_metodo_recoleccion, v_entrega_responsable
                FROM ordenes_compra_historial h
                JOIN ordenes_compra oc ON h.orden_compra_id = oc.id
                WHERE h.orden_compra_id = v_orden_compra_id
                  AND h.accion_realizada = 'PROCESO_RECOLECCION'
                GROUP BY oc.metodo_recoleccion_id, oc.entrega_responsable;

                IF v_fecha_entrada_proceso IS NOT NULL THEN
                    INSERT INTO historial_kpi_tiempos_entrega (
                        orden_compra_id,
                        fecha_entrada_proceso,
                        fecha_entregada,
                        dias_transcurridos,
                        metodo_recoleccion_id,
                        entrega_responsable
                    ) VALUES (
                        v_orden_compra_id,
                        v_fecha_entrada_proceso,
                        NOW(),
                        -- Calcular diferencia en días (aproximado)
                        EXTRACT(EPOCH FROM (NOW() - v_fecha_entrada_proceso)) / (60*60*24),
                        v_metodo_recoleccion,
                        v_entrega_responsable
                    );
                END IF;

                -- Registrar en historial de OC
                 INSERT INTO ordenes_compra_historial (orden_compra_id, usuario_id, accion_realizada, detalles)
                 VALUES (v_orden_compra_id, NULL, 'CIERRE_AUTOMATICO_ENTREGADA', jsonb_build_object('mensaje', 'Todos los items recibidos.'));

            END IF;
        END IF;

        RETURN NULL; -- El resultado no importa para triggers AFTER
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Crear el trigger que llama a la función después de actualizar cantidad_recibida
  pgm.sql(`
    CREATE OR REPLACE TRIGGER trg_verificar_cierre_oc
    AFTER UPDATE OF cantidad_recibida ON ordenes_compra_detalle
    FOR EACH ROW
    EXECUTE FUNCTION f_verificar_cierre_oc_completa();
    `);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // Eliminar el trigger y luego la función
  pgm.sql(`DROP TRIGGER IF EXISTS trg_verificar_cierre_oc ON ordenes_compra_detalle;`);
  pgm.sql(`DROP FUNCTION IF EXISTS f_verificar_cierre_oc_completa();`);
  
};
