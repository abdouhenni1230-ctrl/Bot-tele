const TelegramBot = require("node-telegram-bot-api");
const https = require("https");

// الحصول على التوكن من متغيرات البيئة
const token = process.env.BOT_TOKEN;
const databaseURL = "https://timetowork-2d513-default-rtdb.firebaseio.com/";

if (!token) {
    console.error("❌ BOT_TOKEN is missing!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// دالة لتوليد الكود العشوائي (8 خانات كما في طلبك الأصلي)
function generateCode(length = 8) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// دالة لحفظ البيانات في Firebase عبر REST API (تجنب تعليق SDK)
function saveToFirebaseREST(path, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${databaseURL}${path}.json`);
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000 // 10 ثواني مهلة
        };

        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body));
                } else {
                    reject(new Error(`Firebase REST Error: ${res.statusCode} - ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("Firebase Request Timeout (REST)"));
        });
        
        req.write(JSON.stringify(data));
        req.end();
    });
}

// الأمر /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "مرحبا 👋\nاضغط لشراء كود مقابل 1 نجمة ⭐", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "شراء كود ⭐", callback_data: "buy" }]
            ]
        }
    });
});

// التعامل مع زر الشراء
bot.on("callback_query", (query) => {
    if (query.data === "buy") {
        bot.answerCallbackQuery(query.id);

        const prices = [{ label: "كود خاص", amount: 1 }]; // السعر 1 نجمة

        bot.sendInvoice(
            query.message.chat.id,
            "شراء كود",
            "احصل على كود فريد سيتم تخزينه في قاعدة البيانات",
            "code_payload",
            "", // provider_token يبقى فارغاً عند استخدام النجوم (XTR)
            "XTR",
            prices
        );
    }
});

// تأكيد عملية الدفع (Pre-checkout)
bot.on("pre_checkout_query", (query) => {
    bot.answerPreCheckoutQuery(query.id, true);
});

// التعامل مع الرسائل بعد نجاح الدفع
bot.on("message", async (msg) => {
    if (msg.successful_payment) {
        const chatId = msg.chat.id;
        const code = generateCode();

        try {
            await bot.sendMessage(chatId, "✅ تم الدفع بنجاح! جارٍ إنشاء الكود وتخزينه...");

            // تخزين الكود في Firebase
            await saveToFirebaseREST(`codes/${code}`, {
                code: code,
                used: false,
                buyer_id: chatId,
                buyer_username: msg.from.username || "Unknown",
                created: Date.now()
            });

            // إرسال الكود للمستخدم بعد نجاح التخزين
            await bot.sendMessage(
                chatId,
                "🔑 كودك الخاص هو:\n\n`" + code + "`\n\n✅ تم حفظ الكود في قاعدة البيانات بنجاح.",
                { parse_mode: "Markdown" }
            );

        } catch (e) {
            console.error("❌ Firebase Error:", e.message);
            await bot.sendMessage(chatId, "⚠️ تم الدفع بنجاح ولكن حدث خطأ أثناء التخزين:\n" + e.message + "\n\nيرجى التواصل مع الإدارة مع الكود: `" + code + "`", { parse_mode: "Markdown" });
        }
    }
});

console.log("🤖 Bot with Stars Payment & Firebase REST is running...");