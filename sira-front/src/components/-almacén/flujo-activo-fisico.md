# Guía de Usuario — Módulo Activo Físico (SIRA)

> Escrita en palabras normales. No es documentación técnica — es la guía de "¿qué hace el usuario paso a paso?"

---

## ¿Qué es el módulo de Activo Físico?

Es el registro y control de todos los bienes físicos de la empresa que **no se consumen** (no son materiales de stock): computadoras, muebles, herramientas, vehículos, equipos, etc.

Cada activo tiene:
- **Un SKU único e irrepetible** (ej. `TI.LAPTOP.000042`) — jamás cambia aunque el activo se mueva o cambie de dueño.
- **Un estado actual** (snapshot): quién lo tiene, dónde está, si está activo o dado de baja.
- **Un historial completo** (ledger): cada cambio queda registrado con fecha, quién lo registró y qué cambió.

---

## Escenario 1 — Dar de alta un activo físico manualmente

Úsalo cuando el activo **ya existe** en la empresa pero nunca se registró en el sistema, o cuando se compró por fuera del flujo de compras de SIRA.

### Paso 1 · Asegúrate de que los catálogos estén llenos

Antes de dar de alta activos, deben existir al menos:

| Catálogo | Qué define | Ejemplo |
|---|---|---|
| **Categorías** | La familia del activo | `TI` — Tecnología de Información |
| **Tipos** | El tipo dentro de la categoría | `LAPTOP` dentro de `TI` |
| **Ubicaciones** | Lugar físico dentro de la empresa | `PLANTA > OFICINA_ADMIN` |

Todos se administran desde la pestaña **Catálogos** en la pantalla `/activo_fisico`.

> Si el catálogo no tiene la categoría o tipo que necesitas, créalo ahí mismo antes de continuar.

---

### Paso 2 · Crear el activo (pestaña "Inventario" → botón "+ Nuevo Activo")

Campos obligatorios:
- **Nombre** — descripción breve del bien (ej. `Laptop Dell Latitude 5540`)
- **Categoría** — elige de la lista (`TI`, `MOB`, `HERR_MANUAL`, etc.)
- **Tipo** — se filtra según la categoría elegida (`LAPTOP`, `ESCRITORIO`, `TALADRO`, etc.)

Campos opcionales pero recomendados:
- Marca / Modelo / Número de serie
- Fecha de compra / Costo de compra / Moneda / Proveedor
- **Responsable inicial** — el empleado al que se le asigna desde el primer día
- **Ubicación inicial** — dónde está físicamente el activo

> **¿Qué pasa en el sistema?**
> Al guardar, la base de datos genera automáticamente el SKU (`CATEGORIA.TIPO.######`). Si además llenaste responsable o ubicación, se registra automáticamente el primer movimiento de tipo **ALTA**.

---

### Paso 3 · Verificar en el inventario

El activo aparece en la tabla del **Inventario** con:
- SKU generado
- Responsable actual y ubicación actual
- Estatus: `ACTIVO`

---

### Alta masiva por Excel

Si tienes muchos activos que registrar de una vez:

1. Ve a la pestaña **Carga Masiva**
2. Descarga la **plantilla Excel** — viene con:
   - **Hoja 1** (`Activos`): las columnas que debes llenar
   - **Hoja 2** (`Referencia_Claves`): lista de claves válidas de categorías, tipos y ubicaciones que puedes usar
3. Llena la hoja `Activos` con tus datos
4. Sube el archivo
5. Si usaste una clave que no existe en el catálogo, el sistema te mostrará la sección **"Resolver referencias no encontradas"** — ahí puedes mapear cada clave desconocida a una que sí exista antes de confirmar la importación

---

## Escenario 2 — Solicitar la compra de un activo físico (vía Requisición → OC → ING_OC)

Úsalo cuando el activo **todavía no existe** y necesitas comprarlo. El flujo de compras de SIRA funciona exactamente igual que con materiales normales — **el usuario no hace nada diferente**. La magia ocurre automáticamente al momento de recibir.

### Preparación previa (una sola vez, por material)

Un administrador debe marcar el material en el **Catálogo de Materiales** como "Activo Fijo":

1. Ir al catálogo de materiales (módulo de compras)
2. Editar el material (ej. `Laptop Dell Latitude 5540`)
3. Activar el interruptor **"¿Es Activo Fijo?"**
4. Seleccionar la **Categoría AF** y el **Tipo AF** correspondiente (ej. `TI` → `LAPTOP`)
5. Guardar

