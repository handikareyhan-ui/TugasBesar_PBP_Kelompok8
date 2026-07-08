'use strict';

const express = require('express');
const router = express.Router();
const eligibilityController = require('../controllers/eligibilityController');
const { authenticateToken } = require('../middleware/auth');

// Verify ZKP eligibility proof (Allows any logged-in user to check/verify)
router.post('/verify', authenticateToken, eligibilityController.verifyEligibility);

module.exports = router;
