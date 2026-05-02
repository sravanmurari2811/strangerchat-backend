// Global matchmaking queues
const queues = { text: [], video: [] };
const activePairs = new Map();

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`);

        socket.on('join-matchmaking', (userData) => {
            if (!userData) return;

            // Clean any existing state
            handleCleanup(socket.id);

            const { nickname, gender, chatMode } = userData;
            const mode = (chatMode === 'video' || chatMode === 'text') ? chatMode : 'text';

            socket.userData = {
                id: socket.id,
                nickname: nickname || 'Stranger',
                gender: gender || 'other',
                chatMode: mode
            };

            console.log(`[Queue] User ${socket.id} joined ${mode} queue`);
            findMatch(socket);
        });

        const findMatch = (socket) => {
            if (!socket || !socket.userData) return;
            const mode = socket.userData.chatMode;
            const targetQueue = queues[mode];

            // 1. Remove self from all queues using splice (to maintain array references)
            ['text', 'video'].forEach(m => {
                let idx;
                while ((idx = queues[m].indexOf(socket.id)) !== -1) {
                    queues[m].splice(idx, 1);
                }
            });

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

                console.log(`[Matchmaking] MATCHED: ${socket.id} <-> ${peerSocket.id} [${mode}]`);

                // Emit to both users
                socket.emit('matched', {
                    peerId: peerSocket.id,
                    peerNickname: peerSocket.userData?.nickname || 'Stranger',
                    mode,
                    initiator: true
                });

                peerSocket.emit('matched', {
                    peerId: socket.id,
                    peerNickname: socket.userData.nickname,
                    mode,
                    initiator: false
                });
            } else {
                // No peer found, add this user to the queue
                targetQueue.push(socket.id);
                socket.emit('waiting');
                console.log(`[Matchmaking] ${socket.id} is waiting in ${mode}. Queue size: ${targetQueue.length}`);
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

            // Remove from all queues using splice
            ['text', 'video'].forEach(m => {
                let idx;
                while ((idx = queues[m].indexOf(socketId)) !== -1) {
                    queues[m].splice(idx, 1);
                }
            });
        };

        socket.on('send-message', ({ to, message }) => {
            // Verify pair relationship before relaying
            if (activePairs.get(socket.id) === to) {
                io.to(to).emit('receive-message', { message });
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

        // WebRTC Signaling Relays
        socket.on('request-call', ({ to, type }) => io.to(to).emit('incoming-call', { from: socket.id, type }));
        socket.on('accept-call', ({ to, type }) => io.to(to).emit('call-accepted', { from: socket.id, type }));
        socket.on('decline-call', ({ to }) => io.to(to).emit('call-declined', { from: socket.id }));
        socket.on('end-call', ({ to }) => io.to(to).emit('call-ended'));
        socket.on('offer', ({ to, offer }) => io.to(to).emit('offer', { from: socket.id, offer }));
        socket.on('answer', ({ to, answer }) => io.to(to).emit('answer', { from: socket.id, answer }));
        socket.on('ice-candidate', ({ to, candidate }) => io.to(to).emit('ice-candidate', { from: socket.id, candidate }));
    });
};
