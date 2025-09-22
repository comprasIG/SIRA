// C:\SIRA\backend\services\googleDrive.js
const { google } = require('googleapis');
const stream = require('stream');

// --- CONFIGURACIÓN ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // Carpeta raíz de tu instancia
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = () => google.drive({ version: 'v3', auth: oauth2Client });

// ============================================================
// Helpers internos
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

const getWebViewLink = async (fileId) => {
  const meta = await drive().files.get({ fileId, fields: 'id, webViewLink' });
  return meta.data.webViewLink || null;
};

// ============================================================
// Carpeta estándar para OC: ORDENES DE COMPRA (PDF)/OC-<NUMERO_OC>
// ============================================================
const ensureOcFolder = async (numeroOc) => {
  const d = drive();
  const rootOcFolderId = await findOrCreateFolder(d, DRIVE_FOLDER_ID, 'ORDENES DE COMPRA (PDF)');
  const ocFolderName = `OC-${numeroOc}`;
  const ocFolderId = await findOrCreateFolder(d, rootOcFolderId, ocFolderName);
  const webViewLink = await getWebViewLink(ocFolderId);
  return { ocFolderId, webViewLink };
};

// ============================================================
// Subidas a carpeta de OC
// ============================================================
const uploadBufferToFolder = async (folderId, buffer, mimeType, fileName) => {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);
  const result = await drive().files.create({
    media: { mimeType, body: bufferStream },
    requestBody: { name: fileName, parents: [folderId] },
    fields: 'id, name, webViewLink, webContentLink',
  });
  return result.data;
};

const uploadPdfToOcFolder = async (pdfBuffer, numeroOc, fileName) => {
  const { ocFolderId, webViewLink: folderWebViewLink } = await ensureOcFolder(numeroOc);
  const file = await uploadBufferToFolder(ocFolderId, pdfBuffer, 'application/pdf', fileName);
  return { ...file, folderWebViewLink, folderId: ocFolderId };
};

const uploadFileToOcFolder = async (fileBuffer, mimeType, numeroOc, fileName) => {
  const { ocFolderId, webViewLink: folderWebViewLink } = await ensureOcFolder(numeroOc);
  const file = await uploadBufferToFolder(ocFolderId, fileBuffer, mimeType, fileName);
  return { ...file, folderWebViewLink, folderId: ocFolderId };
};

// Para rutas con Multer: req.file (comprobante)
const uploadMulterFileToOcFolder = async (fileObject, numeroOc, fileNameOverride) => {
  if (!fileObject || !fileObject.buffer) throw new Error('Archivo inválido.');
  const fname = fileNameOverride || fileObject.originalname;
  return uploadFileToOcFolder(fileObject.buffer, fileObject.mimetype, numeroOc, fname);
};

// ============================================================
// Funciones existentes (se conservan)
// ============================================================
const uploadRequisitionFiles = async (files, departmentAbbreviation, requisitionNumber) => {
  try {
    const d = drive();
    const requisicionesFolderId = await findOrCreateFolder(d, DRIVE_FOLDER_ID, 'REQUISICIONES');
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

const uploadQuoteFiles = async (files, rfqCode, providerName) => {
  try {
    const d = drive();
    const quotesFolderId = await findOrCreateFolder(d, DRIVE_FOLDER_ID, 'COTIZACIONES');
    const rfqFolderId = await findOrCreateFolder(d, quotesFolderId, rfqCode);
    const uploadPromises = files.map(fileObject => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileObject.buffer);
      const fileName = `${rfqCode}_COT_${providerName.replace(/\s+/g, '_')}_${fileObject.originalname}`;
      return d.files.create({
        media: { mimeType: fileObject.mimetype, body: bufferStream },
        requestBody: { name: fileName, parents: [rfqFolderId] },
        fields: 'id, name, webViewLink',
      });
    });
    const results = await Promise.all(uploadPromises);
    return results.map((res, index) => ({ ...res.data, originalName: files[index].originalname }));
  } catch (error) {
    console.error(`Error durante la subida de archivos de cotización para ${rfqCode}:`, error);
    throw error;
  }
};

// Mantengo por compatibilidad, pero mejor usa uploadPdfToOcFolder para OCs
const uploadPdfBuffer = async (pdfBuffer, fileName, rootFolderName, subFolderName) => {
  try {
    const d = drive();
    const rootFolderId = await findOrCreateFolder(d, DRIVE_FOLDER_ID, rootFolderName);
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

const uploadQuoteFile = async (fileObject, rfqCode, providerName) => {
  try {
    const d = drive();
    const quotesFolderId = await findOrCreateFolder(d, DRIVE_FOLDER_ID, 'COTIZACIONES');
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

const downloadFileBuffer = async (fileId) => {
  try {
    const response = await drive().files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error al descargar el archivo ${fileId} de Drive:`, error);
    throw new Error(`No se pudo descargar el archivo de Drive con ID ${fileId}.`);
  }
};

const getFolderIdByPath = async (folderPath) => {
  try {
    const d = drive();
    let parentId = DRIVE_FOLDER_ID;
    for (const folderName of folderPath) {
      const escaped = folderName.replace(/'/g, "\\'");
      const q = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
      const res = await d.files.list({ q, fields: 'files(id, name)', spaces: 'drive' });
      if (!res.data.files.length) return null;
      parentId = res.data.files[0].id;
    }
    return parentId;
  } catch (err) {
    console.error('Error en getFolderIdByPath:', err);
    return null;
  }
};

// Link directo a la carpeta de una OC
const getOcFolderWebLink = async (numeroOc) => {
  const { ocFolderId, webViewLink } = await ensureOcFolder(numeroOc);
  return { folderId: ocFolderId, webViewLink };
};

module.exports = {
  // Nuevos (recomendados para OC)
  ensureOcFolder,
  uploadPdfToOcFolder,
  uploadFileToOcFolder,
  uploadMulterFileToOcFolder,
  getOcFolderWebLink,

  // Existentes (compatibilidad)
  uploadRequisitionFiles,
  uploadQuoteFiles,
  uploadPdfBuffer,
  uploadQuoteFile,
  downloadFileBuffer,
  getFolderIdByPath,
};
