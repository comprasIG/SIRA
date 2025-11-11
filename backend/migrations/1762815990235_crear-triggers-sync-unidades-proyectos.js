/* eslint-disable camelcase */
// backend/migrations/1762815990235_crear-triggers-sync-unidades-proyectos.js

exports.shorthands = undefined;

const FUNCION_NAME = 'f_sync_unidad_a_proyecto';

exports.up = (pgm) => {
  // --- 1. CREAR LA FUNCIÓN (VERSIÓN CORREGIDA) ---
  pgm.createFunction(
    FUNCION_NAME,
    [], // Argumentos de entrada (ninguno)
    {
      returns: 'trigger',
      language: 'plpgsql',
    },
    `
    DECLARE
      v_sitio_id INT;
      v_cliente_id INT;
      v_proyecto_nombre VARCHAR(100);
      v_unidad_responsable_id INT;
      v_unidad_activo BOOLEAN;
      v_proyecto_id INT; -- <<< Variable extra para el chequeo
    BEGIN
      -- 1. Obtener el ID del sitio 'UNIDADES' y su cliente asociado
      SELECT s.id, s.cliente INTO v_sitio_id, v_cliente_id
      FROM public.sitios s
      JOIN public.clientes c ON s.cliente = c.id
      WHERE c.razon_social = 'IG BIOGAS' AND s.nombre = 'UNIDADES';

      IF v_sitio_id IS NULL THEN
        RAISE WARNING 'Sitio "UNIDADES" no encontrado. El trigger f_sync_unidad_a_proyecto no hizo nada.';
        RETURN NULL;
      END IF;

      -- 2. Determinar la acción (INSERT, UPDATE, DELETE)
      IF (TG_OP = 'DELETE') THEN
        v_proyecto_nombre := OLD.unidad;
        
        -- Desactivamos el proyecto espejo
        UPDATE public.proyectos
        SET activo = false, actualizado_en = now()
        WHERE nombre = v_proyecto_nombre AND sitio_id = v_sitio_id;
        
        RETURN OLD;

      ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_proyecto_nombre := NEW.unidad;
        v_unidad_responsable_id := NEW.responsable_id;
        v_unidad_activo := NEW.activo;

        -- 3. LÓGICA UPSERT CORREGIDA (SIN ON CONFLICT)
        -- Primero, buscamos si el proyecto espejo ya existe
        SELECT id INTO v_proyecto_id 
        FROM public.proyectos
        WHERE nombre = v_proyecto_nombre AND sitio_id = v_sitio_id;

        IF v_proyecto_id IS NULL THEN
          -- NO EXISTE: Lo creamos
          INSERT INTO public.proyectos (
            nombre, descripcion, responsable_id, sitio_id, cliente_id, activo
          )
          VALUES (
            v_proyecto_nombre,
            'Bitácora de mantenimiento para la unidad ' || v_proyecto_nombre,
            v_unidad_responsable_id,
            v_sitio_id,
            v_cliente_id,
            v_unidad_activo
          );
        ELSE
          -- SÍ EXISTE: Lo actualizamos
          UPDATE public.proyectos
          SET 
            activo = v_unidad_activo,
            responsable_id = v_unidad_responsable_id,
            descripcion = 'Bitácora de mantenimiento para la unidad ' || v_proyecto_nombre, -- Asegura que la desc esté al día
            actualizado_en = now()
          WHERE 
            id = v_proyecto_id;
        END IF;
        
        RETURN NEW;
      END IF;
      
      RETURN NULL; -- Fallback
    END;
    `
  );

  // --- 2. CREAR LOS TRIGGERS ---
  
  pgm.createTrigger('unidades', 'tg_sync_unidad_insert_update', {
    when: 'AFTER',
    operation: ['INSERT', 'UPDATE'],
    level: 'ROW',
    function: FUNCION_NAME,
  });

  pgm.createTrigger('unidades', 'tg_sync_unidad_delete', {
    when: 'AFTER',
    operation: 'DELETE',
    level: 'ROW',
    function: FUNCION_NAME,
  });
};

exports.down = (pgm) => {
  const FUNCION_NAME = 'f_sync_unidad_a_proyecto';

  // Borramos en orden inverso
  pgm.dropTrigger('unidades', 'tg_sync_unidad_delete');
  pgm.dropTrigger('unidades', 'tg_sync_unidad_insert_update');
  pgm.dropFunction(FUNCION_NAME);
};