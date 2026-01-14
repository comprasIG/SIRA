// C:\SIRA\backend\routes\finanzas\fuentesPago.routes.js
const express = require('express');
const router = express.Router();

const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const loadSiraUser = require("../../middleware/loadSiraUser");
const ctrl = require('../../controllers/finanzas/fuentesPago.controller');

router.use(verifyFirebaseToken, loadSiraUser);

router.param('id', (req, res, next, val) => {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: 'El id debe ser numérico y > 0.' });
  next();
});

// GET /api/finanzas/fuentes-pago?soloActivas=true
router.get('/fuentes-pago', ctrl.listFuentes);

// POST /api/finanzas/fuentes-pago
router.post('/fuentes-pago', ctrl.crearFuente);

// PUT /api/finanzas/fuentes-pago/:id
router.put('/fuentes-pago/:id', ctrl.actualizarFuente);

// DELETE (soft) /api/finanzas/fuentes-pago/:id
router.delete('/fuentes-pago/:id', ctrl.desactivarFuente);

module.exports = router;
