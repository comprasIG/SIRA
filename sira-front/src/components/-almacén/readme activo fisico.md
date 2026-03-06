Módulo: Activo Físico (SIRA)
Objetivo

Administrar el activo físico de la empresa (mobiliario, TI, herramientas manuales/eléctricas, etc.) con:

Identificación única y estable por activo (sku)

Ubicación y responsable actuales (snapshot)

Historial completo de cambios (movimientos / ledger)

Auditoría (quién registró, cuándo, qué cambió)

Soporte para baja y reactivación

Tablas creadas (resumen)
Catálogos

catalogo_activo_fisico_categorias

Define familias (TI, MOB, HERR_MANUAL, HERR_ELECTRICA, etc.)

Campos clave: clave, nombre, activo

catalogo_activo_fisico_tipos

Define tipos dentro de una categoría (MONITOR, ESCRITORIO, TALADRO, PULIDORA, etc.)

Tiene FK a categoría: categoria_id

Reglas de unicidad por categoría: (categoria_id, clave) y (categoria_id, nombre)

catalogo_activo_fisico_ubicaciones

Ubicaciones físicas con jerarquía opcional (parent_id)

Ejemplo: PLANTA > ALMACEN_HERRAMIENTA > MANTTO

Master

activos_fisicos

Registro principal de cada activo (1 activo = 1 registro)

SKU: autogenerado, único y estable (no depende de ubicación)

Snapshot (estado actual): empleado_responsable_actual_id, ubicacion_actual_id, estatus, ultimo_movimiento_id

Ledger / Historial

activos_fisicos_movimientos

Historial de cambios del activo (movimientos)

Cada movimiento tiene:

consecutivo (por activo)

usuario_id (quién lo registró)

anterior/nuevo responsable y anterior/nueva ubicación

tipo_movimiento

soporte de anulación (estado, anulado_*, reversa_de_movimiento_id)

Concepto clave: Snapshot vs Historial
Snapshot (en activos_fisicos)

Es la “foto actual” del activo:

¿Dónde está hoy?

¿Quién lo tiene hoy?

¿Está activo o dado de baja?

Esto permite consultas rápidas en UI (inventario actual).

Historial (en activos_fisicos_movimientos)

Es el “libro contable”:

Todo cambio queda registrado

Auditoría completa por fechas y usuario

Permite rastrear traslados, asignaciones y bajas

Regla: La UI consulta el snapshot para “estado actual” y consulta movimientos para “historial”.

Flujo recomendado de operación
A) Alta de un activo (creación)

Paso 1: Crear el activo en activos_fisicos

Requiere: categoria_id, tipo_id, nombre

Opcional: marca/modelo/serie, fecha y costo de compra, proveedor, moneda

El sku se genera automáticamente

Paso 2: Registrar el primer movimiento en activos_fisicos_movimientos

Tipo: ALTA

Debe incluir al menos:

empleado_responsable_nuevo_id y/o

ubicacion_nueva_id

Resultado:

Se actualiza el snapshot del activo (responsable/ubicación/ultimo_movimiento)

✅ En UI: después de “crear”, idealmente obligas a capturar responsable y ubicación inicial.

B) Cambio de responsable

Insertar movimiento con:

tipo_movimiento = CAMBIO_RESPONSABLE

empleado_responsable_nuevo_id

(ubicación puede quedarse igual)

Resultado:

Snapshot cambia empleado_responsable_actual_id

Se registra el historial

C) Cambio de ubicación

Insertar movimiento con:

tipo_movimiento = CAMBIO_UBICACION

ubicacion_nueva_id

(responsable puede quedarse igual)

Resultado:

Snapshot cambia ubicacion_actual_id

D) Cambio de responsable y ubicación

Insertar movimiento con:

tipo_movimiento = CAMBIO_RESPONSABLE_Y_UBICACION

empleado_responsable_nuevo_id

ubicacion_nueva_id

Resultado:

Snapshot cambia ambos

E) Baja de activo

Insertar movimiento con:

tipo_movimiento = BAJA

Observaciones (motivo recomendado)

Resultado:

Snapshot cambia estatus = BAJA

A partir de ahí, el sistema no debe permitir nuevos movimientos excepto REACTIVACION

✅ En UI: “Dar de baja” debe pedir motivo.

F) Reactivación

Insertar movimiento con:

tipo_movimiento = REACTIVACION

Recomiendo capturar ubicación y/o responsable al reactivarlo

Resultado:

Snapshot cambia estatus = ACTIVO

Tipos de movimiento que debe soportar tu UI

La UI debería permitir explícitamente estos:

ALTA

CAMBIO_RESPONSABLE

CAMBIO_UBICACION

CAMBIO_RESPONSABLE_Y_UBICACION

BAJA

REACTIVACION

OTRO (solo si quieres permitir notas/auditoría sin cambio real; yo lo limitaría)

Validaciones de negocio sugeridas (UI + BD)
En alta (ALTA)

Debe traer al menos responsable nuevo o ubicación nueva

(Recomendado) que tenga ambos para arrancar “limpio”

En cambios

Debe cambiar algo: si nuevo == anterior, no debería dejarse (UI lo valida)

En baja

Pedir motivo

Bloquear movimientos posteriores salvo reactivación

En reactivación

Pedir ubicación/responsable (recomendado)

Cambia estatus a ACTIVO

Anulación (si la implementas)

Si un movimiento se “anula”, debe:

marcarse estado=ANULADO

guardar anulado_por, anulado_en, motivo_anulacion

opcional: crear un movimiento compensatorio y linkear con reversa_de_movimiento_id

Nota: En la migración actual, el snapshot se actualiza en INSERT de movimientos “ACTIVO”. Si vas a anular movimientos viejos, lo ideal es manejarlo con un flujo de reversa consistente (para no dejar snapshot incoherente).

Qué información te da el módulo
Inventario actual (vista diaria)

Desde activos_fisicos:

lista de activos vigentes (estatus != BAJA, activo=true)

filtros por:

categoría / tipo

ubicación actual

responsable actual

SKU / serial / marca

estado actual y último movimiento

Historial y auditoría

Desde activos_fisicos_movimientos:

historial por activo

trazabilidad: fecha, usuario que lo registró, cambios anteriores/nuevos

conteo de movimientos (consecutivo)

Recomendación de pantallas UI (mínimo viable)

Listado / Inventario de activo fijo

Tabla con: SKU, nombre, categoría, tipo, responsable actual, ubicación actual, estatus

Filtros + búsqueda

Detalle de activo

Datos generales + “snapshot”

Timeline / tabla de movimientos (historial)

Alta de activo

Captura datos base + alta de movimiento inicial (responsable/ubicación)

Registrar movimiento

Selector de activo

Form según tipo:

responsable nuevo

ubicación nueva

notas/observaciones

Confirmación antes de aplicar

Baja / Reactivación

Flujos guiados con motivo / reasignación