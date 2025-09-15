// C:\SIRA\backend\services\googleDrive.js
const { google } = require('googleapis');
const stream = require('stream');

// --- CONFIGURACIÓN ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// --- FUNCIONES INTERNAS (HELPERS) ---

const findOrCreateFolder = async (driveService, parentFolderId, folderName) => {
  const escapedFolderName = folderName.replace(/'/g, "\\'");
  const query = `name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`;
  try {
    const res = await driveService.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    if (res.data.files.length > 0) {
      return res.data.files[0].id;
    } else {
      const fileMetadata = { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentFolderId] };
      const newFolder = await driveService.files.create({ requestBody: fileMetadata, fields: 'id' });
      return newFolder.data.id;
    }
  } catch (error) {
    console.error(`Error al buscar o crear la carpeta ${folderName}:`, error);
    throw error;
  }
};

// --- FUNCIONES EXPORTADAS ---

/**
 * Sube archivos que provienen de una petición de Multer.
 */
const uploadRequisitionFiles = async (files, departmentAbbreviation, requisitionNumber) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const requisicionesFolderId = await findOrCreateFolder(drive, DRIVE_FOLDER_ID, 'REQUISICIONES');
    const departmentFolderId = await findOrCreateFolder(drive, requisicionesFolderId, departmentAbbreviation);
    const targetFolderId = await findOrCreateFolder(drive, departmentFolderId, requisitionNumber);
    const uploadPromises = files.map(fileObject => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileObject.buffer);
      return drive.files.create({
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
 * Sube archivos de cotizaciones que provienen de Multer.
 */
const uploadQuoteFiles = async (files, rfqCode, providerName) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const quotesFolderId = await findOrCreateFolder(drive, DRIVE_FOLDER_ID, 'COTIZACIONES');
        const rfqFolderId = await findOrCreateFolder(drive, quotesFolderId, rfqCode);
        const uploadPromises = files.map(fileObject => {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileObject.buffer);
            const fileName = `${rfqCode}_COT_${providerName.replace(/\s+/g, '_')}_${fileObject.originalname}`;
            return drive.files.create({
                media: { mimeType: fileObject.mimetype, body: bufferStream },
                requestBody: { name: fileName, parents: [rfqFolderId] },
                fields: 'id, name, webViewLink',
            });
        });
        const results = await Promise.all(uploadPromises);
        const uploadedFilesData = results.map((res, index) => ({
            ...res.data,
            originalName: files[index].originalname
        }));
        console.log(`Archivos de cotización subidos para ${rfqCode}:`, uploadedFilesData);
        return uploadedFilesData;
    } catch (error) {
        console.error(`Error durante el proceso de subida de archivos de cotización para ${rfqCode}:`, error);
        throw error;
    }
};

/**
 * Sube un PDF generado en memoria (Buffer) a Google Drive.
 * @param {Buffer} pdfBuffer - El contenido del PDF.
 * @param {string} fileName - El nombre que tendrá el archivo en Drive.
 * @param {string} rootFolderName - El nombre de la carpeta principal (ej: 'ORDENES DE COMPRA (PDF)').
 * @param {string} subFolderName - El nombre de la subcarpeta (ej: el RFQ o el número de OC).
 * @returns {Promise<object>} - Datos del archivo subido (id, name, webViewLink).
 */
const uploadPdfBuffer = async (pdfBuffer, fileName, rootFolderName, subFolderName) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Lógica genérica para crear la estructura de carpetas
    const rootFolderId = await findOrCreateFolder(drive, DRIVE_FOLDER_ID, rootFolderName);
    const targetFolderId = await findOrCreateFolder(drive, rootFolderId, subFolderName);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(pdfBuffer);

    const result = await drive.files.create({
      media: { mimeType: 'application/pdf', body: bufferStream },
      requestBody: { name: fileName, parents: [targetFolderId] },
      fields: 'id, name, webViewLink',
    });

    console.log(`PDF subido a Drive en carpeta ${subFolderName}: ${fileName}`);
    return result.data; // Se devuelve el objeto del archivo creado
  
  } catch (error) {
    // --- ¡CORRECCIÓN IMPORTANTE! ---
    // Ahora el error se registra y se propaga hacia el controlador.
    console.error(`Error CRÍTICO al subir PDF a Drive (${fileName}):`, error);
    // No devolvemos nada, permitiendo que la validación en el controlador falle con un mensaje claro.
    // Opcionalmente, podrías hacer 'throw error;' para detener la ejecución inmediatamente.
    return null; // Devolvemos null para que el controlador pueda manejarlo.
  }
};

/**
 * =================================================================================================
 * -SUBIR PDF DE COTIZACIÓN-RFQ
 * =================================================================================================
 * @description Sube archivos de cotizaciones de proveedores a una estructura de carpetas
 * específica en Google Drive: /COTIZACIONES/[RFQ_CODE]/[Proveedor_Marca]/archivo.pdf
 * @param {object} fileObject - El objeto de archivo que viene de Multer.
 * @param {string} rfqCode - El código del RFQ para la carpeta principal.
 * @param {string} providerName - El nombre del proveedor para la subcarpeta.
 * @returns {Promise<object>} - Datos del archivo subido.
 */
const uploadQuoteFile = async (fileObject, rfqCode, providerName) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const quotesFolderId = await findOrCreateFolder(drive, DRIVE_FOLDER_ID, 'COTIZACIONES');
        const rfqFolderId = await findOrCreateFolder(drive, quotesFolderId, rfqCode);
        const providerFolderId = await findOrCreateFolder(drive, rfqFolderId, providerName.replace(/\s+/g, '_'));

        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileObject.buffer);

        const result = await drive.files.create({
            media: { mimeType: fileObject.mimetype, body: bufferStream },
            requestBody: { name: fileObject.originalname, parents: [providerFolderId] },
            fields: 'id, name, webViewLink',
        });
        
        console.log(`Archivo de cotización subido para ${rfqCode}: ${fileObject.originalname}`);
        return result.data;
    } catch (error) {
        console.error(`Error durante la subida de archivo de cotización para ${rfqCode}:`, error);
        throw error;
    }
};

/**
 * =================================================================================================
 * --- ¡NUEVA FUNCIÓN! ---
 * =================================================================================================
 * @description Descarga el contenido de un archivo de Google Drive a un buffer en memoria.
 * @param {string} fileId - El ID del archivo en Google Drive.
 * @returns {Promise<Buffer>} - Un buffer con los datos del archivo.
 */
const downloadFileBuffer = async (fileId) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`Error al descargar el archivo ${fileId} de Drive:`, error);
        throw new Error(`No se pudo descargar el archivo de Drive con ID ${fileId}.`);
    }
};


module.exports = { 
    uploadRequisitionFiles,
    uploadQuoteFiles,
    uploadPdfBuffer, 
    uploadQuoteFile,
    downloadFileBuffer,
};