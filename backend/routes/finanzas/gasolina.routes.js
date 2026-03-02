// backend/routes/finanzas/gasolina.routes.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const loadSiraUser        = require('../../middleware/loadSiraUser');
const ctrl                = require('../../controllers/finanzas/gasolina.controller');

// ── Multer en memoria (igual que pagosOC.routes.js) ──────────────────────────
const MAX_FILE_MB = 20;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg',
  'image/webp', 'image/heic', 'image/heif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de archivo no permitido. Solo PDF o imagen.'));
  },
});

router.use(verifyFirebaseToken, loadSiraUser);

// GET  /api/finanzas/gasolina/cargas
router.get('/gasolina/cargas', ctrl.listarCargas);

// POST /api/finanzas/gasolina/cargas  (JSON)
router.post('/gasolina/cargas', ctrl.crearCarga);

// GET  /api/finanzas/gasolina/pagos
router.get('/gasolina/pagos', ctrl.listarPagos);

// POST /api/finanzas/gasolina/pagos  (multipart/form-data — campo "comprobante" opcional)
router.post('/gasolina/pagos', upload.single('comprobante'), ctrl.crearPago);

// Manejador de errores Multer
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `El archivo supera ${MAX_FILE_MB}MB.` });
    }
    return res.status(400).json({ error: `Error de carga: ${err.code}` });
  }
  if (err && /Tipo de archivo no permitido/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Error interno.' });
});

module.exports = router;
