// C:\SIRA\backend\services\googleDrive.js
/**
 * =================================================================================================
 * SERVICIO: Google Drive (Versión 5.0 - Refactorización de Requisiciones)
 * =================================================================================================
 * @file googleDrive.js
 * @description Maneja toda la interacción con Google Drive.
 * --- HISTORIAL DE CAMBIOS ---
 * v5.0:
 * - Se renombró 'uploadPdfBuffer' a 'uploadOcPdfBuffer' para aclarar que es para Órdenes de Compra.
 * - Se añadió 'uploadRequisitionFiles' para manejar múltiples adjuntos en la creación de requisiciones.
 * - Se añadió 'uploadRequisitionPdf' para manejar el PDF único generado en la aprobación de requisiciones.
 * v4.4: 
 * - Se corrige la lógica de 'getEnvironmentRootFolderId' para usar 'LOCAL'.
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
// --- SECCIÓN 1: HELPERS DE CARPETAS (Sin cambios) ---
// ============================================================

let environmentRootFolderId = null;

/**
 * Encuentra o crea la carpeta raíz del AMBIENTE (PRODUCCION, STAGING o LOCAL)
 */
const getEnvironmentRootFolderId = async () => {
  if (environmentRootFolderId) return environmentRootFolderId;

  const env = process.env.NODE_ENV || 'development';
  let rootFolderName;

  if (env === 'production') {
    rootFolderName = 'PRODUCCION';
  } else if (env === 'staging') {
    rootFolderName = 'STAGING';
  } else {
    rootFolderName = 'LOCAL'; 
  }

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
 * @description Sube un único archivo (buffer) a una estructura de carpetas anidada.
 * Esta es una función de ayuda interna.
 * @param {Buffer} fileBuffer El buffer del archivo.
 * @param {string} fileName El nombre del archivo.
 * @param {string} mimeType El tipo MIME del archivo.
 * @param {string[]} folderPath Un array de nombres de carpetas. Ej: ['DEPTO_TI', 'REQ_001', 'ADJUNTOS']
 * @returns {object} El objeto del archivo subido (id, name, webViewLink, etc.)
 */
const uploadFileToPath = async (fileBuffer, fileName, mimeType, folderPath) => {
  try {
    let currentParentId = await getEnvironmentRootFolderId();

    // 1. Navegar o crear la ruta de carpetas
    for (const folderName of folderPath) {
      let folderId = await findFolder(folderName, currentParentId);
      if (!folderId) {
        console.log(`[Drive] Creando sub-carpeta: ${folderName} en ${currentParentId}`);
        folderId = await createFolder(folderName, currentParentId);
      }
      currentParentId = folderId;
    }

    // 2. Subir el archivo a la carpeta destino
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const media = { mimeType, body: bufferStream };
    const fileMetadata = {
      name: fileName,
      parents: [currentParentId],
    };

    const file = await drive().files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    console.log(`[Drive] Archivo subido: ${file.data.name} (ID: ${file.data.id})`);
    return file.data;

  } catch (error) {
    console.error(`Error durante la subida de '${fileName}' a la ruta [${folderPath.join('/')}]:`, error);
    throw error;
  }
};


// ============================================================
// --- SECCIÓN 2: LÓGICA DE SUBIDA ESPECÍFICA ---
// ============================================================

/**
 * @description Sube múltiples archivos adjuntos (req.files) de una Requisición.
 * Esta es la función que 'generacion.controller.js' necesita.
 * @param {Array<object>} files - El array de archivos de multer (req.files)
 * @param {string} deptoCode - Código del departamento (ej. 'TI')
 * @param {string} reqNum - Número de la requisición (ej. 'TI_0001')
 * @returns {Promise<Array<object>>} Una promesa que resuelve a un array de los archivos subidos.
 */
const uploadRequisitionFiles = async (files, deptoCode, reqNum) => {
  if (!files || files.length === 0) {
    return [];
  }
  
  const folderPath = [deptoCode, reqNum, 'ADJUNTOS_REQ'];
  const uploadedFiles = [];

  // Usamos un bucle 'for...of' para manejar las promesas secuencialmente
  for (const file of files) {
    try {
      const uploadedFile = await uploadFileToPath(
        file.buffer,
        file.originalname,
        file.mimetype,
        folderPath
      );
      uploadedFiles.push(uploadedFile);
    } catch (error) {
      console.error(`[Drive] Falló la subida de ${file.originalname} para ${reqNum}. Saltando...`);
      // Opcional: podrías decidir si lanzar el error y detener la operación
    }
  }
  
  return uploadedFiles;
};


/**
 * @description Sube el PDF único generado al APROBAR una Requisición.
 * Esta es la función que 'vistoBueno.controller.js' necesita.
 * @param {Buffer} pdfBuffer - El buffer del PDF generado.
 * @param {string} fileName - El nombre del archivo (ej. 'TI_0001.pdf')
 * @param {string} deptoCode - Código del departamento (ej. 'TI')
 * @param {string} reqNum - Número de la requisición (ej. 'TI_0001')
 * @returns {Promise<object>} El objeto del archivo subido.
 */
const uploadRequisitionPdf = async (pdfBuffer, fileName, deptoCode, reqNum) => {
  const folderPath = [deptoCode, reqNum, 'PDF_APROBADO'];
  
  return await uploadFileToPath(
    pdfBuffer,
    fileName,
    'application/pdf',
    folderPath
  );
};


/**
 * @description Sube el PDF de una Orden de Compra (OC).
 * (Anteriormente 'uploadPdfBuffer')
 * @param {Buffer} pdfBuffer El buffer del PDF.
 * @param {string} fileName El nombre del archivo.
 * @param {string} folderType El tipo de carpeta (ej. 'OC_FIRMADA')
 * @param {string} reqNum El número de requisición o OC asociado.
 */
const uploadOcPdfBuffer = async (pdfBuffer, fileName, folderType, reqNum) => {
  // Esta función mantiene su lógica original, pero ahora tiene un nombre claro.
  try {
    const envRootId = await getEnvironmentRootFolderId();
    let reqFolderId = await findFolder(reqNum, envRootId);

    if (!reqFolderId) {
      console.log(`[Drive] No se encontró la carpeta ${reqNum}. Creando...`);
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
 * @description Sube un archivo de Cotización (Usado por G-RFQ). (Sin cambios)
 */
const uploadQuoteFile = async (fileBuffer, fileName, mimeType, reqNum, deptoCode, provId) => {
  try {
    const folderPath = [deptoCode, reqNum, 'COTIZACIONES'];
    const finalFileName = `[${provId}]_${fileName}`;

    return await uploadFileToPath(
      fileBuffer,
      finalFileName,
      mimeType,
      folderPath
    );

  } catch (error) {
    console.error(`Error durante la subida de archivo de cotización para ${reqNum}:`, error);
    throw error;
  }
};

const ensureFolder = async (folderName, parentId) => {
  let folderId = await findFolder(folderName, parentId);
  if (!folderId) {
    console.log(`[Drive] Creando sub-carpeta: ${folderName} en ${parentId}`);
    folderId = await createFolder(folderName, parentId);
  }
  return folderId;
};

const uploadMulterFileToOcFolder = async (multerFile, ocCode, fileName, subFolder = null) => {
  if (!multerFile || !multerFile.buffer) {
    throw new Error('Archivo inválido para subir a Drive.');
  }

  const envRootId = await getEnvironmentRootFolderId();
  const ocFolderId = await ensureFolder(ocCode, envRootId);
  const targetFolderId = subFolder ? await ensureFolder(subFolder, ocFolderId) : ocFolderId;

  const bufferStream = new stream.PassThrough();
  bufferStream.end(multerFile.buffer);

  const media = {
    mimeType: multerFile.mimetype || 'application/octet-stream',
    body: bufferStream,
  };

  const fileMetadata = {
    name: fileName || multerFile.originalname || 'archivo_sin_nombre',
    parents: [targetFolderId],
  };

  const file = await drive().files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  console.log(`[Drive] Archivo de OC subido: ${file.data.name} (ID: ${file.data.id})`);
  return file.data;
};

const getOcFolderWebLink = async (ocCode) => {
  try {
    const envRootId = await getEnvironmentRootFolderId();
    const folderId = await findFolder(ocCode, envRootId);
    if (!folderId) return null;

    const res = await drive().files.get({
      fileId: folderId,
      fields: 'id, name, webViewLink',
    });

    return res.data;
  } catch (error) {
    console.error(`[Drive] Error obteniendo link de carpeta de OC (${ocCode}):`, error.message);
    return null;
  }
};

/**
 * @description Descarga un archivo (Usado por G-RFQ Visto Bueno) (Sin cambios)
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
 * @description Borra un archivo de Drive (Usado por G-RFQ al guardar) (Sin cambios)
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

// ============================================================
// --- SECCIÓN 3: EXPORTACIONES (¡ACTUALIZADO!) ---
// ============================================================

module.exports = {
  // Funciones de ayuda
  getEnvironmentRootFolderId,
  findFolder,
  createFolder,
  
  // Funciones de lógica de negocio (Refactorizadas)
  uploadRequisitionFiles,   // <-- ¡NUEVA! Para generacion.controller.js
  uploadRequisitionPdf,     // <-- ¡NUEVA! Para vistoBueno.controller.js

  uploadOcPdfBuffer,        // <-- Renombrada (antes uploadPdfBuffer)
  uploadQuoteFile,

  uploadMulterFileToOcFolder,
  getOcFolderWebLink,
  
  // Funciones de utilidad
  downloadFileBuffer,
  deleteFile
};