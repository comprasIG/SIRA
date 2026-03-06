# OC Incrementables de Importación

## ¿Qué es un incrementable?

Un **incrementable** representa un costo adicional que surge después de emitir una Orden de Compra de importación (IMPO). Ejemplos típicos: flete marítimo, despacho aduanal, impuestos de importación, última milla, seguro de carga, etc.

Estos costos no formaban parte del precio original de los materiales, pero sí impactan su costo real en inventario (**landed cost**). El sistema genera una OC independiente para capturar ese gasto y lo distribuye proporcionalmente entre los artículos de las OC base afectadas.

---

## ¿Qué OC genera?

Al confirmar un incrementable el sistema crea **una OC nueva** con las siguientes características:

| Campo | Valor |
|---|---|
| **Numeración** | `OC-XXXX` — misma secuencia que todas las OC del sistema |
| **Formato visual** | `OC-0123` (4 dígitos con ceros a la izquierda) |
| **Tipo** | No-IMPO (es la OC del proveedor del servicio, p. ej. el agente aduanal) |
| **Estatus inicial** | `POR_AUTORIZAR` |
| **Proveedor** | El proveedor del costo incremental (puede ser distinto al de la OC base) |
| **Una sola línea** | Monto total del costo, sin material específico |

Adicionalmente se crea una **requisición de soporte** interna en estado `ESPERANDO_ENTREGA`, cuyo único propósito es cumplir con la trazabilidad documental del sistema.

---

## Flujo desde la pantalla

### Paso 1 — Tipo y Costo
El usuario elige:
- **Tipo de incrementable** (catálogo: Flete Marítimo, Impuestos Aduana, Última Milla, etc.)
- **Proveedor** del servicio (el agente, la naviera, etc.)
- **Monto total** y **moneda** (MXN, USD, EUR…)
- Comentario opcional y si es urgente

### Paso 2 — OC Base
El usuario selecciona **una o más OC de importación** ya existentes a las que aplica este costo.
- Solo se pueden seleccionar OC marcadas como **IMPO**.
- Si las OC base están en monedas distintas a MXN, el sistema pide los **tipos de cambio** para poder calcular la distribución en una misma unidad.

### Paso 3 — Distribución y Confirmar
El sistema muestra una **vista previa de cómo se reparte el costo** entre cada artículo de las OC base seleccionadas. Al confirmar se generan todos los registros.

---

## ¿Cómo se calcula la distribución?

El costo total del incrementable se reparte **proporcionalmente al valor de cada artículo** (cantidad × precio unitario, convertido a MXN con el tipo de cambio indicado).

**Ejemplo:**

| Artículo | Valor base (MXN equiv.) | % del total | Incrementable asignado |
|---|---|---|---|
| Válvula A | $10,000 | 40 % | $4,000 |
| Bomba B | $15,000 | 60 % | $6,000 |
| **Total** | **$25,000** | **100 %** | **$10,000** |

El último artículo absorbe los centavos de redondeo para que la suma sea exacta.

Esta distribución se guarda por artículo pero **no afecta el inventario todavía**. El costo se aplica al inventario cuando la OC incrementable se cierra en el paso de **Recepción (REC_OC)**.

---

## ¿Qué pasa después de crear el incrementable?

1. **PDF generado automáticamente** — se sube a Google Drive en la carpeta del departamento.
2. **Notificación por correo** — se envía al grupo `OC_GENERADA_NOTIFICAR` con el detalle de la OC y las OC base afectadas.
3. **La OC queda en `POR_AUTORIZAR`** — sigue el flujo normal de autorización de OC.
4. **Al cerrar la OC (REC_OC)** — el costo incremental se suma al campo `costos_incrementables` de cada artículo en inventario, permitiendo calcular el costo real de landed cost.

---

## Restricciones

- Solo se pueden asociar OC marcadas como **IMPO** como OC base.
- El sistema valida esto tanto en el backend como en la base de datos (trigger `fn_incrementables_oc_aplicaciones_defaults`).
- Una misma OC base puede aparecer en múltiples incrementables (varios costos para la misma importación).

---

## Tablas involucradas

| Tabla | Descripción |
|---|---|
| `tipo_incrementables` | Catálogo de tipos (Flete, Impuestos, etc.) |
| `incrementables_oc` | Registro del incrementable: qué tipo es y qué OC lo representa |
| `incrementables_oc_aplicaciones` | Relación muchos-a-muchos entre el incrementable y las OC base |
| `incrementables_distribucion_items` | Distribución del costo por artículo (para landed cost) |
| `ordenes_compra` | La OC generada (status `POR_AUTORIZAR`, `impo = false`) |
| `requisiciones` | Requisición de soporte interna (status `ESPERANDO_ENTREGA`) |
