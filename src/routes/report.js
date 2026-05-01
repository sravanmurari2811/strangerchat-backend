const express = require('express');
const router = express.Router();
const Report = require('../models/Report');

router.post('/', async (req, res) => {
    try {
        const { reporterId, reportedId, reason } = req.body;
        const report = new Report({
            reporterId,
            reportedId,
            reason
        });
        await report.save();
        res.status(201).json({ message: 'Report submitted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

module.exports = router;
