const Ban = require('../models/Ban');

const checkBan = async (req, res, next) => {
    try {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const ban = await Ban.findOne({ ip });

        if (ban) {
            if (!ban.expiresAt || ban.expiresAt > new Date()) {
                return res.status(403).json({ error: 'Your IP is banned due to community guidelines violation.' });
            } else {
                // Ban expired
                await Ban.deleteOne({ ip });
            }
        }
        next();
    } catch (err) {
        next(); // Proceed if DB check fails to avoid lockout on DB error, or handle as needed
    }
};

module.exports = checkBan;
