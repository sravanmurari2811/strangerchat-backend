const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    reason: { type: String },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ban', banSchema);
