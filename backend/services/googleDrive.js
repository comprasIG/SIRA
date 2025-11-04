// C:\SIRA\backend\services\googleDrive.js
const { google } = require('googleapis');
const stream = require('stream');

// --- CONFIGURACIÓN ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SUPER_ROOT_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // Carpeta raíz (1y5-iy84...)
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = () => google.drive({ version: 'v3', auth: oauth2Client });

// ============================================================
// ¡NUEVO! Helper para obtener la raíz del ambiente (LOCAL, STG, PROD)
// ============================================================

// Cacheamos el ID de la carpeta de ambiente para no buscarlo en cada subida
let environmentRootFolderId = null;

/**
 * Encuentra o crea la carpeta de ambiente (LOCAL, STG, PROD)
 * basándose en la variable process.env.NODE_ENV que ya usa tu app.
 */
const getEnvironmentRootFolderId = async (driveService) => {
  if (environmentRootFolderId) {
    return environmentRootFolderId;
  }

  // Leer la variable de entorno existente
  const env = process.env.NODE_ENV;
  let envFolderName;

  if (env === 'production') {
    envFolderName = 'PROD';
  } else if (env === 'staging') {
    envFolderName = 'STG';
  } else {
    envFolderName = 'LOCAL';
  }

  try {
    console.log(`Buscando carpeta raíz de ambiente en Drive: "${envFolderName}"`);
    // Buscar o crear esta carpeta DENTRO del super-root
    environmentRootFolderId = await findOrCreateFolder(driveService, SUPER_ROOT_FOLDER_ID, envFolderName);
    console.log(`Carpeta raíz de ambiente establecida en: ${environmentRootFolderId} (${envFolderName})`);
    return environmentRootFolderId;
  } catch (err) {
    console.error(`Error CRÍTICO al asegurar la carpeta raíz de ambiente "${envFolderName}":`, err);
    return SUPER_ROOT_FOLDER_ID; // Fallback a la raíz principal
  }
};


// ============================================================
// Helpers internos (Sin cambios)
// ============================================================
const findOrCreateFolder = async (driveService, parentFolderId, folderName) => {
  const escaped = folderName.replace(/'/g, "\\'");
  const q = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
  const res = await driveService.files.list({ q, fields: 'files(id, name)', spaces: 'drive' });
  if (res.data.files.length > 0) return res.data.files[0].id;

  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };
  const created = await driveService.files.create({ requestBody: fileMetadata, fields: 'id' });
  return created.data.id;
};

// ============================================================
// FUNCIONES EN USO (MODIFICADAS PARA USAR RAÍZ DE AMBIENTE)
// ============================================================

/**
 * Sube los adjuntos de una requisición (G-REQ)
 * Ruta: (Ambiente)/REQUISICIONES/<DEPTO>/<NUM_REQ>
 */
const uploadRequisitionFiles = async (files, departmentAbbreviation, requisitionNumber) => {
  try {
    const d = drive();
    // CAMBIO: Usar la raíz del ambiente
    const envRootId = await getEnvironmentRootFolderId(d);
    const requisicionesFolderId = await findOrCreateFolder(d, envRootId, 'REQUISICIONES');
    const departmentFolderId = await findOrCreateFolder(d, requisicionesFolderId, departmentAbbreviation);
    const targetFolderId = await findOrCreateFolder(d, departmentFolderId, requisitionNumber);
    
    const uploadPromises = files.map(fileObject => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileObject.buffer);
      return d.files.create({
        media: { mimeType: fileObject.mimetype, body: bufferStream },
        requestBody: { name: fileObject.originalname, parents: [targetFolderId] },
        fields: 'id, name, webViewLink',
      });
    });
    const results = await Promise.all(uploadPromises);
    return results.map(res => res.data);
  } catch (error) {
    console.error('Error durante la subida de archivos de requisición:', error);
    throw error;
  }
};

