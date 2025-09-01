// C:\SIRA\backend\services\googleDrive.js

const { google } = require('googleapis');
const stream = require('stream');

// --- CONFIGURACIÓN (sin cambios) ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // ID de la carpeta raíz "SIRA"
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

// --- Creación del cliente OAuth2 (sin cambios) ---
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

/**
 * Busca una carpeta por nombre dentro de una carpeta padre. Si no la encuentra, la crea.
 * @param {object} driveService - La instancia del servicio de Google Drive autenticado.
 * @param {string} parentFolderId - El ID de la carpeta donde buscar.
 * @param {string} folderName - El nombre de la carpeta a buscar o crear.
 * @returns {Promise<string>} El ID de la carpeta encontrada o recién creada.
 */
const findOrCreateFolder = async (driveService, parentFolderId, folderName) => {
  // Escapamos comillas simples en el nombre de la carpeta para evitar errores en la consulta
  const escapedFolderName = folderName.replace(/'/g, "\\'");
  const query = `name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`;

  try {
    const res = await driveService.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files.length > 0) {
      console.log(`Carpeta encontrada: ${folderName} (ID: ${res.data.files[0].id})`);
      return res.data.files[0].id;
    } else {
      console.log(`Carpeta no encontrada: ${folderName}. Creando...`);
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      };

      // --- CORRECCIÓN APLICADA AQUÍ ---
      // Se cambió el parámetro obsoleto 'resource' por el correcto 'requestBody'.
      const newFolder = await driveService.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });

      console.log(`Carpeta creada: ${folderName} (ID: ${newFolder.data.id})`);
      return newFolder.data.id;
    }
  } catch (error) {
    console.error(`Error al buscar o crear la carpeta ${folderName}:`, error);
    throw error;
  }
};

/**
 * Sube múltiples archivos a una estructura de carpetas dinámica dentro de Google Drive.
 */
const uploadRequisitionFiles = async (files, departmentAbbreviation, requisitionNumber) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // La lógica de creación de carpetas y subida de archivos se mantiene igual
    const requisicionesFolderId = await findOrCreateFolder(drive, DRIVE_FOLDER_ID, 'REQUISICIONES');
    const departmentFolderId = await findOrCreateFolder(drive, requisicionesFolderId, departmentAbbreviation);
    const targetFolderId = await findOrCreateFolder(drive, departmentFolderId, requisitionNumber);

    const uploadPromises = files.map(fileObject => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileObject.buffer);

      return drive.files.create({
        media: {
          mimeType: fileObject.mimetype,
          body: bufferStream,
        },
        requestBody: {
          name: fileObject.originalname,
          parents: [targetFolderId],
        },
        fields: 'id, name, webViewLink',
      });
    });

    const results = await Promise.all(uploadPromises);
    const uploadedFilesData = results.map(res => res.data);
    
    console.log('Todos los archivos fueron subidos exitosamente:', uploadedFilesData);
    return uploadedFilesData;

  } catch (error) {
    console.error('Error durante el proceso de subida de archivos de requisición:', error);
    throw error;
  }
};

module.exports = { uploadRequisitionFiles };