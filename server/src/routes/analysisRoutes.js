const express = require("express");
const router = express.Router();

const { analyzeMarket } = require("../controllers/analysisController");

router.post("/", analyzeMarket);

module.exports = router;