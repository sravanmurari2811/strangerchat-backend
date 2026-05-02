const queues = { text: [], video: [] };
const activePairs = new Map();

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('join-matchmaking', (userData) => {
            const { nickname, gender, chatMode } = userData;
            socket.userData = { id: socket.id, nickname: nickname || 'Stranger', gender, chatMode };
            findMatch(socket);
        });

        const findMatch = (socket) => {
            if (!socket.userData) return;
            const mode = socket.userData.chatMode;
            const targetQueue = queues[mode];

            const existingIdx = targetQueue.findIndex(s => s.id === socket.id);
            if (existingIdx !== -1) targetQueue.splice(existingIdx, 1);

            const matchIndex = targetQueue.findIndex(peer => peer.id !== socket.id);
            if (matchIndex !== -1) {
                const peer = targetQueue.splice(matchIndex, 1)[0];
                activePairs.set(socket.id, peer.id);
                activePairs.set(peer.id, socket.id);

                io.to(socket.id).emit('matched', { peerId: peer.id, peerNickname: peer.userData.nickname, mode, initiator: true });
                io.to(peer.id).emit('matched', { peerId: socket.id, peerNickname: socket.userData.nickname, mode, initiator: false });
            } else {
                targetQueue.push(socket);
                socket.emit('waiting');
            }
        };

        socket.on('request-call', ({ to, type }) => {
            io.to(to).emit('incoming-call', { from: socket.id, type });
        });

        socket.on('accept-call', ({ to, type }) => {
            io.to(to).emit('call-accepted', { from: socket.id, type });
        });

        socket.on('decline-call', ({ to }) => {
            io.to(to).emit('call-declined', { from: socket.id });
        });

        socket.on('end-call', ({ to }) => {
            io.to(to).emit('call-ended');
        });

        socket.on('offer', ({ to, offer }) => io.to(to).emit('offer', { from: socket.id, offer }));
        socket.on('answer', ({ to, answer }) => io.to(to).emit('answer', { from: socket.id, answer }));
        socket.on('ice-candidate', ({ to, candidate }) => io.to(to).emit('ice-candidate', { from: socket.id, candidate }));

        socket.on('send-message', ({ to, message }) => {
            if (activePairs.get(socket.id) === to) io.to(to).emit('receive-message', { message });
        });

        socket.on('next-user', () => {
            handleDisconnect(socket);
            findMatch(socket);
        });

        socket.on('leave-chat', () => {
            handleDisconnect(socket);
        });

        const handleDisconnect = (socket) => {
            const peerId = activePairs.get(socket.id);
            if (peerId) {
                io.to(peerId).emit('peer-disconnected');
                activePairs.delete(socket.id);
                activePairs.delete(peerId);
            }
            queues.text = queues.text.filter(s => s.id !== socket.id);
            queues.video = queues.video.filter(s => s.id !== socket.id);
        };

        socket.on('disconnect', () => handleDisconnect(socket));
    });
};