> Esto solo se hace una vez. A partir de ese momento, cada vez que ese material se reciba, el sistema sabe que debe ir a Activo Físico y no al inventario de stock.

---

### El flujo de compra (sin cambios para el usuario)

```
G_REQ  →  VB_REQ  →  G_RFQ  →  VB_RFQ  →  PAY_OC  →  REC_OC  →  ING_OC
```

El usuario hace exactamente lo mismo de siempre:

| Paso | Quién | Qué hace |
|---|---|---|
| **G_REQ** | Solicitante | Crea la requisición, selecciona el material (ej. `Laptop Dell`) con la cantidad que necesita |
| **VB_REQ** | Autorizador | Aprueba la requisición |
| **G_RFQ** | Compras | Solicita cotizaciones a proveedores |
| **VB_RFQ** | Autorizador | Aprueba la mejor cotización |
| **PAY_OC** | Finanzas | Autoriza el pago / genera la OC |
| **REC_OC** | Almacén | Recibe físicamente el bien |
| **ING_OC** | Almacén | Registra el ingreso en el sistema |

En la pantalla de **ING_OC**, los materiales marcados como Activo Fijo aparecen con un badge naranja **"Activo Fijo"** y una nota informativa. El usuario registra el ingreso igual que siempre.

---

### ¿Qué pasa automáticamente al registrar el ingreso?

Si el material es Activo Fijo y se reciben **N unidades**, el sistema:

1. **Crea N registros individuales** en `activos_fisicos` — uno por cada unidad física recibida
2. **Asigna automáticamente** la categoría, tipo, nombre, costo, proveedor y número de OC a cada registro
3. **Genera el SKU** automáticamente para cada uno (ej. `TI.LAPTOP.000042`, `TI.LAPTOP.000043`, ...)
4. **NO mueve nada al inventario de stock** — estos materiales nunca pasan por `inventario_actual`

> Los activos recién creados aparecen en el inventario de Activo Físico con estatus **ACTIVO** pero **sin responsable ni ubicación asignados** (pendientes de ALTA). El siguiente paso es registrar el movimiento de ALTA para asignarlos.

---

### Trazabilidad de compra

Cada activo creado desde una OC guarda el `origen_oc_detalle_id`, lo que permite saber:
- ¿En qué OC se compró este activo?
- ¿Cuánto costó?
- ¿A qué proveedor?
- ¿Cuándo ingresó?

---

## Escenario 3 — Ver y trazar los movimientos de un activo

### Ver el estado actual (pestaña "Inventario")

La tabla muestra la **foto actual** de cada activo:

| Columna | Qué significa |
|---|---|
| **SKU** | Identificador único permanente |
| **Nombre** | Descripción del activo |
| **Categoría / Tipo** | Clasificación |
| **Responsable actual** | El empleado que lo tiene hoy |
| **Ubicación actual** | Dónde está físicamente hoy |
| **Estatus** | `ACTIVO`, `EN_MANTENIMIENTO` o `BAJA` |

Puedes filtrar por categoría, estatus, ubicación o buscar por SKU/nombre/serie.

---

### Ver el historial de un activo (timeline de movimientos)

Desde la fila de cualquier activo → botón **"Ver movimientos"** (o icono de historial):

Muestra todos los movimientos en orden cronológico:

| Campo | Descripción |
|---|---|
| **#** | Consecutivo del movimiento (1, 2, 3...) |
| **Fecha** | Cuándo ocurrió |
| **Tipo** | Qué cambió (ver tabla abajo) |
| **Responsable anterior → nuevo** | De quién a quién |
| **Ubicación anterior → nueva** | De dónde a dónde |
| **Registrado por** | Qué usuario del sistema lo capturó |
| **Observaciones** | Notas libres |

---

### Tipos de movimiento y cuándo se usan

| Tipo | Cuándo se registra |
|---|---|
| **ALTA** | Primera asignación del activo (responsable y/o ubicación inicial) |
| **CAMBIO_RESPONSABLE** | El activo pasa de manos (mismo lugar, otro empleado) |
| **CAMBIO_UBICACION** | El activo se mueve de lugar (mismo responsable, otro lugar) |
| **CAMBIO_RESPONSABLE_Y_UBICACION** | Cambia tanto el responsable como el lugar |
| **BAJA** | El activo se retira del servicio (se rompe, se vende, se destruye) |
| **REACTIVACION** | Un activo dado de baja vuelve al servicio |
| **OTRO** | Nota o auditoría sin cambio real de responsable/ubicación |

