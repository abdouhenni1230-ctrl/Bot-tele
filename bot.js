// bot.js
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

// تهيئة Firebase
let db;

try {
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
  });

  db = admin.database();
  console.log("Firebase initialized successfully");

} catch (err) {
  console.log("Firebase init error:", err);
  process.exit(1);
}

// دالة توليد كود
function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// أمر /buy
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const code = generateCode();

    // حفظ الكود في Firebase
    await db.ref("codes/" + code).set({
      used: false,
      created: Date.now()
    });

    bot.sendMessage(
      chatId,
      `🧪 تم إنشاء الكود بنجاح:\n\n\`${code}\``,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.log("Firebase error:", err);
    bot.sendMessage(
      chatId,
      `❌ خطأ أثناء حفظ الكود:\n${err.message}`
    );
  }
});

// مراقبة أخطاء Polling
bot.on("polling_error", (err) => {
  console.log("Polling error:", err);
});

console.log("Bot running...");