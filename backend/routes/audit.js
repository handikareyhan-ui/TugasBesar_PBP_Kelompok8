'use strict';

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get history of recipient state changes on-chain (Admin & Auditor)
router.get('/history/:recipientID', authenticateToken, authorizeRoles('admin', 'auditor'), auditController.getHistory);

// Get current state on-ledger (Admin & Auditor)
router.get('/state/:recipientID', authenticateToken, authorizeRoles('admin', 'auditor'), auditController.getLedgerState);

// Get all blocks (for visualization) (Admin & Auditor)
router.get('/blocks', authenticateToken, authorizeRoles('admin', 'auditor'), auditController.getBlocks);

module.exports = router;
