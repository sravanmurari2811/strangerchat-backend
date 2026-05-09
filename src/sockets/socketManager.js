const { bots, handleBotMessage, handleBotCall, releaseBot } = require('./botManager');

// Global matchmaking queues
// Initialize queue with bot IDs so they are at the front of the ordered queue
const queues = { text: bots.map(b => b.id) };
const activePairs = new Map();
let onlineCount = 0;

module.exports = (io) => {
    const emitOnlineCount = () => {
        // Show human count + bot count
        io.emit('online-count', onlineCount + bots.length);
    };

    io.on('connection', (socket) => {
        onlineCount++;
        console.log(`[Socket] Connected: ${socket.id}. Online: ${onlineCount}`);
        emitOnlineCount();

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

            // 1. Remove self from queue if already present
            let selfIdx;
            while ((selfIdx = targetQueue.indexOf(socket.id)) !== -1) {
                targetQueue.splice(selfIdx, 1);
            }

            // 2. Search for a partner in the queue (ordered)
            let peerId = null;
            let peerSocket = null;
            let matchedBot = null;

            while (targetQueue.length > 0) {
                const candidateId = targetQueue.shift();

                if (candidateId.startsWith('bot_')) {
                    // It's a bot!
                    const bot = bots.find(b => b.id === candidateId);
                    if (bot && !bot.activePartnerId) {
                        peerId = candidateId;
                        matchedBot = bot;
                        break;
                    }
                } else {
                    // It's a human!
                    const candidateSocket = io.sockets.sockets.get(candidateId);
                    if (candidateSocket && candidateSocket.connected && candidateId !== socket.id && !activePairs.has(candidateId)) {
                        peerId = candidateId;
                        peerSocket = candidateSocket;
                        break;
                    }
                }
            }

            if (peerId) {
                // Match found!
                if (matchedBot) {
                    // Match with Bot (with the requested 2-4s delay)
                    socket.emit('waiting');
                    const matchDelay = 2000 + Math.random() * 2000;

                    setTimeout(() => {
                        if (socket.connected && !activePairs.has(socket.id)) {
                            matchedBot.activePartnerId = socket.id;
                            activePairs.set(socket.id, matchedBot.id);

                            console.log(`[Matchmaking] MATCHED User ${socket.id} <-> Bot ${matchedBot.id}`);

                            socket.emit('matched', {
                                peerId: matchedBot.id,
                                peerNickname: matchedBot.userData.nickname,
                                mode: 'text',
                                initiator: true
                            });

                            matchedBot.startSkipTimer(socket, (botId, userId) => {
                                const userSocket = io.sockets.sockets.get(userId);
                                if (userSocket) {
                                    handleCleanup(userId);
                                    userSocket.emit('peer-disconnected');
                                    setTimeout(() => {
                                        if (userSocket.connected) findMatch(userSocket);
                                    }, 1500);
                                }
                            });
                        } else {
                            // User disconnected or matched otherwise during delay
                            // Put bot back to the FRONT of the queue since the match didn't happen
                            targetQueue.unshift(matchedBot.id);
                            matchedBot.activePartnerId = null;
                        }
                    }, matchDelay);

                } else if (peerSocket) {
                    // Match with Human (also adding the requested 2-4s delay for consistency)
                    activePairs.set(socket.id, peerSocket.id);
                    activePairs.set(peerSocket.id, socket.id);

                    socket.emit('waiting');
                    peerSocket.emit('waiting');

                    const matchDelay = 2000 + Math.random() * 2000;

                    setTimeout(() => {
                        if (socket.connected && peerSocket.connected && activePairs.get(socket.id) === peerSocket.id) {
                            console.log(`[Matchmaking] MATCHED: ${socket.id} <-> ${peerSocket.id}`);

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
                        }
                    }, matchDelay);
                }
            } else {
                // No partner available right now, add self to the queue
                targetQueue.push(socket.id);
                socket.emit('waiting');
                console.log(`[Matchmaking] ${socket.id} is waiting. Queue size: ${targetQueue.length}`);
            }
        };

        const handleCleanup = (socketId) => {
            const peerId = activePairs.get(socketId);
            if (peerId) {
                if (peerId.startsWith('bot_')) {
                    // Release bot and put it back to the END of the queue
                    releaseBot(peerId);
                    if (!queues.text.includes(peerId)) {
                        queues.text.push(peerId);
                    }
                } else {
                    io.to(peerId).emit('peer-disconnected');
                    activePairs.delete(peerId);
                }
                activePairs.delete(socketId);
                console.log(`[Cleanup] Unpaired ${socketId} and ${peerId}`);
            }

            // Remove from queue if present
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

        socket.on('webrtc-signal', ({ to, signal }) => {
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('webrtc-signal', { from: socket.id, signal });
            }
        });

        socket.on('next-user', () => {
            handleCleanup(socket.id);
            findMatch(socket);
        });

        socket.on('leave-chat', () => {
            handleCleanup(socket.id);
        });

        socket.on('disconnect', (reason) => {
            onlineCount = Math.max(0, onlineCount - 1);
            console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
            emitOnlineCount();
            handleCleanup(socket.id);
        });
    });
};
