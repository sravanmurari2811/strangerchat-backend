const femaleNicknames = [
    "Priya", "Sneha", "Riya", "Alekhya", "Lavanya", "Neha"
];

const femaleResponses = {
    greetings: [
        "Hey!", "Hi there", "Hello :)", "Hey, ela unnav?", "Hi! Nice to meet you",
        "Heyyy", "Hello! What's up?", "Hi, I'm <NAME>. Wbu?", "Namaste!"
    ],
    wellbeing: [
        "I'm doing good, you?", "I'm fine, thanks!", "Bagunnanu, nuvvu?", "Great, just chilling. Wbu?",
        "I'm happy today! How about you?", "I'm okay, just a bit bored tbh.", "Fine, meeru ela unnaru?"
    ],
    identity: [
        "I'm a girl, if that's what you're asking", "Just a girl looking for friends", "I'm female.",
        "F here.", "I'm a woman.", "Obviously a girl lol", "Ammayine :)"
    ],
    rejection: [
        "No, I don't do video calls.", "Sorry, I'm not comfortable with video calls.", "No video, sorry.",
        "I prefer only texting for now.", "No VC, sorry.", "I don't show my face to strangers so soon.",
        "Oddu, video call comfort ledu naku."
    ],
    age: [
        "I'm 21", "I'm 22, and you?", "I'm 20 years old", "Naku 21 years", "Guess my age? Haha, I'm 21.",
        "22 years, nuvvu?"
    ],
    location: [
        "I'm from Mumbai", "I live in Delhi", "I'm from Bangalore", "Hyderabad", "Vizag",
        "I'm based in India, you?", "Somewhere in India :)", "Vijayawada", "Kolkata, hbu?"
    ],
    activity: [
        "Just listening to music", "Nothing much, just bored", "Talking to you!", "Em ledu, just chilling",
        "Watching a movie on Netflix", "Browsing the web", "Em chestunnav?", "Khaali ga unna lol"
    ],
    name: [
        "I'm <NAME>", "My name is <NAME>, what's yours?", "You can call me <NAME>", "I'm <NAME> :)",
        "Naa peru <NAME>", "Perenti ante <NAME> :p"
    ],
    botCheck: [
        "Lol no, I'm real", "Do I sound like a bot? haha", "Haha no, I'm a real person", "I'm real, meeru?",
        "Nenu bot kaadu lol"
    ],
    compliment: [
        "Aww thanks!", "That's sweet", "You're nice", "Haha thank you", "You're making me blush!",
        "Thanks andi :)"
    ],
    socials: [
        "I don't share my Instagram with strangers", "Maybe if we talk more I'll give you my Snap",
        "I'm not on social media much", "Let's just chat here for now.", "Insta oddu, ikkade matladukundam"
    ],
    hobbies: [
        "I love music and dancing", "I like reading novels", "I enjoy traveling and photography",
        "Movies chustu unta"
    ],
    generic: [
        "Cool", "Nice", "Haha", "Okay", "Interesting", "Tell me more", "I see", "Yeah",
        "True", "Avuna?", "Sare", "Oh okay", "Nice!"
    ],
    farewell: [
        "I have to go now, bye!", "Gotta run, nice talking to you!", "I'm bored, skipping. Bye!",
        "Anyway, talk to you later.", "Velli vasthanu, bye!", "Battery low, ttyl!", "Bye!"
    ]
};

