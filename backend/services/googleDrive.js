// C:\\SIRA\\backend\\services\\googleDrive.js
/**
 * =================================================================================================
 * SERVICIO: Google Drive (Versión 6.0 - Carpeta Única por Requisición)
 * =================================================================================================
 * @file googleDrive.js
 * @description Maneja toda la interacción con Google Drive conservando una única estructura
 *              por requisición: Ambiente -> Departamento -> Requisición -> (subcarpetas por etapa).
 *              Todas las órdenes de compra y pagos cuelgan de la carpeta de la requisición.
 */

'use strict';

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
// --- HELPERS DE CARPETA Y NOMBRES ---
// ============================================================

let environmentRootFolderId = null;

const sanitizeSegment = (segment, fallback = 'SIN_NOMBRE') => {
  const raw = (segment ?? '').toString().trim();
  const base = raw.length > 0 ? raw : fallback;
  return base.replace(/[\\/:*?"<>|]/g, '_');
};

const sanitizeFileName = (fileName, fallback = 'archivo') => {
  const raw = (fileName ?? '').toString().trim();
  const base = raw.length > 0 ? raw : fallback;
  return base.replace(/[\\/:*?"<>|]/g, '_');
};

const getDeptSegment = (deptoCode) => sanitizeSegment(deptoCode || 'SIN_DEPTO');
const getReqSegment = (reqNum) => sanitizeSegment(reqNum || 'SIN_REQUISICION');
const getOcSegment = (ocNumber) => {
  const normalized = (ocNumber ?? '').toString().trim();
  const withPrefix = normalized.toUpperCase().startsWith('OC-')
    ? normalized
    : `OC-${normalized}`;
  return sanitizeSegment(withPrefix || 'OC_SIN_NUMERO');
};

const STRUCTURE = {
  requisition: {
    attachments: '01 - Adjuntos Requisicion',
    approvedPdf: '02 - Requisicion Aprobada',
    quotes: '03 - Cotizaciones',
    ordersRoot: '04 - Ordenes de Compra',
  },
  oc: {
    pdf: '01 - PDF',
    evidences: '02 - Evidencias Recoleccion',
    payments: '03 - Pagos',
  },
  misc: {
    genericUploads: '__UPLOADS_LIBRES__',
  }
};

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

const resolveFolderPath = async (folderPath, createMissing = true) => {
  const sanitizedSegments = folderPath.map(segment => sanitizeSegment(segment)).filter(Boolean);
  let currentParentId = await getEnvironmentRootFolderId();

  for (const segment of sanitizedSegments) {
    let folderId = await findFolder(segment, currentParentId);
    if (!folderId) {
      if (!createMissing) {
        return null;
      }
      console.log(`[Drive] Creando sub-carpeta: ${segment} en ${currentParentId}`);
      folderId = await createFolder(segment, currentParentId);
    }
    currentParentId = folderId;
  }

  return { folderId: currentParentId, sanitizedSegments };
};

const buildRequisitionPath = (deptoCode, reqNum, ...extraSegments) => [
  getDeptSegment(deptoCode),
  getReqSegment(reqNum),
  ...extraSegments,
];

const uploadBufferToPath = async (fileBuffer, fileName, mimeType, folderPath) => {
  const resolved = await resolveFolderPath(folderPath, true);
  if (!resolved) {
    throw new Error('No se pudo resolver/crear la ruta en Drive.');
  }

  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  const media = { mimeType, body: bufferStream };
  const fileMetadata = {
    name: sanitizeFileName(fileName),
    parents: [resolved.folderId],
  };

  const file = await drive().files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  console.log(`[Drive] Archivo subido: ${file.data.name} (ID: ${file.data.id})`);
  return { ...file.data, folderId: resolved.folderId, folderPath: resolved.sanitizedSegments };
};

const uploadMulterFileToPath = async (multerFile, folderPath, overrideName = null) => {
  if (!multerFile || !multerFile.buffer) {
    throw new Error('Archivo inválido para subir a Drive.');
  }

  const resolved = await resolveFolderPath(folderPath, true);
  if (!resolved) {
    throw new Error('No se pudo resolver/crear la ruta en Drive.');
  }

  const bufferStream = new stream.PassThrough();
  bufferStream.end(multerFile.buffer);

  const media = {
    mimeType: multerFile.mimetype || 'application/octet-stream',
    body: bufferStream,
  };

  const fileMetadata = {
    name: sanitizeFileName(overrideName || multerFile.originalname || 'archivo'),
    parents: [resolved.folderId],
  };

  const file = await drive().files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  console.log(`[Drive] Archivo subido: ${file.data.name} (ID: ${file.data.id})`);
  return { ...file.data, folderId: resolved.folderId, folderPath: resolved.sanitizedSegments };
};

const getFolderInfoByPath = async (folderPath) => {
  const resolved = await resolveFolderPath(folderPath, false);
  if (!resolved) return null;

  try {
    const res = await drive().files.get({
      fileId: resolved.folderId,
      fields: 'id, name, webViewLink',
    });
    return res.data;
  } catch (error) {
    console.error('[Drive] Error obteniendo link de carpeta:', error.message);
    return null;
  }
};

// ============================================================
// --- FUNCIONES DE SUBIDA POR FLUJO DE NEGOCIO ---
// ============================================================

const uploadRequisitionFiles = async (files, deptoCode, reqNum) => {
  if (!files || files.length === 0) {
    return [];
  }

  const folderPath = buildRequisitionPath(
    deptoCode,
    reqNum,
    STRUCTURE.requisition.attachments
  );

  const uploadedFiles = [];
  for (const file of files) {
    try {
      const uploadedFile = await uploadMulterFileToPath(file, folderPath);
      uploadedFiles.push(uploadedFile);
    } catch (error) {
      console.error(`[Drive] Falló la subida de ${file.originalname} para ${reqNum}.`, error);
    }
  }

  return uploadedFiles;
};

const uploadRequisitionPdf = async (pdfBuffer, fileName, deptoCode, reqNum) => {
  const folderPath = buildRequisitionPath(
    deptoCode,
    reqNum,
    STRUCTURE.requisition.approvedPdf
  );

  return uploadBufferToPath(
    pdfBuffer,
    fileName,
    'application/pdf',
    folderPath
  );
};

const uploadQuoteToReqFolder = async (multerFile, deptoCode, reqNum, providerName) => {
  const folderPath = buildRequisitionPath(
    deptoCode,
    reqNum,
    STRUCTURE.requisition.quotes,
    sanitizeSegment(providerName || 'Proveedor_Desconocido')
  );

  return uploadMulterFileToPath(multerFile, folderPath);
};

const uploadOcPdfBuffer = async (pdfBuffer, fileName, deptoCode, reqNum, ocNumber) => {
  const folderPath = buildRequisitionPath(
    deptoCode,
    reqNum,
    STRUCTURE.requisition.ordersRoot,
    getOcSegment(ocNumber),
    STRUCTURE.oc.pdf
  );

  const uploaded = await uploadBufferToPath(
    pdfBuffer,
    fileName,
    'application/pdf',
    folderPath
  );

  const folderInfo = await getFolderInfoByPath(folderPath);
  return {
    ...uploaded,
    fileLink: uploaded.webViewLink,
    folderLink: folderInfo?.webViewLink || null,
  };
};

const uploadOcEvidenceFile = async (multerFile, deptoCode, reqNum, ocNumber, fileName) => {
  const folderPath = buildRequisitionPath(
    deptoCode,
    reqNum,
    STRUCTURE.requisition.ordersRoot,
    getOcSegment(ocNumber),
    STRUCTURE.oc.evidences
  );

  return uploadMulterFileToPath(multerFile, folderPath, fileName);
};

const uploadOcPaymentReceipt = async (multerFile, deptoCode, reqNum, ocNumber, fileName) => {
  const folderPath = buildRequisitionPath(
    deptoCode,
    reqNum,
    STRUCTURE.requisition.ordersRoot,
    getOcSegment(ocNumber),
    STRUCTURE.oc.payments
  );

  return uploadMulterFileToPath(multerFile, folderPath, fileName);
};

const getOcFolderWebLink = async (deptoCode, reqNum, ocNumber) => {
  const folderPath = buildRequisitionPath(
    deptoCode,
    reqNum,
    STRUCTURE.requisition.ordersRoot,
    getOcSegment(ocNumber)
  );

  return getFolderInfoByPath(folderPath);
};

// Ruta genérica de pruebas (mantener compatibilidad)
const uploadFile = async (multerFile) => {
  const folderPath = [STRUCTURE.misc.genericUploads];
  return uploadMulterFileToPath(multerFile, folderPath);
};

// ============================================================
// --- UTILIDADES GENERALES (DESCARGA / BORRADO) ---
// ============================================================

const downloadFileBuffer = async (fileId) => {
  try {
    const response = await drive().files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error al descargar el archivo ${fileId} de Drive:`, error);
    throw new Error(`No se pudo descargar el archivo de Drive con ID ${fileId}.`);
  }
};

const deleteFile = async (fileId) => {
  try {
    await drive().files.delete({ fileId });
    return true;
  } catch (error) {
    if (error.code === 404) {
      console.warn(`[Drive] Intento de borrar archivo no encontrado (ID: ${fileId}).`);
      return true;
    }
    console.error(`[Drive] Error al borrar archivo (ID: ${fileId}):`, error.message);
    throw error;
  }
};

// ============================================================
// --- EXPORTACIONES ---
// ============================================================

module.exports = {
  // Helpers expuestos para tareas puntuales
  getEnvironmentRootFolderId,
  findFolder,
  createFolder,

  // Flujos de negocio
  uploadRequisitionFiles,
  uploadRequisitionPdf,
  uploadQuoteToReqFolder,
  uploadOcPdfBuffer,
  uploadOcEvidenceFile,
  uploadOcPaymentReceipt,
  getOcFolderWebLink,
  uploadFile,

  // Utilidades
  downloadFileBuffer,
  deleteFile,
};

// --- FIN DEL SERVICIO DE GOOGLE DRIVE ---
