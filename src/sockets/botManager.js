const femaleNicknames = [
    "Asha", "Priya", "Sneha", "Anjali", "Riya", "Neha", "Ishita", "Kavya", "Aditi", "Mehak",
    "Saira", "Zara", "Myra", "Kiara", "Sia", "Diya", "Tara", "Nora", "Maya", "Alisha",
    "Pooja", "Simran", "Tanvi", "Roshni", "Amrita", "Divya", "Swati", "Krutika", "Megha", "Shweta"
];

const femaleResponses = {
    greetings: ["Hey!", "Hi there", "Hello :)", "Hey, how are you?", "Hi! Nice to meet you"],
    wellbeing: ["I'm doing good, you?", "I'm fine, thanks!", "Great, just chilling. Wbu?", "Good, just looking for someone to talk to."],
    identity: ["I'm a girl, if that's what you're asking", "Just a girl looking for friends", "I'm female.", "F here."],
    rejection: ["No, I don't do video calls.", "Sorry, I'm not comfortable with video calls.", "No video, sorry.", "I prefer only texting for now."],
    generic: ["Cool", "Nice", "Haha", "Okay", "Interesting", "Tell me more", "I see"],
    farewell: ["I have to go now, bye!", "Gotta run, nice talking to you!", "I'm bored, skipping. Bye!", "Anyway, talk to you later."]
};

class Bot {
    constructor(id) {
        this.id = `bot_${id}`;
        this.userData = {
            id: this.id,
            nickname: femaleNicknames[id % femaleNicknames.length],
            gender: 'female',
            chatMode: 'text'
        };
        this.activePartnerId = null;
        this.skipTimer = null;
    }

    handleMessage(socket, message, io) {
        const msg = message.toLowerCase();
        let response = "";

        if (msg.includes("hi") || msg.includes("hello") || msg.includes("hey")) {
            response = femaleResponses.greetings[Math.floor(Math.random() * femaleResponses.greetings.length)];
        } else if (msg.includes("how are you") || msg.includes("wbu") || msg.includes("how r u")) {
            response = femaleResponses.wellbeing[Math.floor(Math.random() * femaleResponses.wellbeing.length)];
        } else if (msg.includes("girl") || msg.includes("boy") || msg.includes("gender") || msg.includes("female")) {
            response = femaleResponses.identity[Math.floor(Math.random() * femaleResponses.identity.length)];
        } else if (msg.includes("video") || msg.includes("call") || msg.includes("cam") || msg.includes("show")) {
            response = femaleResponses.rejection[Math.floor(Math.random() * femaleResponses.rejection.length)];
        } else {
            response = femaleResponses.generic[Math.floor(Math.random() * femaleResponses.generic.length)];
        }

        // Simulate typing delay
        setTimeout(() => {
            if (this.activePartnerId === socket.id) {
                socket.emit('receive-message', { message: response });
            }
        }, 1000 + Math.random() * 2000);
    }

    startSkipTimer(socket, onSkip) {
        // Bots skip after 1-3 minutes
        const time = (60 + Math.random() * 120) * 1000;
        this.skipTimer = setTimeout(() => {
            if (this.activePartnerId === socket.id) {
                const farewell = femaleResponses.farewell[Math.floor(Math.random() * femaleResponses.farewell.length)];
                socket.emit('receive-message', { message: farewell });

                setTimeout(() => {
                    if (this.activePartnerId === socket.id) {
                        onSkip(this.id, socket.id);
                    }
                }, 2000);
            }
        }, time);
    }

    clearTimer() {
        if (this.skipTimer) {
            clearTimeout(this.skipTimer);
            this.skipTimer = null;
        }
    }
}

const bots = Array.from({ length: 30 }, (_, i) => new Bot(i));
const availableBots = [...bots];
const activeBotMatches = new Map(); // botId -> userId

module.exports = {
    getAvailableBot: () => {
        if (availableBots.length === 0) return null;
        return availableBots.shift();
    },
    releaseBot: (botId) => {
        const bot = bots.find(b => b.id === botId);
        if (bot) {
            bot.activePartnerId = null;
            bot.clearTimer();
            if (!availableBots.includes(bot)) {
                availableBots.push(bot);
            }
        }
    },
    handleBotMessage: (botId, socket, message, io) => {
        const bot = bots.find(b => b.id === botId);
        if (bot) bot.handleMessage(socket, message, io);
    },
    handleBotCall: (botId, socket) => {
        const bot = bots.find(b => b.id === botId);
        if (bot) {
            const response = femaleResponses.rejection[Math.floor(Math.random() * femaleResponses.rejection.length)];
            setTimeout(() => {
                socket.emit('receive-message', { message: response });
                socket.emit('call-rejected', { from: botId });
            }, 1000);
        }
    },
    bots
};
