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

// Voucher types and prices (Stars)
const VOUCHERS = {
    silver: { name: "Silver Voucher", price: 1, color: "🥈" },
    gold: { name: "Gold Voucher", price: 2, color: "🥇" },
    diamond: { name: "Diamond Voucher", price: 5, color: "💎" }
};

// Generate random code (8 characters)
function generateCode(length = 8) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Save data to Firebase via REST API
function saveToFirebaseREST(path, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${databaseURL}${path}.json`);
        const options = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };
        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(body));
                else reject(new Error(`Firebase REST Error: ${res.statusCode}`));
            });
        });
        req.on('error', (e) => reject(e));
        req.on('timeout', () => { req.destroy(); reject(new Error("Timeout")); });
        req.write(JSON.stringify(data));
        req.end();
    });
}

// /start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Hello 👋\nPlease choose the type of voucher you want to buy:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🥈 Silver Voucher (1 ⭐)", callback_data: "buy_silver" }],
                [{ text: "🥇 Gold Voucher (2 ⭐)", callback_data: "buy_gold" }],
                [{ text: "💎 Diamond Voucher (5 ⭐)", callback_data: "buy_diamond" }]
            ]
        }
    });
});

// Callback query handler
bot.on("callback_query", (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (data.startsWith("buy_")) {
        const type = data.split("_")[1];
        const voucher = VOUCHERS[type];

        bot.answerCallbackQuery(query.id);

        bot.sendInvoice(
            chatId,
            voucher.name,
            `Get a unique ${voucher.name}`,
            `payload_${type}`, // Pass the type in payload
            "",
            "XTR",
            [{ label: voucher.name, amount: voucher.price }]
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
        const payload = msg.successful_payment.invoice_payload;
        const type = payload.split("_")[1]; // Get type from payload
        const voucher = VOUCHERS[type];
        const code = generateCode();

        try {
            // Store the code with its type in Firebase
            await saveToFirebaseREST(`codes/${code}`, {
                code: code,
                type: type, // silver, gold, or diamond
                used: false,
                buyer_id: chatId,
                buyer_username: msg.from.username || "Unknown",
                created: Date.now()
            });

            // Success message
            await bot.sendMessage(
                chatId,
                `✅ Payment Successful!\n\nYour ${voucher.color} *${voucher.name}* code is:\n\n\`${code}\`\n\nDo not share this code with anyone.`,
                { parse_mode: "Markdown" }
            );

        } catch (e) {
            console.error("❌ Firebase Error:", e.message);
            // Still send the code but log error
            await bot.sendMessage(
                chatId,
                `✅ Payment Successful!\n\nYour ${voucher.color} *${voucher.name}* code is:\n\n\`${code}\`\n\nDo not share this code with anyone.`,
                { parse_mode: "Markdown" }
            );
        }
    }
});

console.log("🤖 Multi-Voucher Bot is running...");