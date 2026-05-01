/**
 * Matchmaking and WebRTC Signaling Manager
 *
 * Production-ready features:
 * - Isolated queues for different chat modes
 * - Robust disconnect handling
 * - Clean initiator assignment
 */

const queues = {
    text: [],
    video: []
};

const activePairs = new Map(); // socketId -> peerSocketId

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`);

        socket.on('join-matchmaking', (userData) => {
            const { nickname, gender, chatMode } = userData;

            socket.userData = {
                id: socket.id,
                nickname: nickname || 'Anonymous',
                gender,
                chatMode: chatMode === 'text' ? 'text' : 'video'
            };

            findMatch(socket);
        });

        const findMatch = (socket) => {
            if (!socket.userData) return;

            const mode = socket.userData.chatMode;
            const targetQueue = queues[mode];

            // Remove existing entry in queue if any
            const existingIndex = targetQueue.findIndex(s => s.id === socket.id);
            if (existingIndex !== -1) targetQueue.splice(existingIndex, 1);

            // Find a peer in the same mode queue
            const matchIndex = targetQueue.findIndex(peer => peer.id !== socket.id);

            if (matchIndex !== -1) {
                const peer = targetQueue.splice(matchIndex, 1)[0];

                activePairs.set(socket.id, peer.id);
                activePairs.set(peer.id, socket.id);

                // Signaling: Notify both parties
                // Initiator is the one who joined last (socket)
                io.to(socket.id).emit('matched', {
                    peerId: peer.id,
                    peerNickname: peer.userData.nickname,
                    mode: mode,
                    initiator: true
                });

                io.to(peer.id).emit('matched', {
                    peerId: socket.id,
                    peerNickname: socket.userData.nickname,
                    mode: mode,
                    initiator: false
                });

                console.log(`[Match] ${mode}: ${socket.id} <-> ${peer.id}`);
            } else {
                targetQueue.push(socket);
                socket.emit('waiting');
                console.log(`[Queue] ${mode}: ${socket.id} added`);
            }
        };

        // WebRTC Signaling Relay
        socket.on('offer', ({ to, offer }) => {
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('offer', { from: socket.id, offer });
            }
        });

        socket.on('answer', ({ to, answer }) => {
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('answer', { from: socket.id, answer });
            }
        });

        socket.on('ice-candidate', ({ to, candidate }) => {
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('ice-candidate', { from: socket.id, candidate });
            }
        });

        // Chat Message Relay
        socket.on('send-message', ({ to, message }) => {
            if (message && message.length < 5000 && activePairs.get(socket.id) === to) {
                io.to(to).emit('receive-message', { from: socket.id, message });
            }
        });

        socket.on('next-user', () => {
            handleDisconnect(socket);
            findMatch(socket);
        });

        const handleDisconnect = (socket) => {
            const peerId = activePairs.get(socket.id);
            if (peerId) {
                io.to(peerId).emit('peer-disconnected');
                activePairs.delete(socket.id);
                activePairs.delete(peerId);
            }

            // Clean up queues
            queues.text = queues.text.filter(s => s.id !== socket.id);
            queues.video = queues.video.filter(s => s.id !== socket.id);
        };

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
            handleDisconnect(socket);
        });
    });
};
