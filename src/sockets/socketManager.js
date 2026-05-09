const { getAvailableBot, releaseBot, handleBotMessage, handleBotCall } = require('./botManager');

// Global matchmaking queues
const queues = { text: [] };
const activePairs = new Map();
let onlineCount = 0;

module.exports = (io) => {
    io.on('connection', (socket) => {
        onlineCount++;
        console.log(`[Socket] Connected: ${socket.id}. Online: ${onlineCount}`);
        io.emit('online-count', onlineCount);

        socket.on('join-matchmaking', (userData) => {
            if (!userData) return;

            // Clean any existing state
            handleCleanup(socket.id);

            const { nickname, gender } = userData;

            socket.userData = {
                id: socket.id,
                nickname: nickname || 'Stranger',
                gender: gender || 'other',
                chatMode: 'text'
            };

            console.log(`[Queue] User ${socket.id} joined text queue`);
            findMatch(socket);
        });

        const findMatch = (socket) => {
            if (!socket || !socket.userData) return;
            const targetQueue = queues.text;

            // 1. Remove self from queue
            let idx;
            while ((idx = targetQueue.indexOf(socket.id)) !== -1) {
                targetQueue.splice(idx, 1);
            }

            // 2. Search for a valid peer
            let peerSocket = null;
            while (targetQueue.length > 0) {
                const candidateId = targetQueue.shift();
                const candidateSocket = io.sockets.sockets.get(candidateId);

                // Peer must: exist, be connected, not be self, and not already matched
                if (candidateSocket && candidateSocket.connected && candidateId !== socket.id && !activePairs.has(candidateId)) {
                    peerSocket = candidateSocket;
                    break;
                }
            }

            if (peerSocket) {
                // Match found! Pair them up
                activePairs.set(socket.id, peerSocket.id);
                activePairs.set(peerSocket.id, socket.id);

                console.log(`[Matchmaking] MATCHED: ${socket.id} <-> ${peerSocket.id}`);

                // Emit to both users
                socket.emit('matched', {
                    peerId: peerSocket.id,
                    peerNickname: peerSocket.userData?.nickname || 'Stranger',
                    mode: 'text',
                    initiator: true
                });

                peerSocket.emit('matched', {
                    peerId: socket.id,
                    peerNickname: socket.userData.nickname,
                    mode: 'text',
                    initiator: false
                });
            } else {
                // No human peer found, try to find a bot
                const bot = getAvailableBot();
                if (bot) {
                    bot.activePartnerId = socket.id;
                    activePairs.set(socket.id, bot.id);
                    // No need to set activePairs.set(bot.id, socket.id) as bot is not a socket

                    console.log(`[Matchmaking] MATCHED User ${socket.id} <-> Bot ${bot.id}`);

                    socket.emit('matched', {
                        peerId: bot.id,
                        peerNickname: bot.userData.nickname,
                        mode: 'text',
                        initiator: true
                    });

                    // Start bot skip timer
                    bot.startSkipTimer(socket, (botId, userId) => {
                        const userSocket = io.sockets.sockets.get(userId);
                        if (userSocket) {
                            handleCleanup(userId);
                            userSocket.emit('peer-disconnected');
                            // Automatically find next for user after bot skips
                            setTimeout(() => {
                                if (userSocket.connected) findMatch(userSocket);
                            }, 1000);
                        }
                    });

                } else {
                    // No peer or bot found, add this user to the queue
                    targetQueue.push(socket.id);
                    socket.emit('waiting');
                    console.log(`[Matchmaking] ${socket.id} is waiting in text. Queue size: ${targetQueue.length}`);
                }
            }
        };

        const handleCleanup = (socketId) => {
            // Unpair from existing partner if any
            const peerId = activePairs.get(socketId);
            if (peerId) {
                if (peerId.startsWith('bot_')) {
                    releaseBot(peerId);
                } else {
                    io.to(peerId).emit('peer-disconnected');
                    activePairs.delete(peerId);
                }
                activePairs.delete(socketId);
                console.log(`[Cleanup] Unpaired ${socketId} and ${peerId}`);
            }

            // Remove from queue
            let idx;
            while ((idx = queues.text.indexOf(socketId)) !== -1) {
                queues.text.splice(idx, 1);
            }
        };

        socket.on('send-message', ({ to, message }) => {
            if (activePairs.get(socket.id) === to) {
                if (to.startsWith('bot_')) {
                    handleBotMessage(to, socket, message, io);
                } else {
                    io.to(to).emit('receive-message', { message });
                }
            }
        });

        socket.on('call-user', ({ to, type }) => {
            if (activePairs.get(socket.id) === to) {
                if (to.startsWith('bot_')) {
                    handleBotCall(to, socket);
                } else {
                    io.to(to).emit('call-request', { from: socket.id, type, nickname: socket.userData.nickname });
                }
            }
        });

        socket.on('accept-call', ({ to }) => {
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('call-accepted', { from: socket.id });
            }
        });

        socket.on('reject-call', ({ to }) => {
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('call-rejected', { from: socket.id });
            }
        });

        // WebRTC Signaling Relay
        socket.on('webrtc-signal', ({ to, signal }) => {
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('webrtc-signal', { from: socket.id, signal });
            }
        });

        socket.on('next-user', () => {
            console.log(`[Socket] Next user requested by ${socket.id}`);
            handleCleanup(socket.id);
            findMatch(socket);
        });

        socket.on('leave-chat', () => {
            console.log(`[Socket] Leave chat: ${socket.id}`);
            handleCleanup(socket.id);
        });

        socket.on('disconnect', (reason) => {
            onlineCount = Math.max(0, onlineCount - 1);
            console.log(`[Socket] Disconnected: ${socket.id} (${reason}). Online: ${onlineCount}`);
            io.emit('online-count', onlineCount);
            handleCleanup(socket.id);
        });
    });
};
