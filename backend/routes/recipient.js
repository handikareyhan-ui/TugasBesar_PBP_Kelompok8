'use strict';

const express = require('express');
const router = express.Router();
const recipientController = require('../controllers/recipientController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Secure public check without authentication
router.get('/public/query/:hash', recipientController.queryPublicStatus);

// Register a new recipient (Kemensos or Dinsos role only)
router.post('/', authenticateToken, authorizeRoles('admin'), recipientController.registerRecipient);

// Revoke a recipient's eligibility (Kemensos or Dinsos admin role only)
router.post('/revoke', authenticateToken, authorizeRoles('admin'), recipientController.revokeRecipientAccess);

// List all off-chain recipients (Admin & Auditor role)
router.get('/', authenticateToken, authorizeRoles('admin', 'auditor'), recipientController.getAllRecipients);

// Fetch details for specific recipient
router.get('/:recipientID', authenticateToken, authorizeRoles('admin', 'auditor'), recipientController.getRecipientDetails);

module.exports = router;
