//C:\SIRA\backend\routes\auth.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

router.get("/me", verifyFirebaseToken, (req, res) => {
  // Te devuelve lo que decodificó Firebase
  res.json({ firebaseUser: req.firebaseUser });
});

module.exports = router;
