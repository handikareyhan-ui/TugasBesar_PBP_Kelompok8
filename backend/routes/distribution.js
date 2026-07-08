'use strict';

const express = require('express');
const router = express.Router();
const distributionController = require('../controllers/distributionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Trigger fund distribution (Bank role only)
router.post('/', authenticateToken, authorizeRoles('bank'), distributionController.distributeBansos);

module.exports = router;
