const express = require("express");
const router = express.Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { getRoles } = require("../controllers/roles.controller");

router.get("/", verifyFirebaseToken, getRoles);

module.exports = router;
