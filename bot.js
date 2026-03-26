const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const path = require("path");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ---- إعداد Firebase ----
try {
  const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
  });
} catch (error) {
  console.error("Firebase initialization error:", error);
}

const db = admin.database();

// توليد الكود
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
      "", // لا نحتاج provider_token
      "XTR",
      prices
    ).catch(err => {
      bot.sendMessage(query.from.id, `❌ خطأ عند إرسال الفاتورة:\n${err.message || err}`);
    });
  }
});

// الموافقة على pre_checkout_query
bot.on("pre_checkout_query", (query) => {
  bot.answerPreCheckoutQuery(query.id, true).catch(err => {
    bot.sendMessage(query.from.id, `❌ خطأ في الموافقة على الدفع:\n${err.message || err}`);
  });
});

// معالجة successful_payment
bot.on("successful_payment", async (msg) => {
  let code = generateCode();
  let saved = false;

  try {
    // محاولة حفظ الكود في Firebase
    try {
      await db.ref("codes/" + code).set({
        used: false,
        created: Date.now(),
        userId: msg.from.id,
        username: msg.from.username || "N/A",
        paymentId: msg.successful_payment.telegram_payment_charge_id
      });
      saved = true;
    } catch (fbErr) {
      bot.sendMessage(msg.chat.id, `⚠️ تم الدفع لكن حدث خطأ عند حفظ الكود في Firebase:\n${fbErr.message || fbErr}`);
    }

    // إرسال الكود للمستخدم دائمًا
    await bot.sendMessage(
      msg.chat.id,
      `✅ تم الدفع بنجاح!\n\n🔑 كودك الخاص:\n\`${code}\`\n${saved ? "تم تخزينه في قاعدة البيانات." : "لم يتم تخزينه في Firebase."}`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    bot.sendMessage(
      msg.chat.id,
      `❌ حدث خطأ غير متوقع أثناء معالجة الدفع:\n${err.message || err}`
    );
  }
});

// التقاط أي خطأ أثناء polling
bot.on("polling_error", (err) => {
  console.error("Polling error:", err);
});