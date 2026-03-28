const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// توكن البوت من GitHub Secrets
const token = process.env.BOT_TOKEN;

// رابط قاعدة البيانات (مباشر في الكود)
const databaseURL = "https://timetowork-2d513-default-rtdb.firebaseio.com/";

const bot = new TelegramBot(token, { polling: true });

// تشغيل Firebase
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: databaseURL
});

// توليد كود عشوائي
function generateCode() {

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let code = "";

for (let i = 0; i < 8; i++) {
code += chars.charAt(Math.floor(Math.random() * chars.length));
}

return code;

}

// امر start
bot.onText(/\/start/, async (msg) => {

const chatId = msg.chat.id;

try {

const code = generateCode();

await admin.database().ref("codes/" + code).set({
code: code,
user: chatId,
time: Date.now()
});

bot.sendMessage(chatId,
"✅ تم إنشاء كود جديد\n\n" +
"🔑 الكود:\n" +
code
);

} catch (err) {

bot.sendMessage(chatId,
"❌ حدث خطأ أثناء إنشاء الكود\n\n" +
err.message
);

}

});