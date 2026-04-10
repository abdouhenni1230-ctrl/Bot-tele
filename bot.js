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

// In-memory session to track logged-in users
const userSessions = {};

// Helper: Firebase REST API
function firebaseREST(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${databaseURL}${path}.json`);
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };
        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : null;
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
                    else reject(new Error(`Firebase Error: ${res.statusCode} - ${body}`));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome to the Game Bot! 👋\n\nPlease choose an option:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔑 Login to Account", callback_data: "login" }],
                [{ text: "⭐ Buy Stars", callback_data: "buy_stars" }],
                [{ text: "👤 My Profile", callback_data: "profile" }]
            ]
        }
    });
});

// Callback query handler
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    bot.answerCallbackQuery(query.id);

    if (data === "login") {
        userSessions[chatId] = { step: "waiting_username" };
        bot.sendMessage(chatId, "Please enter your **Username** in the game:", { parse_mode: "Markdown" });
    } 

    else if (data === "profile") {
        if (!userSessions[chatId] || !userSessions[chatId].username) {
            return bot.sendMessage(chatId, "❌ You are not logged in. Please login first.", {
                reply_markup: { inline_keyboard: [[{ text: "🔑 Login", callback_data: "login" }]] }
            });
        }
        showProfile(chatId);
    }

    else if (data === "buy_stars") {
        if (!userSessions[chatId] || !userSessions[chatId].username) {
            return bot.sendMessage(chatId, "❌ Please login first to buy stars directly to your account.", {
                reply_markup: { inline_keyboard: [[{ text: "🔑 Login", callback_data: "login" }]] }
            });
        }
        bot.sendMessage(chatId, "Choose how many stars you want to buy:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "10 Stars ⭐", callback_data: "pay_10" }],
                    [{ text: "50 Stars ⭐", callback_data: "pay_50" }],
                    [{ text: "100 Stars ⭐", callback_data: "pay_100" }]
                ]
            }
        });
    }

    else if (data.startsWith("pay_")) {
        const amount = parseInt(data.split("_")[1]);
        bot.sendInvoice(
            chatId,
            `${amount} Stars`,
            `Add ${amount} Stars directly to your account`,
            `deposit_${amount}`,
            "", 
            "XTR",
            [{ label: "Stars", amount: amount * 100 }]
        );
    }

    else if (data.startsWith("redeem_")) {
        const giftFileName = data.split("_")[1]; // e.g., "rocket.png"
        
        if (!userSessions[chatId] || !userSessions[chatId].username) {
            return bot.sendMessage(chatId, "❌ You are not logged in. Please login first.");
        }
        
        const username = userSessions[chatId].username;

        try {
            // 1. Get current user data
            const userData = await firebaseREST("GET", `users/${username}`);
            if (!userData) throw new Error("User not found");

            let gifts = userData.gifts;
            let found = false;

            // 2. Handle different formats of gifts (Array or Object)
            if (Array.isArray(gifts)) {
                const index = gifts.indexOf(giftFileName);
                if (index !== -1) {
                    gifts.splice(index, 1);
                    await firebaseREST("PUT", `users/${username}/gifts`, gifts);
                    found = true;
                }
            } else if (typeof gifts === 'object' && gifts !== null) {
                const keys = Object.keys(gifts);
                const keyToRemove = keys.find(key => gifts[key] === giftFileName);
                if (keyToRemove) {
                    await firebaseREST("DELETE", `users/${username}/gifts/${keyToRemove}`);
                    found = true;
                }
            }

            if (found) {
                // 3. Send success message directly
                const giftName = giftFileName.replace(".png", "");
                const giftEmojis = { "rocket": "🚀", "rose": "🌹", "trophy": "🏆" };
                const emoji = giftEmojis[giftName.toLowerCase()] || "🎁";

                const successMsg = `**تم تحويل هديتك ${emoji} ${giftName} بنجاح** ✅\n\n` +
                                   `يرجى التواصل مع @ST_Abdou وإعادة توجيه هذه الرسالة له لتحصل على هديتك.\n\n` +
                                   `إذا لم تتلقى رداً خلال 24 ساعة، يرجى إعادة توجيه الرسالة مرة أخرى.`;

                await bot.sendMessage(chatId, successMsg, { parse_mode: "Markdown" });
            } else {
                bot.sendMessage(chatId, "❌ Gift not found in your inventory.");
            }

        } catch (e) {
            console.error("Redemption Error:", e);
            bot.sendMessage(chatId, "❌ Error processing redemption. Please try again.");
        }
    }
});

// Handle text messages (Login Flow)
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!userSessions[chatId] || !userSessions[chatId].step) return;

    if (userSessions[chatId].step === "waiting_username") {
        userSessions[chatId].tempUsername = text;
        userSessions[chatId].step = "waiting_password";
        bot.sendMessage(chatId, "Now enter your **Password**:", { parse_mode: "Markdown" });
    } 

    else if (userSessions[chatId].step === "waiting_password") {
        const username = userSessions[chatId].tempUsername;
        const password = text;

        try {
            const userData = await firebaseREST("GET", `users/${username}`);
            if (userData && userData.password === password) {
                userSessions[chatId] = { username: username, step: "logged_in" };
                bot.sendMessage(chatId, `✅ Welcome back, **${username}**! You are now logged in.`, { parse_mode: "Markdown" });
                showProfile(chatId);
            } else {
                bot.sendMessage(chatId, "❌ Invalid Username or Password. Try again /start");
                delete userSessions[chatId];
            }
        } catch (e) {
            bot.sendMessage(chatId, "❌ Error connecting to database.");
            delete userSessions[chatId];
        }
    }
});

// Show Profile Function
async function showProfile(chatId) {
    const username = userSessions[chatId].username;
    try {
        const userData = await firebaseREST("GET", `users/${username}`);
        let gifts = userData.gifts || [];
        
        let giftList = [];
        if (Array.isArray(gifts)) {
            giftList = gifts;
        } else if (typeof gifts === 'object' && gifts !== null) {
            giftList = Object.values(gifts);
        }

        const giftEmojis = { "rocket": "🚀", "rose": "🌹", "trophy": "🏆" };
        const keyboard = [];
        let profileMsg = `👤 **PLAYER PROFILE**\n\n` +
                         `Username: \`${username}\`\n` +
                         `💰 Coins: ${userData.coins || 0}\n` +
                         `💎 Gems: ${userData.gems || 0}\n` +
                         `⭐ Stars: ${userData.stars || 0}\n\n` +
                         `🎁 **YOUR GIFTS:**\n`;

        if (giftList.length > 0) {
            giftList.forEach(giftFile => {
                const name = giftFile.replace(".png", "");
                const emoji = giftEmojis[name.toLowerCase()] || "🎁";
                profileMsg += `• ${emoji} ${name}\n`;
                keyboard.push([{ text: `Redeem ${emoji} ${name}`, callback_data: `redeem_${giftFile}` }]);
            });
            profileMsg += `\nClick a button below to convert to a real gift:`;
        } else {
            profileMsg += `_No gifts yet._`;
        }

        bot.sendMessage(chatId, profileMsg, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: keyboard }
        });

    } catch (e) {
        bot.sendMessage(chatId, "❌ Error loading profile.");
    }
}

// Pre-checkout
bot.on("pre_checkout_query", (q) => bot.answerPreCheckoutQuery(q.id, true));

bot.on("successful_payment", async (msg) => {
    const chatId = msg.chat.id;
    const amount = parseInt(msg.successful_payment.invoice_payload.split("_")[1]);
    const username = userSessions[chatId] ? userSessions[chatId].username : null;

    if (username) {
        try {
            const userData = await firebaseREST("GET", `users/${username}`);
            const currentStars = userData.stars || 0;
            await firebaseREST("PATCH", `users/${username}`, { stars: currentStars + amount });
            bot.sendMessage(chatId, `✅ Successfully added ${amount} Stars to your account!`);
        } catch (e) {
            bot.sendMessage(chatId, "❌ Payment received but failed to update database.");
        }
    }
});

console.log("🤖 Account Bot is running...");