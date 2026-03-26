const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const fs = require("fs");

// TOKEN
const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });


// FIREBASE
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://YOUR_PROJECT.firebaseio.com"
});

const db = admin.database();


// توليد كود
function generateCode(length = 10) {

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}


// أمر تجريبي للدفع
bot.onText(/\/buy/, async (msg) => {

  const chatId = msg.chat.id;

  try {

    const code = generateCode();

    await db.ref("codes/" + code).set({
      used: false,
      created: Date.now()
    });

    bot.sendMessage(chatId,
`✅ تم إنشاء كودك بنجاح

الكود الخاص بك:

${code}

احتفظ به جيداً 🔐`);

  } catch (error) {

    console.log("Firebase Error:", error);

    bot.sendMessage(chatId,
`❌ حدث خطأ أثناء إنشاء الكود

${error.message}`);

  }

});