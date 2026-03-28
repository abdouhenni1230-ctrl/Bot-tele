const TelegramBot = require("node-telegram-bot-api");
const https = require("https");

// Environment Variables
const token = process.env.BOT_TOKEN;
const databaseURL = "https://timetowork-2d513-default-rtdb.firebaseio.com/";

if (!token) {
    console.error("❌ BOT_TOKEN is missing!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Generate random code (8 characters)
function generateCode(length = 8) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Save data to Firebase via REST API (Prevents SDK hanging)
function saveToFirebaseREST(path, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${databaseURL}${path}.json`);
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000 // 10 seconds timeout
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

// /start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Hello 👋\nClick to buy a code for 1 Star ⭐", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Buy Code ⭐", callback_data: "buy" }]
            ]
        }
    });
});

// Buy button handler
bot.on("callback_query", (query) => {
    if (query.data === "buy") {
        bot.answerCallbackQuery(query.id);

        const prices = [{ label: "Special Code", amount: 1 }]; // Price: 1 Star

        bot.sendInvoice(
            query.message.chat.id,
            "Purchase Code",
            "Get a unique code",
            "code_payload",
            "", // provider_token remains empty for Stars (XTR)
            "XTR",
            prices
        );
    }
});

// Pre-checkout query
bot.on("pre_checkout_query", (query) => {
    bot.answerPreCheckoutQuery(query.id, true);
});

// Successful payment handler
bot.on("message", async (msg) => {
    if (msg.successful_payment) {
        const chatId = msg.chat.id;
        const code = generateCode();

        try {
            // Store the code in Firebase (Quietly)
            await saveToFirebaseREST(`codes/${code}`, {
                code: code,
                used: false,
                buyer_id: chatId,
                buyer_username: msg.from.username || "Unknown",
                created: Date.now()
            });

            // Send the code to the user in English
            await bot.sendMessage(
                chatId,
                "✅ Payment Successful!\n\nYour unique code is:\n\n`" + code + "`\n\nDo not share this code with anyone.",
                { parse_mode: "Markdown" }
            );

        } catch (e) {
            console.error("❌ Firebase Error:", e.message);
            // In case of error, still provide the code but log the issue
            await bot.sendMessage(
                chatId,
                "✅ Payment Successful!\n\nYour unique code is:\n\n`" + code + "`\n\nDo not share this code with anyone.",
                { parse_mode: "Markdown" }
            );
        }
    }
});

console.log("🤖 English Bot with Stars Payment & Firebase is running...");