const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const path = require("path");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

try {
  const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
  });
  
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
}

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
  console.log("📢 User started bot:", msg.from.id);
  bot.sendMessage(msg.chat.id, "مرحبا 👋\nاضغط الزر لشراء كود مقابل 1 نجمة ⭐", {
    reply_markup: { inline_keyboard: [[{ text: "شراء كود ⭐", callback_data: "buy" }]] }
  });
});

// زر الشراء
bot.on("callback_query", (query) => {
  console.log("🛍️ User clicked buy button:", query.from.id);
  
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
    ).catch(err => {
      console.error("❌ Error sending invoice:", err);
    });
  }
});

// ✅ معالج pre_checkout_query - الموافقة على الدفع
bot.on("pre_checkout_query", (query) => {
  console.log("💳 Pre-checkout query received:", query.id);
  
  bot.answerPreCheckoutQuery(query.id, true)
    .then(() => {
      console.log("✅ Pre-checkout approved");
    })
    .catch(err => {
      console.error("❌ Error in pre-checkout:", err);
      bot.answerPreCheckoutQuery(query.id, false, "حدث خطأ");
    });
});

// ✅ معالج successful_payment - الحدث الرئيسي بعد الدفع الناجح
bot.on("successful_payment", async (msg) => {
  console.log("🎉 Payment successful for user:", msg.from.id);
  
  try {
    // توليد الكود
    const code = generateCode();
    console.log("🔑 Generated code:", code);

    // حفظ الكود في Firebase
    await db.ref("codes/" + code).set({
      used: false,
      created: Date.now(),
      userId: msg.from.id,
      username: msg.from.username || "N/A",
      paymentId: msg.successful_payment.telegram_payment_charge_id
    });
    
    console.log("💾 Code saved to Firebase");

    // إرسال الكود للمستخدم
    await bot.sendMessage(
      msg.from.id,
      "✅ تم الدفع بنجاح!\n\n🔑 كودك الخاص:\n\n`" + code + "`",
      { parse_mode: "Markdown" }
    );
    
    console.log("📨 Code sent to user");
  } catch (err) {
    console.error("❌ Error handling successful payment:", err);
    bot.sendMessage(
      msg.from.id,
      "❌ حدث خطأ في معالجة الدفع. يرجى التواصل مع الدعم.",
      { parse_mode: "Markdown" }
    );
  }
});

// معالج الأخطاء
bot.on("polling_error", err => {
  console.error("❌ Polling error:", err);
});

console.log("🤖 Bot is running...");