'use strict';

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom format to mask sensitive values (NIK, salt, nonce, etc.)
const maskFormat = winston.format((info) => {
  let message = info.message;
  
  if (typeof message === 'string') {
    // Mask 16-digit Indonesian NIKs
    message = message.replace(/\b\d{16}\b/g, '***MASKED_NIK***');
    
    // Mask salt, nonce values inside JSON-like strings
    message = message.replace(/("salt"\s*:\s*)"\d+"/g, '$1"***MASKED_SALT***"');
    message = message.replace(/("nonce"\s*:\s*)"\d+"/g, '$1"***MASKED_NONCE***"');
    message = message.replace(/(salt\s*=\s*)\d+/g, '$1***MASKED_SALT***');
    message = message.replace(/(nonce\s*=\s*)\d+/g, '$1***MASKED_NONCE***');
    
    // Mask other credentials if they appear in logs
    message = message.replace(/(password\s*=\s*)\S+/g, '$1***MASKED_PASSWORD***');
    message = message.replace(/(secret\s*=\s*)\S+/g, '$1***MASKED_SECRET***');
    
    info.message = message;
  }

  // Also verify metadata objects if any
  if (info.meta && typeof info.meta === 'object') {
    const meta = { ...info.meta };
    if (meta.nik) meta.nik = '***MASKED_NIK***';
    if (meta.salt) meta.salt = '***MASKED_SALT***';
    if (meta.nonce) meta.nonce = '***MASKED_NONCE***';
    if (meta.password) meta.password = '***MASKED_PASSWORD***';
    if (meta.secret) meta.secret = '***MASKED_SECRET***';
    if (meta.witness) meta.witness = '***MASKED_WITNESS***';
    info.meta = meta;
  }

  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    maskFormat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// For development environments, add console output with colorized logs
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

global.logger = logger;
module.exports = logger;
