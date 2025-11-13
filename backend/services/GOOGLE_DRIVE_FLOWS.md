# Flujos de Google Drive en SIRA

Este resumen describe en palabras sencillas cómo la plataforma organiza **todos** los archivos que se envían a Google Drive.

## Estructura general de carpetas

1. Se parte de una carpeta raíz por ambiente (`PRODUCCION`, `STAGING` o `LOCAL`).
2. Dentro se crea una carpeta por departamento (por ejemplo `TI`).
3. Dentro del departamento vive **una sola carpeta por requisición** (ej. `TI_00045`).
4. Esa carpeta contiene las subcarpetas de cada etapa:
   - `01 - Adjuntos Requisicion`
   - `02 - Requisicion Aprobada`
   - `03 - Cotizaciones`
   - `04 - Ordenes de Compra`
5. Cada orden de compra genera su propia subcarpeta (`OC-123`) bajo `04 - Ordenes de Compra` con estos niveles:
   - `01 - PDF`
   - `02 - Evidencias Recoleccion`
   - `03 - Pagos`

Con esto todas las evidencias de la requisición, sus órdenes y los pagos conviven dentro de la misma ruta.

## Flujos que suben archivos

| # | Flujo | Qué sube | Carpeta destino |
|---|-------|----------|-----------------|
| 1 | Creación de requisición | Adjuntos iniciales del formulario | `01 - Adjuntos Requisicion` |
| 2 | Edición de requisición | Nuevos adjuntos | `01 - Adjuntos Requisicion` |
| 3 | Aprobación de requisición | PDF final firmado | `02 - Requisicion Aprobada` |
| 4 | Gestión de cotizaciones (G-RFQ) | Archivos de cada proveedor | `03 - Cotizaciones/<Proveedor>` |
| 5 | Generación de OCs en VB_RFQ | PDF de cada OC | `04 - Ordenes de Compra/OC-XYZ/01 - PDF` |
| 6 | Servicio maestro de autorización de OC | PDF consolidado de la OC | `04 - Ordenes de Compra/OC-XYZ/01 - PDF` |
| 7 | Recolección de mercancía | Evidencias de embarque | `04 - Ordenes de Compra/OC-XYZ/02 - Evidencias Recoleccion` |
| 8 | Registro de pagos de OC | Comprobantes (SPEI, etc.) | `04 - Ordenes de Compra/OC-XYZ/03 - Pagos` |
| 9 | Ruta genérica `/uploadRoutes` | Subidas de prueba/manuales | `__UPLOADS_LIBRES__` (fuera de requisiciones) |

## Helpers disponibles

El servicio `backend/services/googleDrive.js` expone utilidades para cada flujo:

- `uploadRequisitionFiles` — maneja arreglos de archivos de Multer.
- `uploadRequisitionPdf` — recibe el PDF en buffer al aprobar la requisición.
- `uploadQuoteToReqFolder` — guarda cotizaciones por proveedor.
- `uploadOcPdfBuffer` — coloca cualquier PDF de OC en su carpeta y devuelve link directo y link de la carpeta.
- `uploadOcEvidenceFile` — evidencia de recolección.
- `uploadOcPaymentReceipt` — comprobantes de pago.
- `getOcFolderWebLink` — obtiene el enlace público a la carpeta de la OC.
- `downloadFileBuffer` y `deleteFile` — utilidades comunes.

Todas las funciones reciben el código del departamento, el número de requisición y, cuando aplica, el número de la OC para garantizar que la ruta sea única y coherente.
