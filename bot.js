const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

// ---- إعداد Firebase ----
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
});

const db = admin.database();

// ---- إعداد البوت ----
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ---- توليد كود عشوائي ----
function generateCode(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ---- استقبال /start ----
bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, "مرحبا 👋\nاضغط لشراء كود مقابل 5 نجوم ⭐", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "شراء كود ⭐", callback_data: "buy" }]
            ]
        }
    });
});

// ---- زر الشراء ----
bot.on("callback_query", query => {
    if (query.data === "buy") {
        const prices = [{ label: "code", amount: 5 * 100 }]; // المبلغ بوحدات العملة الصغرى (سنت)
        
        bot.sendInvoice(
            query.message.chat.id,
            "شراء كود",
            "احصل على كود مكون من 6 أحرف",
            "payload_unique", // payload فريد
            process.env.PAYMENT_PROVIDER_TOKEN, // توكن مزود الدفع من Telegram
            "XTR", // العملة
            prices
        );
    }
});

// ---- التحقق من الدفع ----
bot.on("pre_checkout_query", query => {
    bot.answerPreCheckoutQuery(query.id, true); // السماح بالدفع
});

// ---- عند الدفع الناجح ----
bot.on("successful_payment", async msg => {
    const chatId = msg.chat.id;

    // توليد الكود
    const code = generateCode();

    // حفظ الكود في Firebase
    await db.ref("codes").push({
        code: code,
        userId: chatId,
        used: true,
        date: Date.now()
    });

    // إرسال الكود للمستخدم
    bot.sendMessage(chatId, `✅ تم الدفع بنجاح!\nكودك هو: ${code}`);
});