//C:\SIRA\backend\routes\usuarios.routes.js

const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { getUsuariosConFunciones,getUsuarioActual} = require("../controllers/usuarios.controller");

// Endpoint protegido
router.get("/", verifyFirebaseToken, getUsuariosConFunciones);

const { crearUsuario } = require("../controllers/usuarios.controller");
router.post("/", verifyFirebaseToken, crearUsuario);


router.get("/self", verifyFirebaseToken, getUsuarioActual);



module.exports = router;
