//C:\SIRA\SIRA\backend\routes\finanzas\pagosOC.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const loadSiraUser = require("../../middleware/loadSiraUser");
const pagosOCController = require('../../controllers/finanzas/pagosOC.controller');

// ---- Multer en memoria con límites y filtro de tipos (PDF/Imágenes)
const storage = multer.memoryStorage();
const MAX_FILE_MB = 20;
const allowed = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de archivo no permitido. Solo PDF o imagen.'));
  },
});

router.use(verifyFirebaseToken, loadSiraUser);

// ✅ Valida que :id sea entero positivo
router.param('id', (req, res, next, val) => {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: 'El id debe ser numérico y > 0.' });
  next();
});

// ✅ Valida pagoId
router.param('pagoId', (req, res, next, val) => {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: 'pagoId debe ser numérico y > 0.' });
  next();
});

/**
 * Lista todos los pagos de una OC
 * GET /api/finanzas/oc/:id/pagos
 */
router.get('/oc/:id/pagos', pagosOCController.listarPagos);

/**
 * Registra un pago de OC (subida de comprobante)
 * POST /api/finanzas/oc/:id/pagos
 */
router.post('/oc/:id/pagos', upload.single('comprobante'), pagosOCController.registrarPago);

/**
 * Reversar un pago (append-only)
 * POST /api/finanzas/oc/:id/pagos/:pagoId/reversar
 */
router.post('/oc/:id/pagos/:pagoId/reversar', upload.single('comprobante'), pagosOCController.reversarPago);

// Manejador errores multer
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `El archivo supera ${MAX_FILE_MB}MB.` });
    return res.status(400).json({ error: `Error de carga: ${err.code}` });
  }
  if (err && /Tipo de archivo no permitido/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Error interno.' });
});

module.exports = router;
