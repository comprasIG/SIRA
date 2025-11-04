// C:\SIRA\backend\services\googleDrive.js
/**
 * =================================================================================================
 * SERVICIO: Google Drive (Versión 4.0 - Refactorizada con Carpetas Anidadas)
 * =================================================================================================
 * @file googleDrive.js
 * @description Maneja toda la interacción con Google Drive, respetando la estructura
 * de carpetas (AMBIENTE)/REQUISICIONES/<DEPTO>/<REQ_NUM>/[OC | COTIZACIONES]
 */

const { google } = require('googleapis');
const stream = require('stream');

// --- CONFIGURACIÓN ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SUPER_ROOT_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = () => google.drive({ version: 'v3', auth: oauth2Client });

// ============================================================
// --- SECCIÓN 1: HELPERS DE CARPETAS ---
// ============================================================

let environmentRootFolderId = null;

/**
 * Encuentra o crea la carpeta de ambiente (LOCAL, STG, PROD)
 * basándose en la variable process.env.NODE_ENV.
 */
const getEnvironmentRootFolderId = async (driveService) => {
  if (environmentRootFolderId) {
    return environmentRootFolderId;
  }
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
    environmentRootFolderId = await findOrCreateFolder(driveService, SUPER_ROOT_FOLDER_ID, envFolderName);
    console.log(`Carpeta raíz de ambiente establecida en: ${environmentRootFolderId} (${envFolderName})`);
    return environmentRootFolderId;
  } catch (err) {
    console.error(`Error CRÍTICO al asegurar la carpeta raíz de ambiente "${envFolderName}":`, err);
    return SUPER_ROOT_FOLDER_ID;
  }
};

/**
 * Helper genérico para encontrar o crear una carpeta.
 */
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

/**
 * ¡NUEVO! Navega la ruta (Ambiente)/REQUISICIONES/<DEPTO>/<REQ_NUM>
 * y devuelve el ID de la carpeta de la requisición.
 */
const getRequisitionFolderId = async (driveService, depto, reqNum) => {
  const envRootId = await getEnvironmentRootFolderId(driveService);
  const requisicionesFolderId = await findOrCreateFolder(driveService, envRootId, 'REQUISICIONES');
  const departmentFolderId = await findOrCreateFolder(driveService, requisicionesFolderId, depto);
  const targetFolderId = await findOrCreateFolder(driveService, departmentFolderId, reqNum);
  return targetFolderId;
};

// ============================================================
// --- SECCIÓN 2: FUNCIONES DE ACCIÓN (EXPORTADAS) ---
// ============================================================

/**
 * Sube los adjuntos iniciales de una requisición (G-REQ)
 * Ruta: (Ambiente)/REQUISICIONES/<DEPTO>/<NUM_REQ>
 */
const uploadRequisitionFiles = async (files, departmentAbbreviation, requisitionNumber) => {
  try {
    const d = drive();
    const targetFolderId = await getRequisitionFolderId(d, departmentAbbreviation, requisitionNumber);
    
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
    const targetFolderId = await getRequisitionFolderId(d, departmentAbbreviation, requisitionNumber);

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
 * ¡NUEVA FUNCIÓN!
 * Sube un PDF de OC a la carpeta anidada de la REQ
 * Ruta: (Ambiente)/REQUISICIONES/<DEPTO>/<REQ_NUM>/OC/
 */
const uploadOcToReqFolder = async (pdfBuffer, fileName, depto, reqNum) => {
  try {
    const d = drive();
    const reqFolderId = await getRequisitionFolderId(d, depto, reqNum);
    const ocFolderId = await findOrCreateFolder(d, reqFolderId, 'OC'); // Subcarpeta 'OC'

    const bufferStream = new stream.PassThrough();
    bufferStream.end(pdfBuffer);
    const result = await d.files.create({
      media: { mimeType: 'application/pdf', body: bufferStream },
      requestBody: { name: fileName, parents: [ocFolderId] },
      fields: 'id, name, webViewLink',
    });
    
    // Obtener el link de la carpeta 'OC'
    const folder = await d.files.get({ fileId: ocFolderId, fields: 'webViewLink' });
    
    return {
      fileLink: result.data.webViewLink,
      folderLink: folder.data.webViewLink
    };
  } catch (error) {
    console.error(`Error CRÍTICO al subir PDF de OC a Drive (${fileName}):`, error);
    return null;
  }
};

/**
 * ¡NUEVA FUNCIÓN!
 * Sube un adjunto de cotización a la carpeta anidada de la REQ
 * Ruta: (Ambiente)/REQUISICIONES/<DEPTO>/<REQ_NUM>/COTIZACIONES/<PROVIDER_NAME>
 */
const uploadQuoteToReqFolder = async (fileObject, depto, reqNum, providerName) => {
  try {
    const d = drive();
    const reqFolderId = await getRequisitionFolderId(d, depto, reqNum);
    const quotesFolderId = await findOrCreateFolder(d, reqFolderId, 'COTIZACIONES');
    const providerFolderId = await findOrCreateFolder(d, quotesFolderId, providerName.replace(/\s+/g, '_'));
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);
    const result = await d.files.create({
      media: { mimeType: fileObject.mimetype, body: bufferStream },
      requestBody: { name: fileObject.originalname, parents: [providerFolderId] },
      fields: 'id, name, webViewLink',
    });
    return result.data;
  } catch (error) {
    console.error(`Error durante la subida de archivo de cotización para ${reqNum}:`, error);
    throw error;
  }
};

/**
 * Descarga un archivo (Usado por G-RFQ Visto Bueno)
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

/**
 * ¡NUEVA FUNCIÓN!
 * Borra un archivo de Drive (Usado por G-RFQ al guardar)
 */
const deleteFile = async (fileId) => {
  try {
    await drive().files.delete({ fileId });
    return true;
  } catch (error)
   {
    if (error.code === 404) {
      console.warn(`[Drive] Intento de borrar archivo no encontrado (ID: ${fileId}).`);
      return true; // Si ya no existe, se considera "borrado"
    }
    console.error(`[Drive] Error al borrar archivo (ID: ${fileId}):`, error.message);
    throw error;
  }
};


module.exports = {
  // Funciones para G-REQ
  uploadRequisitionFiles,
  uploadRequisitionPdf,
  
  // Funciones para G-RFQ y VB-RFQ
  uploadOcToReqFolder,     // <- NUEVA (reemplaza uploadPdfToOcFolder)
  uploadQuoteToReqFolder,  // <- NUEVA (reemplaza uploadQuoteFile)
  downloadFileBuffer,
  deleteFile,              // <- NUEVA
};