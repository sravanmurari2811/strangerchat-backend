const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporterId: { type: String, required: true },
    reportedId: { type: String, required: true }, // Using socket IDs or session IDs
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' }
});

module.exports = mongoose.model('Report', reportSchema);