> El sistema **calcula automáticamente** el tipo de movimiento según qué campos cambiaron. Por ejemplo, si solo cambias el responsable, el tipo se establece como `CAMBIO_RESPONSABLE` sin que tengas que seleccionarlo.

---

### Ver movimientos globales (pestaña "Movimientos")

Muestra todos los movimientos de **todos los activos** en una sola tabla con filtros por:
- Rango de fechas
- Tipo de movimiento
- Búsqueda por SKU o nombre

Útil para auditorías y reportes del período.

---

## Reglas importantes del sistema

### ✅ Lo que el sistema hace automáticamente

- **SKU**: se genera solo al crear el activo. Formato: `CATEGORIA.TIPO.000001`. Nunca cambia.
- **Consecutivo**: cada movimiento de un activo lleva un número secuencial (1, 2, 3...) que el sistema asigna solo.
- **Anteriors**: al registrar un movimiento, el sistema captura automáticamente quién era el responsable anterior y cuál era la ubicación anterior — no tienes que ingresarlos.
- **Snapshot**: después de cada movimiento, el sistema actualiza automáticamente el estado actual del activo (responsable actual, ubicación actual, estatus).

### ❌ Lo que el sistema no permite

- **Mover un activo en BAJA**: si un activo fue dado de baja, el único movimiento permitido es `REACTIVACION`. Cualquier otro intento genera error.
- **Alta sin responsable ni ubicación**: el movimiento de tipo ALTA requiere al menos uno de los dos.
- **SKU duplicados**: el SKU es único en todo el sistema. No puede repetirse.
- **Número de serie duplicado**: si dos activos tienen el mismo número de serie, el segundo registro falla (el sistema lo detecta).

---

## Resumen del flujo completo

```
┌─────────────────────────────────────────────────────────┐
│                   ACTIVO FÍSICO EN SIRA                  │
└─────────────────────────────────────────────────────────┘

   ORIGEN A: Manual (activo ya existente)
   ────────────────────────────────────
   Catálogos listos → Crear activo → Registrar ALTA
                                          │
                                          ▼
   ORIGEN B: Compra vía OC               │
   ─────────────────────────             │
   Marcar material como AF               │
      ↓                                  │
   G_REQ → VB_REQ → G_RFQ → PAY_OC → ING_OC
                                     (automático)
                                          │
                                          ▼
                               ┌──────────────────┐
                               │  activos_fisicos  │
                               │  SKU generado     │
                               │  Estatus: ACTIVO  │
                               │  (sin ALTA aún)   │
                               └──────────┬────────┘
                                          │ Registrar ALTA
                                          ▼
                               ┌──────────────────┐
                               │  ALTA registrada  │
                               │  Responsable ✓    │
                               │  Ubicación ✓      │
                               └──────────┬────────┘
                                          │
              ┌───────────────────────────┤
              ▼                           ▼
   CAMBIO_RESPONSABLE          CAMBIO_UBICACION
   CAMBIO_RESP_Y_UBIC          EN_MANTENIMIENTO (editar)
              │
              ▼
           BAJA (con motivo)
              │
              ▼
        REACTIVACION (si aplica)
```

---

## ¿Dónde se hace cada cosa en la UI?

| Acción | Dónde ir |
|---|---|
| Ver inventario / estado actual | `/activo_fisico` → pestaña **Inventario** |
| Crear activo manualmente | Pestaña **Inventario** → botón **+ Nuevo Activo** |
| Registrar movimiento (traslado, baja, etc.) | Fila del activo → menú → **Registrar Movimiento** |
| Ver historial de un activo | Fila del activo → menú → **Ver Movimientos** |
| Ver todos los movimientos (auditoría) | Pestaña **Movimientos** |
| Alta masiva por Excel | Pestaña **Carga Masiva** |
| Administrar categorías, tipos y ubicaciones | Pestaña **Catálogos** |
| Marcar un material como Activo Fijo | Catálogo de Materiales → Editar → toggle "¿Es Activo Fijo?" |
| Comprar un activo fijo | Flujo normal: G_REQ → ... → ING_OC (sin cambios) |

---

*Generado automáticamente por Claude Code — SIRA · Módulo Activo Físico*
