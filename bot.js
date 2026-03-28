const TelegramBot = require("node-telegram-bot-api");
const https = require("https");
const fs = require("fs");

// الحصول على التوكن من متغيرات البيئة
const token = process.env.BOT_TOKEN;
const databaseURL = "https://timetowork-2d513-default-rtdb.firebaseio.com/";

if (!token) {
    console.error("❌ BOT_TOKEN is missing!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// دالة لتوليد الكود
function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// دالة لحفظ البيانات عبر REST API (تجنب تعليق SDK)
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

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        await bot.sendMessage(chatId, "🚀 تم استقبال الأمر /start");

        const code = generateCode();
        await bot.sendMessage(chatId, "🔢 تم توليد الكود:\n`" + code + "`", { parse_mode: "Markdown" });

        await bot.sendMessage(chatId, "⏳ جارِ محاولة التخزين (عبر REST API)...");

        // محاولة التخزين
        await saveToFirebaseREST(`codes/${code}`, {
            code: code,
            used: false,
            created: Date.now()
        });

        await bot.sendMessage(chatId, "✅ تم تخزين الكود بنجاح!");

    } catch (e) {
        console.error("❌ Error:", e.message);
        let errorMsg = e.message;
        if (errorMsg.includes("401") || errorMsg.includes("403")) {
            errorMsg = "خطأ في الصلاحيات (Permission Denied). تأكد من إعدادات Rules في Firebase لتسمح بالكتابة العامة مؤقتاً للتجربة.";
        }
        await bot.sendMessage(chatId, "❌ فشل التخزين:\n" + errorMsg);
    }
});

console.log("🤖 Bot is running with REST API mode...");