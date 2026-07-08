const mongoose = require('mongoose');

const RecipientOffchainSchema = new mongoose.Schema({
  recipientID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nik: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: false,
    default: ''
  },
  region: {
    type: String,
    required: true
  },
  actualIncome: {
    type: Number,
    required: true
  },
  dependents: {
    type: Number,
    required: true,
    default: 2
  },
  documentHash: {
    type: String,
    required: true
  },
  documentPath: {
    type: String,
    default: ""
  },
  salt: {
    type: String,
    required: false
  },
  recipientCommitment: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RecipientOffchain', RecipientOffchainSchema);
