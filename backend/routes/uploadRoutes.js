// C:\SIRA\backend\routes\uploadRoutes.js

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { uploadFile } = require('../services/googleDrive');

// Configuración de Multer
// Le decimos a Multer que guarde el archivo en la memoria RAM temporalmente.
// Esto es ideal porque no necesitamos guardarlo en el disco de nuestro servidor,
// solo lo necesitamos para enviarlo directamente a Google Drive.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Límite de 50 MB por archivo (puedes ajustarlo)
  },
});

// --- Controlador de la ruta (la lógica) ---
const uploadController = async (req, res) => { // <--- async
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No se subió ningún archivo.' });
    }


    // Por ahora, solo mostraremos la información del archivo en la consola
    // para verificar que está llegando correctamente.
    console.log('Archivo recibido:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
    
    // Y la información de la requisición (ej. el ID)
    console.log('ID de la requisición:', req.params.requisicionId);


    // TODO: Aquí irá la lógica para subir el archivo a Google Drive (Paso 2.3)
     // --- LÓGICA DE GOOGLE DRIVE ---
    // Llamamos a nuestra función de servicio para subir el archivo
    const driveResponse = await uploadFile(req.file);

    // TODO: Aquí debes guardar la información en tu base de datos.
    // Por ejemplo, el ID del archivo de Drive: driveResponse.id
    // Y el ID de la requisición: req.params.requisicionId
    // const requisicionId = req.params.requisicionId;
    // const archivoIdDrive = driveResponse.id;
    // const nombreArchivo = driveResponse.name;
    // const urlArchivo = driveResponse.webViewLink;
    // await db.query('INSERT INTO requisiciones_adjuntos ...');


    // Enviamos una respuesta temporal de éxito.
 res.status(200).send({
      message: '¡Archivo subido a Google Drive exitosamente!',
      fileId: driveResponse.id,
      fileName: driveResponse.name,
      fileLink: driveResponse.webViewLink,
    });

  } catch (error) {
    console.error('Error en el controlador de subida:', error);
    res.status(500).send({ message: 'Error interno del servidor.' });
  }
};


// --- Definición de la Ruta ---
// Esta será una ruta POST, por ejemplo: /api/uploads/requisicion/123/adjunto
// `upload.single('archivoAdjunto')` es el middleware de Multer.
// Le dice que espere un solo archivo en un campo de formulario llamado 'archivoAdjunto'.
router.post(
  '/requisicion/:requisicionId/adjunto',
  upload.single('archivoAdjunto'),
  uploadController
);

module.exports = router;