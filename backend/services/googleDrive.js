// C:\SIRA\backend\services\googleDrive.js
/**
 * =================================================================================================
 * SERVICIO: Google Drive (Versión 4.4 - Corrección de Entorno Local)
 * =================================================================================================
 * @file googleDrive.js
 * @description Maneja toda la interacción con Google Drive.
 * --- HISTORIAL DE CAMBIOS ---
 * v4.4: Se corrige la lógica de 'getEnvironmentRootFolderId' para usar una carpeta 'LOCAL'
 * en lugar de 'STAGING' cuando se corre en desarrollo local.
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
 * Encuentra o crea la carpeta raíz del AMBIENTE (PRODUCCION, STAGING o LOCAL)
 */
const getEnvironmentRootFolderId = async () => {
  if (environmentRootFolderId) return environmentRootFolderId;

  // ==================================================================
  // --- ¡INICIO DE LA CORRECCIÓN (Bug de Entorno)! ---
  // ==================================================================
  const env = process.env.NODE_ENV || 'development';
  let rootFolderName;

  if (env === 'production') {
    rootFolderName = 'PRODUCCION';
  } else if (env === 'staging') {
    rootFolderName = 'STAGING';
  } else {
    // Si es 'development' o cualquier otra cosa, usa 'LOCAL'
    rootFolderName = 'LOCAL'; 
  }
  // ==================================================================
  // --- ¡FIN DE LA CORRECCIÓN! ---
  // ==================================================================

  try {
    let folderId = await findFolder(rootFolderName, SUPER_ROOT_FOLDER_ID);
    if (!folderId) {
      console.log(`[Drive] Creando carpeta raíz de ambiente: ${rootFolderName}`);
      folderId = await createFolder(rootFolderName, SUPER_ROOT_FOLDER_ID);
    }
    environmentRootFolderId = folderId;
    return folderId;
  } catch (error) {
    console.error(`Error crítico al obtener la carpeta raíz del ambiente (${rootFolderName}):`, error);
    throw new Error('No se pudo inicializar la carpeta raíz de Google Drive.');
  }
};

/**
 * Busca una carpeta por nombre dentro de un 'parentId'.
 */
const findFolder = async (folderName, parentId) => {
  try {
    const res = await drive().files.list({
      q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    return res.data.files.length > 0 ? res.data.files[0].id : null;
  } catch (error) {
    console.error(`[Drive] Error buscando carpeta '${folderName}':`, error.message);
    return null;
  }
};

/**
 * Crea una carpeta por nombre dentro de un 'parentId'.
 */
const createFolder = async (folderName, parentId) => {
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };
  try {
    const file = await drive().files.create({
      resource: fileMetadata,
      fields: 'id',
    });
    return file.data.id;
  } catch (error) {
    console.error(`[Drive] Error creando carpeta '${folderName}':`, error.message);
    throw error;
  }
};

/**
 * Sube un Buffer de PDF (Usado por OC).
 */
const uploadPdfBuffer = async (pdfBuffer, fileName, folderType, reqNum) => {
  try {
    let reqFolderId = await findFolder(reqNum, await getEnvironmentRootFolderId());

    if (!reqFolderId) {
      console.log(`[Drive] No se encontró la carpeta ${reqNum}. Creando...`);
      const envRootId = await getEnvironmentRootFolderId();
      reqFolderId = await createFolder(reqNum, envRootId); 
    }

    let targetFolderId = await findFolder(folderType, reqFolderId);
    if (!targetFolderId) {
      console.log(`[Drive] Creando sub-carpeta ${folderType} en ${reqNum}...`);
      targetFolderId = await createFolder(folderType, reqFolderId);
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(pdfBuffer);

    const media = {
      mimeType: 'application/pdf',
      body: bufferStream,
    };
    const fileMetadata = {
      name: fileName,
      parents: [targetFolderId],
    };

    const file = await drive().files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    console.log(`[Drive] PDF de OC subido: ${file.data.name} (ID: ${file.data.id})`);
    return file.data;
  } catch (error) {
    console.error(`Error durante la subida del PDF de OC para ${reqNum}:`, error);
    throw error;
  }
};

/**
 * Sube un archivo de Cotización (Usado por G-RFQ).
 */
const uploadQuoteFile = async (fileBuffer, fileName, mimeType, reqNum, deptoCode, provId) => {
  try {
    const envRootId = await getEnvironmentRootFolderId();
    
    // 1. Carpeta de Departamento
    let deptoFolderId = await findFolder(deptoCode, envRootId);
    if (!deptoFolderId) deptoFolderId = await createFolder(deptoCode, envRootId);
    
    // 2. Carpeta de Requisición
    let reqFolderId = await findFolder(reqNum, deptoFolderId);
    if (!reqFolderId) reqFolderId = await createFolder(reqNum, deptoFolderId);

    // 3. Carpeta de Cotizaciones
    let quotesFolderId = await findFolder('COTIZACIONES', reqFolderId);
    if (!quotesFolderId) quotesFolderId = await createFolder('COTIZACIONES', reqFolderId);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const media = { mimeType, body: bufferStream };
    const fileMetadata = {
      name: `[${provId}]_${fileName}`,
      parents: [quotesFolderId],
    };

    const result = await drive().files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });
    
    console.log(`[Drive] Archivo de cotización subido: ${result.data.name}`);
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
  getEnvironmentRootFolderId,
  findFolder,
  createFolder,
  uploadQuoteFile,
  uploadPdfBuffer,
  downloadFileBuffer,
  deleteFile
};