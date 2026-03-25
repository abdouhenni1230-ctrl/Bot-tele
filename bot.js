const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const path = require("path");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
});

const db = admin.database();

function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "مرحبا 👋\nاضغط الزر لشراء كود مقابل 1 نجمة ⭐", {
    reply_markup: { inline_keyboard: [[{ text: "شراء كود ⭐", callback_data: "buy" }]] }
  });
});

// زر الشراء
bot.on("callback_query", (query) => {
  if (query.data === "buy") {
    bot.answerCallbackQuery(query.id);

    const prices = [{ label: "code", amount: 1 }];

    bot.sendInvoice(
      query.message.chat.id,
      "شراء كود",
      "احصل على كود خاص",
      "code_payload",
      "",
      "XTR",
      prices
    );
  }
});

// التعامل مع الدفع فوراً عبر pre_checkout_query
bot.on("pre_checkout_query", async (query) => {
  try {
    bot.answerPreCheckoutQuery(query.id, true);

    // توليد الكود فوراً بعد التأكد من الدفع
    const code = generateCode();

    // حفظ الكود في Firebase
    await db.ref("codes/" + code).set({
      used: false,
      created: Date.now(),
      user: query.from.username || query.from.id
    });

    // إرسال الكود للمستخدم
    bot.sendMessage(
      query.from.id,
      "✅ تم الدفع بنجاح\n\n🔑 كودك:\n\n`" + code + "`",
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("خطأ أثناء توليد الكود:", err);
  }
});