/**
 * Sube el PDF generado de la requisición (G-REQ)
 * Ruta: (Ambiente)/REQUISICIONES/<DEPTO>/<NUM_REQ>
 */
const uploadRequisitionPdf = async (pdfBuffer, fileName, departmentAbbreviation, requisitionNumber) => {
  try {
    const d = drive();
    // CAMBIO: Usar la raíz del ambiente
    const envRootId = await getEnvironmentRootFolderId(d);
    const requisicionesFolderId = await findOrCreateFolder(d, envRootId, 'REQUISICIONES');
    const departmentFolderId = await findOrCreateFolder(d, requisicionesFolderId, departmentAbbreviation);
    const targetFolderId = await findOrCreateFolder(d, departmentFolderId, requisitionNumber);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(pdfBuffer);
    const result = await d.files.create({
      media: { mimeType: 'application/pdf', body: bufferStream },
      requestBody: { name: fileName, parents: [targetFolderId] },
      fields: 'id, name, webViewLink',
    });
    return result.data;
  } catch (error) {
    console.error(`Error CRÍTICO al subir PDF de Requisición a Drive (${fileName}):`, error);
    return null;
  }
};

/**
 * Sube un adjunto de cotización de proveedor (G-RFQ)
 * Ruta: (Ambiente)/COTIZACIONES/<RFQ_CODE>/<PROVIDER_NAME>
 */
const uploadQuoteFile = async (fileObject, rfqCode, providerName) => {
  try {
    const d = drive();
    // CAMBIO: Usar la raíz del ambiente
    const envRootId = await getEnvironmentRootFolderId(d);
    const quotesFolderId = await findOrCreateFolder(d, envRootId, 'COTIZACIONES');
    const rfqFolderId = await findOrCreateFolder(d, quotesFolderId, rfqCode);
    const providerFolderId = await findOrCreateFolder(d, rfqFolderId, providerName.replace(/\s+/g, '_'));
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);
    const result = await d.files.create({
      media: { mimeType: fileObject.mimetype, body: bufferStream },
      requestBody: { name: fileObject.originalname, parents: [providerFolderId] },
      fields: 'id, name, webViewLink',
    });
    return result.data;
  } catch (error) {
    console.error(`Error durante la subida de archivo de cotización para ${rfqCode}:`, error);
    throw error;
  }
};

/**
 * Sube un PDF genérico (Usado por G-RFQ Visto Bueno para la OC)
 * Ruta: (Ambiente)/<rootFolderName>/<subFolderName>
 */
const uploadPdfBuffer = async (pdfBuffer, fileName, rootFolderName, subFolderName) => {
  try {
    const d = drive();
    // CAMBIO: Usar la raíz del ambiente
    const envRootId = await getEnvironmentRootFolderId(d);
    const rootFolderId = await findOrCreateFolder(d, envRootId, rootFolderName);
    const targetFolderId = await findOrCreateFolder(d, rootFolderId, subFolderName);
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(pdfBuffer);
    const result = await d.files.create({
      media: { mimeType: 'application/pdf', body: bufferStream },
      requestBody: { name: fileName, parents: [targetFolderId] },
      fields: 'id, name, webViewLink',
    });
    return result.data;
  } catch (error) {
    console.error(`Error CRÍTICO al subir PDF a Drive (${fileName}):`, error);
    return null;
  }
};

/**
 * Descarga un archivo de Drive (Usado por G-RFQ Visto Bueno)
 */
const downloadFileBuffer = async (fileId) => {
  try {
    const response = await drive().files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error al descargar el archivo ${fileId} de Drive:`, error);
    throw new Error(`No se pudo descargar el archivo de Drive con ID ${fileId}.`);
  }
};

module.exports = {
  // Funciones en uso
  uploadRequisitionFiles,
  uploadRequisitionPdf,
  uploadQuoteFile,
  uploadPdfBuffer,
  downloadFileBuffer,
};