//C:\SIRA\SIRA\backend\migrations\1759518402590_estructura-inicial-sira.js
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

pgm.sql(`

-- =================================================================
-- PRIMERO, DEFINIMOS LA FUNCIÓN QUE USARÁN LOS TRIGGERS
-- =================================================================
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$function$;
-- =================================================================
-- DROP TYPE public.orden_compra_status;

-- DROP FUNCTION public.f_actualizar_liquidacion_oc();

CREATE OR REPLACE FUNCTION public.f_actualizar_liquidacion_oc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_oc numeric(14,4);
    suma_pagos numeric(14,4);
    metodo_pago_actual varchar(50);
BEGIN
    SELECT total, metodo_pago
      INTO total_oc, metodo_pago_actual
      FROM public.ordenes_compra
      WHERE id = NEW.orden_compra_id;

    SELECT COALESCE(SUM(monto),0)
      INTO suma_pagos
      FROM public.pagos_oc
      WHERE orden_compra_id = NEW.orden_compra_id;

    IF (metodo_pago_actual IN ('SPEI','CREDITO')) THEN
        -- Si suma de pagos >= total, se liquida
        IF suma_pagos >= total_oc THEN
            UPDATE public.ordenes_compra
                SET pendiente_liquidar = false
                WHERE id = NEW.orden_compra_id;
        ELSE
            UPDATE public.ordenes_compra
                SET pendiente_liquidar = true
                WHERE id = NEW.orden_compra_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;

-- Permissions

ALTER FUNCTION public.f_actualizar_liquidacion_oc() OWNER TO postgres;
GRANT ALL ON FUNCTION public.f_actualizar_liquidacion_oc() TO postgres;

-- DROP FUNCTION public.f_generar_numero_requisicion();

CREATE OR REPLACE FUNCTION public.f_generar_numero_requisicion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    codigo_depto VARCHAR(10);
    consecutivo INTEGER;
    nuevo_numero VARCHAR(20);
BEGIN
    IF NEW.numero_requisicion IS NULL OR TRIM(NEW.numero_requisicion) = '' THEN
        -- Obtener código de departamento
        SELECT codigo INTO codigo_depto
        FROM departamentos
        WHERE id = NEW.departamento_id;

        -- Calcular el siguiente consecutivo por departamento
        SELECT
            COALESCE(
                MAX(
                    CAST(
                        REGEXP_REPLACE(numero_requisicion, codigo_depto || '_', '', 'g')
                        AS INTEGER
                    )
                ), 0
            ) + 1
            INTO consecutivo
        FROM requisiciones
        WHERE departamento_id = NEW.departamento_id
          AND numero_requisicion ~ ('^' || codigo_depto || '_[0-9]+$');

        -- Armar el nuevo número con ceros a la izquierda (4 dígitos)
        nuevo_numero := codigo_depto || '_' || LPAD(consecutivo::text, 4, '0');
        NEW.numero_requisicion := nuevo_numero;
    END IF;
    RETURN NEW;
END;
$function$
;

-- Permissions

ALTER FUNCTION public.f_generar_numero_requisicion() OWNER TO postgres;
GRANT ALL ON FUNCTION public.f_generar_numero_requisicion() TO postgres;

-- DROP FUNCTION public.f_procesar_recepcion_oc();

CREATE OR REPLACE FUNCTION public.f_procesar_recepcion_oc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  inv_id INTEGER;
  id_proyecto_stock INTEGER;
  oc_record RECORD;
BEGIN
  -- Obtener el ID del proyecto "STOCK ALMACEN"
  SELECT id INTO id_proyecto_stock
  FROM public.proyectos
  WHERE nombre = 'STOCK ALMACEN'
  LIMIT 1;

  -- Si no se encuentra el proyecto de stock, lanzar un error para evitar lógica incorrecta
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el proyecto "STOCK ALMACEN". Por favor, créelo antes de continuar.';
  END IF;

  -- Obtener sitio y proyecto desde la OC
  SELECT sitio_id, proyecto_id INTO oc_record
  FROM public.ordenes_compra
  WHERE id = NEW.orden_compra_id;

  -- Buscar o crear registro en inventario_actual para el material en la ubicación correspondiente
  SELECT id INTO inv_id
  FROM public.inventario_actual
  WHERE material_id = NEW.material_id AND ubicacion_id = oc_record.sitio_id;

  IF NOT FOUND THEN
    INSERT INTO public.inventario_actual (material_id, ubicacion_id)
    VALUES (NEW.material_id, oc_record.sitio_id)
    RETURNING id INTO inv_id;
  END IF;

  -- Decidir si es para stock o para asignación a un proyecto específico
  IF oc_record.proyecto_id = id_proyecto_stock THEN
    -- Si el proyecto es "STOCK ALMACEN", se suma al stock general disponible
    UPDATE public.inventario_actual
    SET stock_actual = stock_actual + NEW.cantidad
    WHERE id = inv_id;
  ELSE
    -- Si es cualquier otro proyecto, se considera material asignado
    UPDATE public.inventario_actual
    SET asignado = asignado + NEW.cantidad
    WHERE id = inv_id;

    -- Y se registra en la tabla de inventario asignado
    INSERT INTO public.inventario_asignado (
      inventario_id, requisicion_id, proyecto_id, sitio_id, cantidad, valor_unitario
    ) VALUES (
      inv_id, NEW.requisicion_detalle_id, oc_record.proyecto_id, oc_record.sitio_id,
      NEW.cantidad, NEW.valor_unitario
    );
  END IF;

  RETURN NEW;
END;
$function$
;

-- Permissions

ALTER FUNCTION public.f_procesar_recepcion_oc() OWNER TO postgres;
GRANT ALL ON FUNCTION public.f_procesar_recepcion_oc() TO postgres;

-- DROP FUNCTION public.f_recalcular_monto_pagado_oc();

CREATE OR REPLACE FUNCTION public.f_recalcular_monto_pagado_oc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  ocid int := COALESCE(NEW.orden_compra_id, OLD.orden_compra_id);
  total_pagado numeric(14,4);
BEGIN
  SELECT COALESCE(SUM(monto),0) INTO total_pagado
  FROM public.pagos_oc WHERE orden_compra_id = ocid;

  UPDATE public.ordenes_compra
  SET monto_pagado = total_pagado
  WHERE id = ocid;

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

-- Permissions

ALTER FUNCTION public.f_recalcular_monto_pagado_oc() OWNER TO postgres;
GRANT ALL ON FUNCTION public.f_recalcular_monto_pagado_oc() TO postgres;

-- DROP FUNCTION public.sync_cliente_en_proyecto();

CREATE OR REPLACE FUNCTION public.sync_cliente_en_proyecto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Obtenemos el cliente asociado al sitio
  SELECT cliente
    INTO NEW.cliente_id
  FROM public.sitios
  WHERE id = NEW.sitio_id;

  -- Si no existe el sitio, lanzamos error
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sitio inválido: %', NEW.sitio_id;
  END IF;

  RETURN NEW;
END;
$function$
;

-- DROP FUNCTION public.update_timestamp();

CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$function$
;

CREATE TYPE public.orden_compra_status AS ENUM (
	'POR_AUTORIZAR',
	'APROBADA',
	'RECHAZADA',
	'EN_PROCESO',
	'ENTREGADA',
	'CANCELADA',
	'HOLD',
	'CONFIRMAR_SPEI');

-- DROP TYPE public.requisicion_status;

CREATE TYPE public.requisicion_status AS ENUM (
	'ABIERTA',
	'COTIZANDO',
	'POR_APROBAR',
	'ESPERANDO_ENTREGA',
	'ENTREGADA',
	'CANCELADA');

-- DROP TYPE public.tipo_movimiento_inventario;

CREATE TYPE public.tipo_movimiento_inventario AS ENUM (
	'ENTRADA',
	'SALIDA',
	'AJUSTE_POSITIVO',
	'AJUSTE_NEGATIVO',
	'TRASPASO');

-- DROP SEQUENCE public.budget_id_seq;

CREATE SEQUENCE public.budget_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.budget_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.budget_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.budget_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.catalogo_materiales_id_seq;

CREATE SEQUENCE public.catalogo_materiales_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.catalogo_materiales_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.catalogo_materiales_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.catalogo_materiales_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.catalogo_unidades_id_seq;

CREATE SEQUENCE public.catalogo_unidades_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.catalogo_unidades_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.catalogo_unidades_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.catalogo_unidades_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.clientes_id_seq;

CREATE SEQUENCE public.clientes_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.clientes_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.clientes_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.clientes_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.departamentos_id_seq;

CREATE SEQUENCE public.departamentos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.departamentos_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.departamentos_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.departamentos_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.funciones_id_seq;

CREATE SEQUENCE public.funciones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.funciones_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.funciones_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.funciones_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.inventario_actual_id_seq;

CREATE SEQUENCE public.inventario_actual_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.inventario_actual_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.inventario_actual_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.inventario_actual_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.inventario_asignado_id_seq;

CREATE SEQUENCE public.inventario_asignado_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.inventario_asignado_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.inventario_asignado_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.inventario_asignado_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.movimientos_inventario_id_seq;

CREATE SEQUENCE public.movimientos_inventario_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.movimientos_inventario_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.movimientos_inventario_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.movimientos_inventario_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.notificacion_grupos_id_seq;

CREATE SEQUENCE public.notificacion_grupos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.notificacion_grupos_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.notificacion_grupos_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.notificacion_grupos_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.ordenes_compra_detalle_id_seq;

CREATE SEQUENCE public.ordenes_compra_detalle_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.ordenes_compra_detalle_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.ordenes_compra_detalle_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.ordenes_compra_detalle_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.ordenes_compra_historial_id_seq;

CREATE SEQUENCE public.ordenes_compra_historial_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.ordenes_compra_historial_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.ordenes_compra_historial_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.ordenes_compra_historial_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.ordenes_compra_id_seq;

CREATE SEQUENCE public.ordenes_compra_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.ordenes_compra_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.ordenes_compra_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.ordenes_compra_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.pagos_oc_id_seq;

CREATE SEQUENCE public.pagos_oc_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.pagos_oc_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.pagos_oc_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.pagos_oc_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.proveedores_id_seq;

CREATE SEQUENCE public.proveedores_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.proveedores_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.proveedores_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.proveedores_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.proyectos_id_seq;

CREATE SEQUENCE public.proyectos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.proyectos_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.proyectos_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.proyectos_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.recepciones_oc_id_seq;

CREATE SEQUENCE public.recepciones_oc_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.recepciones_oc_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.recepciones_oc_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.recepciones_oc_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.requisiciones_adjuntos_id_seq;

CREATE SEQUENCE public.requisiciones_adjuntos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.requisiciones_adjuntos_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_adjuntos_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_adjuntos_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.requisiciones_borradores_id_seq;

CREATE SEQUENCE public.requisiciones_borradores_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.requisiciones_borradores_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_borradores_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_borradores_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.requisiciones_detalle_id_seq;

CREATE SEQUENCE public.requisiciones_detalle_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.requisiciones_detalle_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_detalle_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_detalle_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.requisiciones_id_seq;

CREATE SEQUENCE public.requisiciones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.requisiciones_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.requisiciones_opciones_id_seq;

CREATE SEQUENCE public.requisiciones_opciones_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.requisiciones_opciones_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_opciones_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.requisiciones_opciones_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.rfq_consecutivo_seq;

CREATE SEQUENCE public.rfq_consecutivo_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 999999
	START 1
	CACHE 1
	NO CYCLE;
COMMENT ON SEQUENCE public.rfq_consecutivo_seq IS 'Secuencia global para los consecutivos de los RFQ.';

-- Permissions

ALTER SEQUENCE public.rfq_consecutivo_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.rfq_consecutivo_seq TO postgres;
GRANT ALL ON SEQUENCE public.rfq_consecutivo_seq TO sira_stg_user;

-- DROP SEQUENCE public.rfq_proveedor_adjuntos_id_seq;

CREATE SEQUENCE public.rfq_proveedor_adjuntos_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.rfq_proveedor_adjuntos_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.rfq_proveedor_adjuntos_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.rfq_proveedor_adjuntos_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.roles_id_seq;

CREATE SEQUENCE public.roles_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.roles_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.roles_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.sitios_id_seq;

CREATE SEQUENCE public.sitios_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.sitios_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.sitios_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.sitios_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.ubicaciones_almacen_id_seq;

CREATE SEQUENCE public.ubicaciones_almacen_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.ubicaciones_almacen_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.ubicaciones_almacen_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.ubicaciones_almacen_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.unidades_id_seq;

CREATE SEQUENCE public.unidades_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.unidades_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.unidades_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.unidades_id_seq TO sira_stg_user;

-- DROP SEQUENCE public.usuarios_id_seq;

CREATE SEQUENCE public.usuarios_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;
GRANT ALL ON SEQUENCE public.usuarios_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.usuarios_id_seq TO sira_stg_user;
-- public.catalogo_monedas definition

-- Drop table

-- DROP TABLE public.catalogo_monedas;

CREATE TABLE public.catalogo_monedas (
	codigo bpchar(3) NOT NULL,
	nombre varchar(50) NOT NULL,
	CONSTRAINT catalogo_monedas_pkey PRIMARY KEY (codigo)
);

-- Permissions

ALTER TABLE public.catalogo_monedas OWNER TO postgres;
GRANT ALL ON TABLE public.catalogo_monedas TO postgres;
GRANT ALL ON TABLE public.catalogo_monedas TO sira_stg_user;


-- public.catalogo_unidades definition

-- Drop table

-- DROP TABLE public.catalogo_unidades;

CREATE TABLE public.catalogo_unidades (
	id serial4 NOT NULL,
	unidad varchar(50) NOT NULL,
	simbolo varchar(10) NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT catalogo_unidades_pkey PRIMARY KEY (id),
	CONSTRAINT catalogo_unidades_simbolo_key UNIQUE (simbolo),
	CONSTRAINT catalogo_unidades_unidad_key UNIQUE (unidad)
);
CREATE INDEX idx_unidades_simbolo ON public.catalogo_unidades USING btree (simbolo);
CREATE INDEX idx_unidades_unidad ON public.catalogo_unidades USING btree (unidad);

-- Table Triggers

create trigger trg_catalogo_unidades_update before
update
    on
    public.catalogo_unidades for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.catalogo_unidades OWNER TO postgres;
GRANT ALL ON TABLE public.catalogo_unidades TO postgres;
GRANT ALL ON TABLE public.catalogo_unidades TO sira_stg_user;


-- public.clientes definition

-- Drop table

-- DROP TABLE public.clientes;

CREATE TABLE public.clientes (
	id serial4 NOT NULL,
	razon_social varchar(200) NOT NULL,
	rfc varchar(25) NOT NULL,
	creado_en timestamptz DEFAULT now() NULL,
	actualizado_en timestamptz DEFAULT now() NULL,
	CONSTRAINT clientes_pkey PRIMARY KEY (id),
	CONSTRAINT clientes_rfc_key UNIQUE (rfc)
);
CREATE INDEX idx_clientes_rfc ON public.clientes USING btree (rfc);

-- Table Triggers

create trigger trg_clientes_update before
update
    on
    public.clientes for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.clientes OWNER TO postgres;
GRANT ALL ON TABLE public.clientes TO postgres;
GRANT ALL ON TABLE public.clientes TO sira_stg_user;


-- public.departamentos definition

-- Drop table

-- DROP TABLE public.departamentos;

CREATE TABLE public.departamentos (
	id serial4 NOT NULL,
	codigo varchar(10) NOT NULL,
	nombre varchar(100) NOT NULL,
	creado_en timestamptz DEFAULT now() NULL,
	actualizado_en timestamptz DEFAULT now() NULL,
	CONSTRAINT departamentos_codigo_key UNIQUE (codigo),
	CONSTRAINT departamentos_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger trg_departamentos_update before
update
    on
    public.departamentos for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.departamentos OWNER TO postgres;
GRANT ALL ON TABLE public.departamentos TO postgres;
GRANT ALL ON TABLE public.departamentos TO sira_stg_user;


-- public.funciones definition

-- Drop table

-- DROP TABLE public.funciones;

CREATE TABLE public.funciones (
	id serial4 NOT NULL,
	codigo varchar(20) NOT NULL,
	nombre varchar(100) NOT NULL,
	modulo varchar(50) NULL,
	CONSTRAINT funciones_codigo_key UNIQUE (codigo),
	CONSTRAINT funciones_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE public.funciones OWNER TO postgres;
GRANT ALL ON TABLE public.funciones TO postgres;
GRANT ALL ON TABLE public.funciones TO sira_stg_user;


-- public.notificacion_grupos definition

-- Drop table

-- DROP TABLE public.notificacion_grupos;

CREATE TABLE public.notificacion_grupos (
	id serial4 NOT NULL,
	codigo varchar(50) NOT NULL, -- Código único usado por el sistema para identificar el grupo. No debe cambiarse.
	nombre varchar(150) NOT NULL,
	descripcion text NULL,
	CONSTRAINT notificacion_grupos_codigo_key UNIQUE (codigo),
	CONSTRAINT notificacion_grupos_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE public.notificacion_grupos IS 'Almacena grupos de notificación para diferentes eventos del sistema.';

-- Column comments

COMMENT ON COLUMN public.notificacion_grupos.codigo IS 'Código único usado por el sistema para identificar el grupo. No debe cambiarse.';

-- Permissions

ALTER TABLE public.notificacion_grupos OWNER TO postgres;
GRANT ALL ON TABLE public.notificacion_grupos TO postgres;
GRANT ALL ON TABLE public.notificacion_grupos TO sira_stg_user;


-- public.parametros_sistema definition

-- Drop table

-- DROP TABLE public.parametros_sistema;

CREATE TABLE public.parametros_sistema (
	clave text NOT NULL,
	valor text NOT NULL,
	CONSTRAINT parametros_sistema_pkey PRIMARY KEY (clave)
);

-- Permissions

ALTER TABLE public.parametros_sistema OWNER TO postgres;
GRANT ALL ON TABLE public.parametros_sistema TO postgres;
GRANT ALL ON TABLE public.parametros_sistema TO sira_stg_user;


-- public.proveedores definition

-- Drop table

-- DROP TABLE public.proveedores;

CREATE TABLE public.proveedores (
	id serial4 NOT NULL,
	marca varchar(100) NOT NULL,
	razon_social varchar(150) NOT NULL,
	rfc varchar(20) NOT NULL,
	contacto varchar(100) NULL,
	telefono varchar(20) NULL,
	correo varchar(150) NULL,
	direccion text NULL,
	web varchar(200) NULL,
	comentarios text NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	dias_credito int4 NULL,
	CONSTRAINT proveedores_pkey PRIMARY KEY (id),
	CONSTRAINT proveedores_rfc_key UNIQUE (rfc)
);
CREATE INDEX idx_proveedores_marca ON public.proveedores USING btree (marca);
CREATE INDEX idx_proveedores_rfc ON public.proveedores USING btree (rfc);

-- Table Triggers

create trigger trg_proveedores_update before
update
    on
    public.proveedores for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.proveedores OWNER TO postgres;
GRANT ALL ON TABLE public.proveedores TO postgres;
GRANT ALL ON TABLE public.proveedores TO sira_stg_user;


-- public.roles definition

-- Drop table

-- DROP TABLE public.roles;

CREATE TABLE public.roles (
	id serial4 NOT NULL,
	codigo varchar(30) NOT NULL,
	nombre varchar(100) NOT NULL,
	creado_en timestamptz DEFAULT now() NULL,
	actualizado_en timestamptz DEFAULT now() NULL,
	CONSTRAINT roles_codigo_key UNIQUE (codigo),
	CONSTRAINT roles_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger trg_roles_update before
update
    on
    public.roles for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.roles OWNER TO postgres;
GRANT ALL ON TABLE public.roles TO postgres;
GRANT ALL ON TABLE public.roles TO sira_stg_user;


-- public.ubicaciones_almacen definition

-- Drop table

-- DROP TABLE public.ubicaciones_almacen;

CREATE TABLE public.ubicaciones_almacen (
	id serial4 NOT NULL,
	nombre varchar(100) NOT NULL,
	codigo varchar(20) NOT NULL,
	descripcion text NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT ubicaciones_almacen_codigo_key UNIQUE (codigo),
	CONSTRAINT ubicaciones_almacen_nombre_key UNIQUE (nombre),
	CONSTRAINT ubicaciones_almacen_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_ubicaciones_codigo ON public.ubicaciones_almacen USING btree (codigo);
CREATE INDEX idx_ubicaciones_nombre ON public.ubicaciones_almacen USING btree (nombre);

-- Table Triggers

create trigger trg_ubicaciones_almacen_update before
update
    on
    public.ubicaciones_almacen for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.ubicaciones_almacen OWNER TO postgres;
GRANT ALL ON TABLE public.ubicaciones_almacen TO postgres;
GRANT ALL ON TABLE public.ubicaciones_almacen TO sira_stg_user;


-- public.catalogo_materiales definition

-- Drop table

-- DROP TABLE public.catalogo_materiales;

CREATE TABLE public.catalogo_materiales (
	id serial4 NOT NULL,
	tipo varchar(50) NOT NULL,
	categoria varchar(50) NOT NULL,
	detalle varchar(50) NOT NULL,
	sku varchar(50) NULL,
	unidad_de_compra int4 NOT NULL,
	ultimo_precio varchar(50) NOT NULL,
	activo bool DEFAULT true NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	nombre varchar(150) GENERATED ALWAYS AS ((((((COALESCE(tipo, ''::character varying)::text || ' '::text) || COALESCE(categoria, ''::character varying)::text) || ' '::text) || COALESCE(detalle, ''::character varying)::text))) STORED NULL,
	CONSTRAINT catalogo_materiales_nombre_key UNIQUE (nombre),
	CONSTRAINT catalogo_materiales_pkey PRIMARY KEY (id),
	CONSTRAINT catalogo_materiales_unidad_de_compra_fkey FOREIGN KEY (unidad_de_compra) REFERENCES public.catalogo_unidades(id)
);
CREATE INDEX idx_mat_categoria ON public.catalogo_materiales USING btree (categoria);
CREATE INDEX idx_mat_detalle ON public.catalogo_materiales USING btree (detalle);
CREATE INDEX idx_mat_tipo ON public.catalogo_materiales USING btree (tipo);

-- Table Triggers

create trigger trg_catalogo_materiales_update before
update
    on
    public.catalogo_materiales for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.catalogo_materiales OWNER TO postgres;
GRANT ALL ON TABLE public.catalogo_materiales TO postgres;
GRANT ALL ON TABLE public.catalogo_materiales TO sira_stg_user;


-- public.inventario_actual definition

-- Drop table

-- DROP TABLE public.inventario_actual;

CREATE TABLE public.inventario_actual (
	id serial4 NOT NULL,
	material_id int4 NOT NULL,
	ubicacion_id int4 NOT NULL,
	stock_actual numeric(12, 2) DEFAULT 0 NOT NULL,
	stock_minimo numeric(12, 2) DEFAULT 0 NOT NULL,
	stock_maximo numeric(12, 2) DEFAULT 0 NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	asignado numeric(12, 2) DEFAULT 0 NOT NULL,
	existencia_total numeric(12, 2) GENERATED ALWAYS AS ((stock_actual + asignado)) STORED NULL,
	CONSTRAINT inventario_actual_pkey PRIMARY KEY (id),
	CONSTRAINT uq_inv_material_ubicacion UNIQUE (material_id, ubicacion_id),
	CONSTRAINT inventario_actual_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.catalogo_materiales(id) ON DELETE RESTRICT,
	CONSTRAINT inventario_actual_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones_almacen(id) ON DELETE RESTRICT
);
CREATE INDEX idx_inv_material ON public.inventario_actual USING btree (material_id);
CREATE INDEX idx_inv_stock_actual ON public.inventario_actual USING btree (stock_actual);
CREATE INDEX idx_inv_ubicacion ON public.inventario_actual USING btree (ubicacion_id);

-- Table Triggers

create trigger trg_inventario_actual_update before
update
    on
    public.inventario_actual for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.inventario_actual OWNER TO postgres;
GRANT ALL ON TABLE public.inventario_actual TO postgres;
GRANT ALL ON TABLE public.inventario_actual TO sira_stg_user;


-- public.rol_funcion definition

-- Drop table

-- DROP TABLE public.rol_funcion;

CREATE TABLE public.rol_funcion (
	rol_id int4 NOT NULL,
	funcion_id int4 NOT NULL,
	CONSTRAINT pk_rol_funcion PRIMARY KEY (rol_id, funcion_id),
	CONSTRAINT fk_funcion FOREIGN KEY (funcion_id) REFERENCES public.funciones(id) ON DELETE CASCADE,
	CONSTRAINT fk_rol FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE CASCADE
);

-- Permissions

ALTER TABLE public.rol_funcion OWNER TO postgres;
GRANT ALL ON TABLE public.rol_funcion TO postgres;
GRANT ALL ON TABLE public.rol_funcion TO sira_stg_user;


-- public.sitios definition

-- Drop table

-- DROP TABLE public.sitios;

CREATE TABLE public.sitios (
	id serial4 NOT NULL,
	nombre varchar(200) NOT NULL,
	cliente int4 NOT NULL,
	ubicacion varchar(200) NOT NULL,
	creado_en timestamptz DEFAULT now() NULL,
	actualizado_en timestamptz DEFAULT now() NULL,
	CONSTRAINT sitios_nombre_key UNIQUE (nombre),
	CONSTRAINT sitios_pkey PRIMARY KEY (id),
	CONSTRAINT sitios_cliente_fkey FOREIGN KEY (cliente) REFERENCES public.clientes(id)
);
CREATE INDEX idx_sitios_nombre ON public.sitios USING btree (nombre);

-- Table Triggers

create trigger trg_sitios_update before
update
    on
    public.sitios for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.sitios OWNER TO postgres;
GRANT ALL ON TABLE public.sitios TO postgres;
GRANT ALL ON TABLE public.sitios TO sira_stg_user;


-- public.usuarios definition

-- Drop table

-- DROP TABLE public.usuarios;

CREATE TABLE public.usuarios (
	id serial4 NOT NULL,
	nombre varchar(100) NOT NULL,
	correo varchar(150) NOT NULL,
	whatsapp varchar(20) NULL,
	role_id int4 NOT NULL,
	departamento_id int4 NOT NULL,
	activo bool DEFAULT true NULL,
	creado_en timestamptz DEFAULT now() NULL,
	actualizado_en timestamptz DEFAULT now() NULL,
	es_superusuario bool DEFAULT false NOT NULL,
	correo_google varchar(150) NULL,
	CONSTRAINT usuarios_correo_google_key UNIQUE (correo_google),
	CONSTRAINT usuarios_correo_key UNIQUE (correo),
	CONSTRAINT usuarios_pkey PRIMARY KEY (id),
	CONSTRAINT usuarios_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamentos(id),
	CONSTRAINT usuarios_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);
CREATE INDEX idx_usuarios_correo ON public.usuarios USING btree (correo);

-- Table Triggers

create trigger trg_usuarios_update before
update
    on
    public.usuarios for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.usuarios OWNER TO postgres;
GRANT ALL ON TABLE public.usuarios TO postgres;
GRANT ALL ON TABLE public.usuarios TO sira_stg_user;


-- public.notificacion_grupo_usuarios definition

-- Drop table

-- DROP TABLE public.notificacion_grupo_usuarios;

CREATE TABLE public.notificacion_grupo_usuarios (
	grupo_id int4 NOT NULL,
	usuario_id int4 NOT NULL,
	CONSTRAINT notificacion_grupo_usuarios_pkey PRIMARY KEY (grupo_id, usuario_id),
	CONSTRAINT fk_grupo FOREIGN KEY (grupo_id) REFERENCES public.notificacion_grupos(id) ON DELETE CASCADE,
	CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.notificacion_grupo_usuarios IS 'Tabla intermedia para la relación muchos-a-muchos entre grupos y usuarios.';

-- Permissions

ALTER TABLE public.notificacion_grupo_usuarios OWNER TO postgres;
GRANT ALL ON TABLE public.notificacion_grupo_usuarios TO postgres;
GRANT ALL ON TABLE public.notificacion_grupo_usuarios TO sira_stg_user;


-- public.proyectos definition

-- Drop table

-- DROP TABLE public.proyectos;

CREATE TABLE public.proyectos (
	id serial4 NOT NULL,
	nombre varchar(100) NOT NULL,
	descripcion varchar(400) NOT NULL,
	responsable_id int4 NOT NULL,
	sitio_id int4 NOT NULL,
	cliente_id int4 NOT NULL,
	activo bool DEFAULT true NULL,
	creado_en timestamptz DEFAULT now() NULL,
	actualizado_en timestamptz DEFAULT now() NULL,
	CONSTRAINT proyectos_pkey PRIMARY KEY (id),
	CONSTRAINT proyectos_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.usuarios(id),
	CONSTRAINT proyectos_sitio_id_fkey FOREIGN KEY (sitio_id) REFERENCES public.sitios(id)
);
CREATE INDEX idx_proyectos_cliente_id ON public.proyectos USING btree (cliente_id);
CREATE INDEX idx_proyectos_sitio_id ON public.proyectos USING btree (sitio_id);

-- Table Triggers

create trigger trg_proyectos_sync_cliente before
insert
    or
update
    on
    public.proyectos for each row execute function sync_cliente_en_proyecto();
create trigger trg_proyectos_update before
update
    on
    public.proyectos for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.proyectos OWNER TO postgres;
GRANT ALL ON TABLE public.proyectos TO postgres;
GRANT ALL ON TABLE public.proyectos TO sira_stg_user;


-- public.requisiciones definition

-- Drop table

-- DROP TABLE public.requisiciones;

CREATE TABLE public.requisiciones (
	id serial4 NOT NULL,
	numero_requisicion varchar(50) NOT NULL,
	usuario_id int4 NOT NULL,
	departamento_id int4 NOT NULL,
	sitio_id int4 NOT NULL,
	proyecto_id int4 NOT NULL,
	fecha_creacion timestamptz DEFAULT now() NOT NULL,
	fecha_requerida date NOT NULL,
	lugar_entrega varchar(200) NOT NULL,
	status public.requisicion_status DEFAULT 'ABIERTA'::requisicion_status NOT NULL,
	rfq_code varchar(50) NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	comentario varchar(2000) NULL,
	CONSTRAINT requisiciones_numero_requisicion_key UNIQUE (numero_requisicion),
	CONSTRAINT requisiciones_pkey PRIMARY KEY (id),
	CONSTRAINT requisiciones_rfq_code_key UNIQUE (rfq_code),
	CONSTRAINT requisiciones_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamentos(id),
	CONSTRAINT requisiciones_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id),
	CONSTRAINT requisiciones_sitio_id_fkey FOREIGN KEY (sitio_id) REFERENCES public.sitios(id),
	CONSTRAINT requisiciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE INDEX idx_req_departamento_id ON public.requisiciones USING btree (departamento_id);
CREATE INDEX idx_req_sitio_id ON public.requisiciones USING btree (sitio_id);
CREATE INDEX idx_req_status ON public.requisiciones USING btree (status);
CREATE INDEX idx_req_usuario_id ON public.requisiciones USING btree (usuario_id);

-- Table Triggers

create trigger trg_requisiciones_update before
update
    on
    public.requisiciones for each row execute function update_timestamp();
create trigger trg_generar_numero_requisicion before
insert
    on
    public.requisiciones for each row execute function f_generar_numero_requisicion();

-- Permissions

ALTER TABLE public.requisiciones OWNER TO postgres;
GRANT ALL ON TABLE public.requisiciones TO postgres;
GRANT ALL ON TABLE public.requisiciones TO sira_stg_user;


-- public.requisiciones_adjuntos definition

-- Drop table

-- DROP TABLE public.requisiciones_adjuntos;

CREATE TABLE public.requisiciones_adjuntos (
	id serial4 NOT NULL,
	requisicion_id int4 NOT NULL,
	nombre_archivo varchar(255) NOT NULL,
	ruta_archivo text NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT requisiciones_adjuntos_pkey PRIMARY KEY (id),
	CONSTRAINT requisiciones_adjuntos_requisicion_id_fkey FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE
);

-- Permissions

ALTER TABLE public.requisiciones_adjuntos OWNER TO postgres;
GRANT ALL ON TABLE public.requisiciones_adjuntos TO postgres;
GRANT ALL ON TABLE public.requisiciones_adjuntos TO sira_stg_user;


-- public.requisiciones_borradores definition

-- Drop table

-- DROP TABLE public.requisiciones_borradores;

CREATE TABLE public.requisiciones_borradores (
	id serial4 NOT NULL,
	usuario_id int4 NOT NULL,
	"data" jsonb NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT requisiciones_borradores_pkey PRIMARY KEY (id),
	CONSTRAINT uq_borrador_usuario UNIQUE (usuario_id),
	CONSTRAINT requisiciones_borradores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE
);
CREATE INDEX idx_borradores_usuario ON public.requisiciones_borradores USING btree (usuario_id);

-- Permissions

ALTER TABLE public.requisiciones_borradores OWNER TO postgres;
GRANT ALL ON TABLE public.requisiciones_borradores TO postgres;
GRANT ALL ON TABLE public.requisiciones_borradores TO sira_stg_user;


-- public.requisiciones_detalle definition

-- Drop table

-- DROP TABLE public.requisiciones_detalle;

CREATE TABLE public.requisiciones_detalle (
	id serial4 NOT NULL,
	requisicion_id int4 NOT NULL,
	material_id int4 NOT NULL,
	cantidad numeric(7, 2) NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	comentario varchar(2000) NULL,
	status_compra varchar(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
	cantidad_procesada numeric(12, 2) DEFAULT 0 NOT NULL, -- Suma de las cantidades de este material que ya han sido incluidas en una OC.
	CONSTRAINT chk_req_det_cant CHECK ((cantidad > (0)::numeric)),
	CONSTRAINT requisiciones_detalle_pkey PRIMARY KEY (id),
	CONSTRAINT uq_req_detalle_mat UNIQUE (requisicion_id, material_id),
	CONSTRAINT requisiciones_detalle_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.catalogo_materiales(id),
	CONSTRAINT requisiciones_detalle_requisicion_id_fkey FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE
);
CREATE INDEX idx_detalle_material_id ON public.requisiciones_detalle USING btree (material_id);
CREATE INDEX idx_detalle_req_id ON public.requisiciones_detalle USING btree (requisicion_id);

-- Column comments

COMMENT ON COLUMN public.requisiciones_detalle.cantidad_procesada IS 'Suma de las cantidades de este material que ya han sido incluidas en una OC.';

-- Table Triggers

create trigger trg_requisiciones_detalle_update before
update
    on
    public.requisiciones_detalle for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.requisiciones_detalle OWNER TO postgres;
GRANT ALL ON TABLE public.requisiciones_detalle TO postgres;
GRANT ALL ON TABLE public.requisiciones_detalle TO sira_stg_user;


-- public.requisiciones_opciones definition

-- Drop table

-- DROP TABLE public.requisiciones_opciones;

CREATE TABLE public.requisiciones_opciones (
	id serial4 NOT NULL,
	requisicion_id int4 NOT NULL,
	requisicion_detalle_id int4 NOT NULL,
	proveedor_id int4 NOT NULL,
	precio_unitario numeric(14, 4) NOT NULL,
	moneda bpchar(3) NOT NULL,
	plazo_entrega varchar(100) NULL,
	condiciones_pago varchar(100) NULL,
	comentario text NULL,
	seleccionado bool DEFAULT false NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	cantidad_cotizada numeric(12, 2) DEFAULT 0 NOT NULL, -- La cantidad específica que se cotiza con este proveedor, para permitir compras divididas.
	es_precio_neto bool DEFAULT false NOT NULL, -- TRUE si el precio unitario ya incluye IVA, FALSE si es más IVA.
	es_importacion bool DEFAULT false NOT NULL, -- TRUE si el material debe ser importado.
	es_entrega_inmediata bool DEFAULT true NOT NULL, -- TRUE si el proveedor ofrece entrega inmediata.
	tiempo_entrega varchar(100) NULL, -- Descripción del tiempo de entrega si no es inmediata (ej. "5 días hábiles").
	tiempo_entrega_valor int4 NULL, -- Valor numérico del tiempo de entrega (ej. 5).
	tiempo_entrega_unidad varchar(20) NULL, -- Unidad del tiempo de entrega (ej. 'dias', 'semanas').
	subtotal numeric(14, 4) NULL, -- Subtotal calculado para esta opción de compra.
	iva numeric(14, 4) NULL, -- Monto de IVA calculado.
	ret_isr numeric(14, 4) NULL, -- Monto de retención de ISR calculado.
	total numeric(14, 4) NULL, -- Total final (calculado o forzado).
	config_calculo jsonb NULL, -- Objeto JSON que almacena la configuración usada para el cálculo (tasas, switches).
	es_total_forzado bool DEFAULT false NULL, -- TRUE si el campo "total" fue introducido manualmente por el usuario.
	CONSTRAINT requisiciones_opciones_pkey PRIMARY KEY (id),
	CONSTRAINT fk_reqop_moneda FOREIGN KEY (moneda) REFERENCES public.catalogo_monedas(codigo),
	CONSTRAINT requisiciones_opciones_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id),
	CONSTRAINT requisiciones_opciones_requisicion_detalle_id_fkey FOREIGN KEY (requisicion_detalle_id) REFERENCES public.requisiciones_detalle(id) ON DELETE CASCADE,
	CONSTRAINT requisiciones_opciones_requisicion_id_fkey FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE
);
CREATE INDEX idx_opts_detalle_id ON public.requisiciones_opciones USING btree (requisicion_detalle_id);
CREATE INDEX idx_opts_proveedor_id ON public.requisiciones_opciones USING btree (proveedor_id);
CREATE INDEX idx_opts_req_id ON public.requisiciones_opciones USING btree (requisicion_id);

-- Column comments

COMMENT ON COLUMN public.requisiciones_opciones.cantidad_cotizada IS 'La cantidad específica que se cotiza con este proveedor, para permitir compras divididas.';
COMMENT ON COLUMN public.requisiciones_opciones.es_precio_neto IS 'TRUE si el precio unitario ya incluye IVA, FALSE si es más IVA.';
COMMENT ON COLUMN public.requisiciones_opciones.es_importacion IS 'TRUE si el material debe ser importado.';
COMMENT ON COLUMN public.requisiciones_opciones.es_entrega_inmediata IS 'TRUE si el proveedor ofrece entrega inmediata.';
COMMENT ON COLUMN public.requisiciones_opciones.tiempo_entrega IS 'Descripción del tiempo de entrega si no es inmediata (ej. "5 días hábiles").';
COMMENT ON COLUMN public.requisiciones_opciones.tiempo_entrega_valor IS 'Valor numérico del tiempo de entrega (ej. 5).';
COMMENT ON COLUMN public.requisiciones_opciones.tiempo_entrega_unidad IS 'Unidad del tiempo de entrega (ej. ''dias'', ''semanas'').';
COMMENT ON COLUMN public.requisiciones_opciones.subtotal IS 'Subtotal calculado para esta opción de compra.';
COMMENT ON COLUMN public.requisiciones_opciones.iva IS 'Monto de IVA calculado.';
COMMENT ON COLUMN public.requisiciones_opciones.ret_isr IS 'Monto de retención de ISR calculado.';
COMMENT ON COLUMN public.requisiciones_opciones.total IS 'Total final (calculado o forzado).';
COMMENT ON COLUMN public.requisiciones_opciones.config_calculo IS 'Objeto JSON que almacena la configuración usada para el cálculo (tasas, switches).';
COMMENT ON COLUMN public.requisiciones_opciones.es_total_forzado IS 'TRUE si el campo "total" fue introducido manualmente por el usuario.';

-- Permissions

ALTER TABLE public.requisiciones_opciones OWNER TO postgres;
GRANT ALL ON TABLE public.requisiciones_opciones TO postgres;
GRANT ALL ON TABLE public.requisiciones_opciones TO sira_stg_user;


-- public.rfq_proveedor_adjuntos definition

-- Drop table

-- DROP TABLE public.rfq_proveedor_adjuntos;

CREATE TABLE public.rfq_proveedor_adjuntos (
	id serial4 NOT NULL,
	requisicion_id int4 NOT NULL,
	proveedor_id int4 NOT NULL,
	nombre_archivo varchar(255) NOT NULL,
	ruta_archivo text NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT rfq_proveedor_adjuntos_pkey PRIMARY KEY (id),
	CONSTRAINT fk_proveedor FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE CASCADE,
	CONSTRAINT fk_requisicion FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.rfq_proveedor_adjuntos IS 'Almacena los archivos de cotización (PDFs, etc.) que un proveedor envía para un RFQ específico.';

-- Permissions

ALTER TABLE public.rfq_proveedor_adjuntos OWNER TO postgres;
GRANT ALL ON TABLE public.rfq_proveedor_adjuntos TO postgres;
GRANT ALL ON TABLE public.rfq_proveedor_adjuntos TO sira_stg_user;


-- public.unidades definition

-- Drop table

-- DROP TABLE public.unidades;

CREATE TABLE public.unidades (
	id serial4 NOT NULL,
	marca varchar(100) NOT NULL,
	unidad varchar(100) NOT NULL,
	serie varchar(100) NOT NULL,
	placas varchar(20) NOT NULL,
	modelo int4 NOT NULL,
	no_eco int4 NOT NULL,
	km int4 NULL,
	responsable_id int4 DEFAULT 7 NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT chk_km_positivo CHECK ((km >= 0)),
	CONSTRAINT unidades_no_eco_key UNIQUE (no_eco),
	CONSTRAINT unidades_pkey PRIMARY KEY (id),
	CONSTRAINT unidades_serie_key UNIQUE (serie),
	CONSTRAINT fk_unidades_responsable FOREIGN KEY (responsable_id) REFERENCES public.usuarios(id)
);
CREATE INDEX idx_unidades_no_eco ON public.unidades USING btree (no_eco);
CREATE INDEX idx_unidades_serie ON public.unidades USING btree (serie);

-- Table Triggers

create trigger trg_unidades_update before
update
    on
    public.unidades for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.unidades OWNER TO postgres;
GRANT ALL ON TABLE public.unidades TO postgres;
GRANT ALL ON TABLE public.unidades TO sira_stg_user;


-- public.budget definition

-- Drop table

-- DROP TABLE public.budget;

CREATE TABLE public.budget (
	id serial4 NOT NULL,
	proyecto_id int4 NOT NULL,
	responsable_id int4 NOT NULL,
	monto_asignado numeric(14, 4) NOT NULL,
	monto_utilizado numeric(14, 4) NOT NULL,
	currency varchar(10) NOT NULL,
	recurrencia varchar(29) NOT NULL,
	periodo_inicio date NULL,
	periodo_fin date NULL,
	creado_en timestamptz DEFAULT now() NULL,
	actualizado_en timestamptz DEFAULT now() NULL,
	CONSTRAINT budget_pkey PRIMARY KEY (id),
	CONSTRAINT chk_budget_asig CHECK ((monto_asignado >= (0)::numeric)),
	CONSTRAINT chk_budget_used CHECK ((monto_utilizado >= (0)::numeric)),
	CONSTRAINT budget_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id),
	CONSTRAINT budget_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.usuarios(id)
);
CREATE INDEX idx_budget_proyecto ON public.budget USING btree (proyecto_id);

-- Table Triggers

create trigger trg_budget_update before
update
    on
    public.budget for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.budget OWNER TO postgres;
GRANT ALL ON TABLE public.budget TO postgres;
GRANT ALL ON TABLE public.budget TO sira_stg_user;


-- public.inventario_asignado definition

-- Drop table

-- DROP TABLE public.inventario_asignado;

CREATE TABLE public.inventario_asignado (
	id serial4 NOT NULL,
	inventario_id int4 NOT NULL,
	requisicion_id int4 NOT NULL,
	proyecto_id int4 NOT NULL,
	sitio_id int4 NOT NULL,
	cantidad numeric(12, 2) NOT NULL,
	valor_unitario numeric(14, 4) NOT NULL,
	asignado_en timestamptz DEFAULT now() NULL,
	CONSTRAINT inventario_asignado_cantidad_check CHECK ((cantidad > (0)::numeric)),
	CONSTRAINT inventario_asignado_pkey PRIMARY KEY (id),
	CONSTRAINT inventario_asignado_inventario_id_fkey FOREIGN KEY (inventario_id) REFERENCES public.inventario_actual(id) ON DELETE CASCADE,
	CONSTRAINT inventario_asignado_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id),
	CONSTRAINT inventario_asignado_requisicion_id_fkey FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id),
	CONSTRAINT inventario_asignado_sitio_id_fkey FOREIGN KEY (sitio_id) REFERENCES public.sitios(id)
);

-- Permissions

ALTER TABLE public.inventario_asignado OWNER TO postgres;
GRANT ALL ON TABLE public.inventario_asignado TO postgres;
GRANT ALL ON TABLE public.inventario_asignado TO sira_stg_user;


-- public.ordenes_compra definition

-- Drop table

-- DROP TABLE public.ordenes_compra;

CREATE TABLE public.ordenes_compra (
	id serial4 NOT NULL,
	numero_oc varchar(20) NOT NULL,
	usuario_id int4 NOT NULL,
	rfq_id int4 NOT NULL,
	sitio_id int4 NOT NULL,
	proyecto_id int4 NOT NULL,
	fecha_creacion timestamptz DEFAULT now() NOT NULL,
	lugar_entrega varchar(200) NOT NULL,
	comentario text NULL,
	status public.orden_compra_status DEFAULT 'POR_AUTORIZAR'::orden_compra_status NOT NULL,
	sub_total numeric(14, 4) NOT NULL,
	iva numeric(14, 4) NOT NULL,
	total numeric(14, 4) NOT NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	impo bool DEFAULT false NULL,
	proveedor_id int4 NULL, -- ID del proveedor al que se le emite esta Orden de Compra.
	metodo_pago varchar(50) NULL,
	fecha_vencimiento_pago date NULL,
	hold_regresar_en date NULL,
	comprobante_pago_link text NULL,
	monto_pagado numeric(14, 4) NULL,
	pendiente_liquidar bool DEFAULT false NOT NULL, -- TRUE si la OC está pendiente de liquidar (por anticipos o crédito); FALSE si está liquidada.
	CONSTRAINT ordenes_compra_numero_oc_key UNIQUE (numero_oc),
	CONSTRAINT ordenes_compra_pkey PRIMARY KEY (id),
	CONSTRAINT fk_oc_proveedor FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE SET NULL,
	CONSTRAINT ordenes_compra_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id),
	CONSTRAINT ordenes_compra_rfq_id_fkey FOREIGN KEY (rfq_id) REFERENCES public.requisiciones(id),
	CONSTRAINT ordenes_compra_sitio_id_fkey FOREIGN KEY (sitio_id) REFERENCES public.sitios(id),
	CONSTRAINT ordenes_compra_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE INDEX idx_oc_proyecto ON public.ordenes_compra USING btree (proyecto_id);
CREATE INDEX idx_oc_rfq ON public.ordenes_compra USING btree (rfq_id);
CREATE INDEX idx_oc_sitio ON public.ordenes_compra USING btree (sitio_id);
CREATE INDEX idx_oc_status ON public.ordenes_compra USING btree (status);
CREATE INDEX idx_oc_usuario ON public.ordenes_compra USING btree (usuario_id);

-- Column comments

COMMENT ON COLUMN public.ordenes_compra.proveedor_id IS 'ID del proveedor al que se le emite esta Orden de Compra.';
COMMENT ON COLUMN public.ordenes_compra.pendiente_liquidar IS 'TRUE si la OC está pendiente de liquidar (por anticipos o crédito); FALSE si está liquidada.';

-- Table Triggers

create trigger trg_ordenes_compra_update before
update
    on
    public.ordenes_compra for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.ordenes_compra OWNER TO postgres;
GRANT ALL ON TABLE public.ordenes_compra TO postgres;
GRANT ALL ON TABLE public.ordenes_compra TO sira_stg_user;


-- public.ordenes_compra_detalle definition

-- Drop table

-- DROP TABLE public.ordenes_compra_detalle;

CREATE TABLE public.ordenes_compra_detalle (
	id serial4 NOT NULL,
	orden_compra_id int4 NOT NULL,
	requisicion_detalle_id int4 NOT NULL,
	comparativa_precio_id int4 NOT NULL,
	material_id int4 NOT NULL,
	cantidad numeric(7, 2) NOT NULL,
	precio_unitario numeric(14, 4) NOT NULL,
	moneda bpchar(3) NOT NULL,
	plazo_entrega varchar(100) NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	actualizado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT chk_ocd_cant CHECK ((cantidad > (0)::numeric)),
	CONSTRAINT chk_ocd_precio CHECK ((precio_unitario >= (0)::numeric)),
	CONSTRAINT ordenes_compra_detalle_pkey PRIMARY KEY (id),
	CONSTRAINT fk_ocd_moneda FOREIGN KEY (moneda) REFERENCES public.catalogo_monedas(codigo),
	CONSTRAINT ordenes_compra_detalle_comparativa_precio_id_fkey FOREIGN KEY (comparativa_precio_id) REFERENCES public.requisiciones_opciones(id),
	CONSTRAINT ordenes_compra_detalle_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.catalogo_materiales(id),
	CONSTRAINT ordenes_compra_detalle_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
	CONSTRAINT ordenes_compra_detalle_requisicion_detalle_id_fkey FOREIGN KEY (requisicion_detalle_id) REFERENCES public.requisiciones_detalle(id) ON DELETE CASCADE
);
CREATE INDEX idx_ocd_comp_precio_id ON public.ordenes_compra_detalle USING btree (comparativa_precio_id);
CREATE INDEX idx_ocd_material_id ON public.ordenes_compra_detalle USING btree (material_id);
CREATE INDEX idx_ocd_oc_id ON public.ordenes_compra_detalle USING btree (orden_compra_id);
CREATE INDEX idx_ocd_req_detalle_id ON public.ordenes_compra_detalle USING btree (requisicion_detalle_id);

-- Table Triggers

create trigger trg_ordenes_compra_detalle_update before
update
    on
    public.ordenes_compra_detalle for each row execute function update_timestamp();

-- Permissions

ALTER TABLE public.ordenes_compra_detalle OWNER TO postgres;
GRANT ALL ON TABLE public.ordenes_compra_detalle TO postgres;
GRANT ALL ON TABLE public.ordenes_compra_detalle TO sira_stg_user;


-- public.ordenes_compra_historial definition

-- Drop table

-- DROP TABLE public.ordenes_compra_historial;

CREATE TABLE public.ordenes_compra_historial (
	id serial4 NOT NULL,
	orden_compra_id int4 NOT NULL,
	usuario_id int4 NULL,
	accion_realizada varchar(255) NOT NULL,
	detalles jsonb NULL,
	fecha_registro timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT ordenes_compra_historial_pkey PRIMARY KEY (id),
	CONSTRAINT fk_orden_compra FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
	CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL
);
CREATE INDEX idx_historial_orden_compra_id ON public.ordenes_compra_historial USING btree (orden_compra_id);

-- Permissions

ALTER TABLE public.ordenes_compra_historial OWNER TO postgres;
GRANT ALL ON TABLE public.ordenes_compra_historial TO postgres;
GRANT ALL ON TABLE public.ordenes_compra_historial TO sira_stg_user;


-- public.pagos_oc definition

-- Drop table

-- DROP TABLE public.pagos_oc;

CREATE TABLE public.pagos_oc (
	id serial4 NOT NULL,
	orden_compra_id int4 NOT NULL,
	fecha_pago timestamptz DEFAULT now() NOT NULL,
	monto numeric(14, 4) NOT NULL, -- Monto pagado en esta transacción.
	tipo_pago varchar(10) NOT NULL, -- Indica si el pago fue por el total ("TOTAL") o es un anticipo ("ANTICIPO").
	usuario_id int4 NOT NULL,
	comprobante_link text NOT NULL, -- URL al comprobante en Google Drive.
	comentario text NULL,
	creado_en timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT pagos_oc_pkey PRIMARY KEY (id),
	CONSTRAINT pagos_oc_tipo_pago_check CHECK (((tipo_pago)::text = ANY ((ARRAY['TOTAL'::character varying, 'ANTICIPO'::character varying])::text[]))),
	CONSTRAINT pagos_oc_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
	CONSTRAINT pagos_oc_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT
);
CREATE INDEX idx_pagos_oc_ocid ON public.pagos_oc USING btree (orden_compra_id);
CREATE INDEX idx_pagos_oc_orden ON public.pagos_oc USING btree (orden_compra_id);
CREATE INDEX idx_pagos_oc_usuario ON public.pagos_oc USING btree (usuario_id);
COMMENT ON TABLE public.pagos_oc IS 'Registra todos los pagos (total y anticipos) asociados a una OC, con comprobante, tipo y usuario.';

-- Column comments

COMMENT ON COLUMN public.pagos_oc.monto IS 'Monto pagado en esta transacción.';
COMMENT ON COLUMN public.pagos_oc.tipo_pago IS 'Indica si el pago fue por el total ("TOTAL") o es un anticipo ("ANTICIPO").';
COMMENT ON COLUMN public.pagos_oc.comprobante_link IS 'URL al comprobante en Google Drive.';

-- Table Triggers

create trigger trg_recalc_monto_pagado after
insert
    or
delete
    or
update
    on
    public.pagos_oc for each row execute function f_recalcular_monto_pagado_oc();
create trigger trg_update_liquidacion_oc after
insert
    or
update
    on
    public.pagos_oc for each row execute function f_actualizar_liquidacion_oc();

-- Permissions

ALTER TABLE public.pagos_oc OWNER TO postgres;
GRANT ALL ON TABLE public.pagos_oc TO postgres;
GRANT ALL ON TABLE public.pagos_oc TO sira_stg_user;


-- public.recepciones_oc definition

-- Drop table

-- DROP TABLE public.recepciones_oc;

CREATE TABLE public.recepciones_oc (
	id serial4 NOT NULL,
	orden_compra_id int4 NOT NULL,
	requisicion_detalle_id int4 NOT NULL,
	material_id int4 NOT NULL,
	cantidad numeric(12, 2) NOT NULL,
	valor_unitario numeric(14, 4) NOT NULL,
	recibido_por int4 NULL,
	fecha_recepcion timestamptz DEFAULT now() NULL,
	observaciones text NULL,
	CONSTRAINT recepciones_oc_cantidad_check CHECK ((cantidad > (0)::numeric)),
	CONSTRAINT recepciones_oc_pkey PRIMARY KEY (id),
	CONSTRAINT recepciones_oc_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.catalogo_materiales(id),
	CONSTRAINT recepciones_oc_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
	CONSTRAINT recepciones_oc_recibido_por_fkey FOREIGN KEY (recibido_por) REFERENCES public.usuarios(id),
	CONSTRAINT recepciones_oc_requisicion_detalle_id_fkey FOREIGN KEY (requisicion_detalle_id) REFERENCES public.requisiciones_detalle(id)
);

-- Table Triggers

create trigger trg_procesar_recepcion_oc after
insert
    on
    public.recepciones_oc for each row execute function f_procesar_recepcion_oc();

-- Permissions

ALTER TABLE public.recepciones_oc OWNER TO postgres;
GRANT ALL ON TABLE public.recepciones_oc TO postgres;
GRANT ALL ON TABLE public.recepciones_oc TO sira_stg_user;


-- public.movimientos_inventario definition

-- Drop table

-- DROP TABLE public.movimientos_inventario;

CREATE TABLE public.movimientos_inventario (
	id serial4 NOT NULL,
	fecha timestamptz DEFAULT now() NOT NULL,
	material_id int4 NOT NULL,
	tipo_movimiento public.tipo_movimiento_inventario NOT NULL,
	cantidad numeric(12, 2) NOT NULL,
	usuario_id int4 NOT NULL,
	ubicacion_id int4 NOT NULL,
	proyecto_origen_id int4 NULL,
	proyecto_destino_id int4 NULL,
	orden_compra_id int4 NULL,
	requisicion_id int4 NULL,
	observaciones text NULL,
	CONSTRAINT chk_cantidad_positiva CHECK ((cantidad > (0)::numeric)),
	CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id),
	CONSTRAINT fk_movimientos_material FOREIGN KEY (material_id) REFERENCES public.catalogo_materiales(id),
	CONSTRAINT fk_movimientos_orden_compra FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id),
	CONSTRAINT fk_movimientos_proyecto_destino FOREIGN KEY (proyecto_destino_id) REFERENCES public.proyectos(id),
	CONSTRAINT fk_movimientos_proyecto_origen FOREIGN KEY (proyecto_origen_id) REFERENCES public.proyectos(id),
	CONSTRAINT fk_movimientos_requisicion FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id),
	CONSTRAINT fk_movimientos_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones_almacen(id),
	CONSTRAINT fk_movimientos_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE INDEX idx_movimientos_fecha ON public.movimientos_inventario USING btree (fecha);
CREATE INDEX idx_movimientos_material_id ON public.movimientos_inventario USING btree (material_id);
CREATE INDEX idx_movimientos_tipo ON public.movimientos_inventario USING btree (tipo_movimiento);

-- Permissions

ALTER TABLE public.movimientos_inventario OWNER TO postgres;
GRANT ALL ON TABLE public.movimientos_inventario TO postgres;
GRANT ALL ON TABLE public.movimientos_inventario TO sira_stg_user;


-- public.vw_asignaciones_por_sitio source

CREATE OR REPLACE VIEW public.vw_asignaciones_por_sitio
AS SELECT cm.id AS material_id,
    cm.nombre AS material,
    sa.id AS sitio_id,
    sa.nombre AS sitio,
    p.id AS proyecto_id,
    p.nombre AS proyecto,
    sum(ia.cantidad) AS cantidad_asignada
   FROM inventario_asignado ia
     JOIN inventario_actual inv ON inv.id = ia.inventario_id
     JOIN catalogo_materiales cm ON cm.id = inv.material_id
     JOIN sitios sa ON sa.id = ia.sitio_id
     JOIN proyectos p ON p.id = ia.proyecto_id
  GROUP BY cm.id, cm.nombre, sa.id, sa.nombre, p.id, p.nombre
  ORDER BY cm.nombre, sa.nombre;

-- Permissions

ALTER TABLE public.vw_asignaciones_por_sitio OWNER TO postgres;
GRANT ALL ON TABLE public.vw_asignaciones_por_sitio TO postgres;
GRANT ALL ON TABLE public.vw_asignaciones_por_sitio TO sira_stg_user;


  `);

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {};
