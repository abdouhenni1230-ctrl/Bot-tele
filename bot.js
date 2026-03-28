const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com/"
});

const db = admin.database();

// توليد كود
function generateCode() {

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

let code = "";

for (let i = 0; i < 8; i++) {
code += chars.charAt(Math.floor(Math.random() * chars.length));
}

return code;

}

bot.onText(/\/start/, async (msg) => {

const chatId = msg.chat.id;

try {

const code = generateCode();

await db.ref("codes/" + code).set({
user: chatId,
code: code,
time: Date.now()
});

bot.sendMessage(chatId,
"✅ تم إنشاء كود\n\n" +
"🔑 الكود:\n" + code
);

} catch (error) {

bot.sendMessage(chatId,
"❌ خطأ أثناء حفظ الكود\n\n" +
error.message
);

}

});

// منع توقف البوت
setInterval(() => {}, 1000);