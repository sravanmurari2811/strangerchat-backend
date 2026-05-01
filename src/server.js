const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const socketManager = require('./sockets/socketManager');

const app = express();
const server = http.createServer(app);

// 1. Production Security Headers
app.use(helmet());

// 2. CORS configuration - Securely allow your frontend
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// 3. Health Check / Cron Job Endpoint
// Logging this helps you see in Render logs if your cron job is working
app.get('/health', (req, res) => {
    console.log(`[Ping] Health check at ${new Date().toISOString()}`);
    res.status(200).json({
        status: 'online',
        uptime: Math.floor(process.uptime()) + 's'
    });
});

// 4. Socket.io with production tuning
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

// 5. Initialize matchmaking logic
socketManager(io);

// 6. Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Fatal Error]:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `>>> StrangerChat Backend: Live on port ${PORT}`);
    console.log(`>>> Monitoring active for cron job hits on /health`);
});