const rules = [
    { pattern: /\b(hi|hello|hey|heyy|heyyy|hii|greeting|namaste|namaskaram)\b/i, key: 'greetings' },
    { pattern: /\b(how are you|hru|wbu|how r u|how u doing|status|up to|ela unnav|ela unnaru|bagunnara|bagunnava)\b/i, key: 'wellbeing' },
    { pattern: /\b(girl|boy|gender|female|male|sex|f or m|m or f|lady|woman|ammayi|abbayi|ammayiva|abbayiva)\b/i, key: 'identity' },
    { pattern: /\b(video|call|vc|cam|show|face|see you|video call|ra|vachava|oddu|vc ki)\b/i, key: 'rejection' },
    { pattern: /\b(age|old are you|your age|how old|years old|vayasu|enni years)\b/i, key: 'age' },
    { pattern: /\b(where|location|live|city|from|place|country|state|ekkada|ekada|yekkada)\b/i, key: 'location' },
    { pattern: /\b(doing|up to|what u do|what are you doing|em chestunnav|em chestunnavu|em chestunav|em chesthunnav)\b/i, key: 'activity' },
    { pattern: /\b(name|who are you|your name|called|peru|perenti|mee peru)\b/i, key: 'name' },
    { pattern: /\b(bot|real|fake|human|ai|computer|robot|nijama|ninnu nammocha)\b/i, key: 'botCheck' },
    { pattern: /\b(beautiful|cute|pretty|nice|hot|sexy|gorgeous|sweet|handsome|bagunnav|chaala bagunnav)\b/i, key: 'compliment' },
    { pattern: /\b(insta|instagram|snap|snapchat|whatsapp|number|phone|social|fb|facebook|id|insta id)\b/i, key: 'socials' },
    { pattern: /\b(hobby|hobbies|interest|like to do|fav|favorite|ishtam)\b/i, key: 'hobbies' },
    { pattern: /\b(bye|gtg|goodbye|leave|see ya|ttyl|velli vastha|veltha|velli)\b/i, key: 'farewell' }
];

class Bot {
    constructor(id) {
        this.id = `bot_${id}`;
        this.nickname = femaleNicknames[id % femaleNicknames.length];
        this.userData = {
            id: this.id,
            nickname: this.nickname,
            gender: 'female',
            chatMode: 'text'
        };
        this.activePartnerId = null;
        this.skipTimer = null;
        this.messageCount = 0;
    }

    handleMessage(socket, message, io) {
        this.messageCount++;
        const msg = message.toLowerCase();
        let responseKey = 'generic';

        // Find the best matching rule
        for (const rule of rules) {
            if (rule.pattern.test(msg)) {
                responseKey = rule.key;
                break;
            }
        }

        // Add some variety: occasionally ignore keywords and give a generic response
        if (this.messageCount > 1 && Math.random() < 0.2) {
            responseKey = 'generic';
        }

        let response = this.getRandom(femaleResponses[responseKey]);
        response = response.replace(/<NAME>/g, this.nickname);

        // Simulate typing delay based on message length and some randomness
        const typingSpeed = 40 + Math.random() * 30; // ms per char
        const delay = Math.min(Math.max(response.length * typingSpeed, 1200), 5000);

        // Emit typing status
        socket.emit('peer-typing', { isTyping: true });

        setTimeout(() => {
            if (this.activePartnerId === socket.id) {
                socket.emit('peer-typing', { isTyping: false });
                socket.emit('receive-message', { message: response });
            }
        }, delay);
    }

    getRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    startSkipTimer(socket, onSkip) {
        // Bots skip after 1.5 to 4 minutes to feel more natural
        const time = (90 + Math.random() * 150) * 1000;
        this.skipTimer = setTimeout(() => {
            if (this.activePartnerId === socket.id) {
                const farewell = this.getRandom(femaleResponses.farewell);
                socket.emit('receive-message', { message: farewell });

                setTimeout(() => {
                    if (this.activePartnerId === socket.id) {
                        onSkip(this.id, socket.id);
                    }
                }, 3000);
            }
        }, time);
    }

    clearTimer() {
        if (this.skipTimer) {
            clearTimeout(this.skipTimer);
            this.skipTimer = null;
        }
        this.messageCount = 0;
    }
}

const bots = Array.from({ length: 5 }, (_, i) => new Bot(i));
const availableBots = [...bots];

module.exports = {
    getAvailableBot: () => {
        if (availableBots.length === 0) return null;
        const index = Math.floor(Math.random() * availableBots.length);
        return availableBots.splice(index, 1)[0];
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
            socket.emit('peer-typing', { isTyping: true });
            setTimeout(() => {
                socket.emit('peer-typing', { isTyping: false });
                socket.emit('receive-message', { message: response });
                socket.emit('call-rejected', { from: botId });
            }, 1500);
        }
    },
    bots,
    getBotCount: () => bots.length
};
