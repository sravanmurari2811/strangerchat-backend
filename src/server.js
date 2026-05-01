const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const socketManager = require('./sockets/socketManager');

const app = express();
const server = http.createServer(app);

// Basic security headers
app.use(helmet());

// CORS configuration for production
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Health check for monitoring
app.get('/health', (req, res) => res.status(200).send('OK'));

// Socket.io with production-tuned settings
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000, // 1 minute timeout for stale connections
    transports: ['websocket'] // Prioritize WebSockets
});

// Initialize the matchmaking engine
socketManager(io);

// Catch-all error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`>>> StrangerChat Server: Online on port ${PORT}`);
});
