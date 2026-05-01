const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const socketManager = require('./sockets/socketManager');

const app = express();
const server = http.createServer(app);

// 1. Security & Production Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// 2. Health Check for Cron Jobs
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'active', timestamp: new Date().toISOString() });
});

// 3. Socket.io Production Config
const io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

socketManager(io);

// 4. Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`>>> Backend Live on port ${PORT}`);
});
