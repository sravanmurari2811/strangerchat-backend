// Global matchmaking queues
const queues = { text: [] };
const activePairs = new Map();

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`);

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
                // No peer found, add this user to the queue
                targetQueue.push(socket.id);
                socket.emit('waiting');
                console.log(`[Matchmaking] ${socket.id} is waiting in text. Queue size: ${targetQueue.length}`);
            }
        };

        const handleCleanup = (socketId) => {
            // Unpair from existing partner if any
            const peerId = activePairs.get(socketId);
            if (peerId) {
                io.to(peerId).emit('peer-disconnected');
                activePairs.delete(socketId);
                activePairs.delete(peerId);
                console.log(`[Cleanup] Unpaired ${socketId} and ${peerId}`);
            }

            // Remove from queue
            let idx;
            while ((idx = queues.text.indexOf(socketId)) !== -1) {
                queues.text.splice(idx, 1);
            }
        };

        socket.on('send-message', ({ to, message }) => {
            // Verify pair relationship before relaying
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('receive-message', { message });
            }
        });

        socket.on('call-user', ({ to, type }) => {
            // Verify pair relationship before relaying call request
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('call-request', { from: socket.id, type });
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
            console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
            handleCleanup(socket.id);
        });
    });
};
