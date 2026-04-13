const TelegramBot = require("node-telegram-bot-api");
const https = require("https");

// Environment Variables
const token = process.env.BOT_TOKEN;
const databaseURL = "https://timetowork-2d513-default-rtdb.firebaseio.com/";

if (!token) {
    console.error("❌ BOT_TOKEN is missing!");
    process.exit(1);
}

// Initialize bot with polling and error handling
const bot = new TelegramBot(token, { polling: true });

// Global Error Handlers to prevent bot from crashing
process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

bot.on('polling_error', (error) => {
    console.error('📡 Polling Error:', error.code); 
});

bot.on('error', (error) => {
    console.error('🤖 Bot Error:', error);
});

// In-memory session to track logged-in users
const userSessions = {};

// Helper: Firebase REST API
function firebaseREST(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${databaseURL}${path}.json`);
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        };
        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : null;
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
                    else reject(new Error(`Firebase Error: ${res.statusCode}`));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

// Main Menu Markup
const mainMenuMarkup = {
    inline_keyboard: [
        [{ text: "🔑 Login to Account", callback_data: "login" }],
        [{ text: "⭐ Buy Stars", callback_data: "buy_stars" }],
        [{ text: "👤 My Profile", callback_data: "profile" }]
    ]
};

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome to the Game Bot! 👋\n\nPlease choose an option:", {
        reply_markup: mainMenuMarkup
    }).catch(err => console.error("Start error:", err.message));
});

// Callback query handler
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try {
        bot.answerCallbackQuery(query.id).catch(() => {});

        if (data === "main_menu") {
            bot.editMessageText("Welcome to the Game Bot! 👋\n\nPlease choose an option:", {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: mainMenuMarkup
            }).catch(() => {});
        }

        else if (data === "login") {
            userSessions[chatId] = { step: "waiting_username" };
            bot.editMessageText("Please enter your **Username** in the game:", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "main_menu" }]] }
            }).catch(() => {});
        } 

        else if (data === "profile") {
            if (!userSessions[chatId] || !userSessions[chatId].username) {
                return bot.editMessageText("❌ You are not logged in. Please login first.", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: { inline_keyboard: [[{ text: "🔑 Login", callback_data: "login" }, { text: "🔙 Back", callback_data: "main_menu" }]] }
                }).catch(() => {});
            }
            showProfile(chatId, messageId);
        }

        else if (data === "buy_stars") {
            if (!userSessions[chatId] || !userSessions[chatId].username) {
                return bot.editMessageText("❌ Please login first to buy stars directly to your account.", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: { inline_keyboard: [[{ text: "🔑 Login", callback_data: "login" }, { text: "🔙 Back", callback_data: "main_menu" }]] }
                }).catch(() => {});
            }
            bot.editMessageText("Choose how many stars you want to buy:", {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "10 Stars ⭐", callback_data: "pay_10" }],
                        [{ text: "50 Stars ⭐", callback_data: "pay_50" }],
                        [{ text: "100 Stars ⭐", callback_data: "pay_100" }],
                        [{ text: "🔙 Back", callback_data: "main_menu" }]
                    ]
                }
            }).catch(() => {});
        }

        else if (data.startsWith("pay_")) {
            const amount = parseInt(data.split("_")[1]);
            const username = userSessions[chatId].username;
            
            bot.sendInvoice(
                chatId,
                `${amount} Stars`,
                `Add ${amount} Stars directly to your account`,
                `deposit_${amount}_${username}`,
                "", 
                "XTR",
                [{ label: "Stars", amount: amount * 100 }]
            ).catch(err => bot.sendMessage(chatId, `❌ Invoice Error: ${err.message}`));
        }

        else if (data.startsWith("redeem_")) {
            const giftFileName = data.split("_")[1];
            const username = userSessions[chatId].username;

            try {
                const userData = await firebaseREST("GET", `users/${username}`);
                let gifts = userData.gifts;
                let isDeleted = false;

                if (Array.isArray(gifts)) {
                    const index = gifts.indexOf(giftFileName);
                    if (index !== -1) {
                        gifts.splice(index, 1);
                        await firebaseREST("PUT", `users/${username}/gifts`, gifts);
                        isDeleted = true;
                    }
                } else if (typeof gifts === 'object' && gifts !== null) {
                    const keys = Object.keys(gifts);
                    const keyToRemove = keys.find(key => gifts[key] === giftFileName);
                    if (keyToRemove) {
                        await firebaseREST("DELETE", `users/${username}/gifts/${keyToRemove}`);
                        isDeleted = true;
                    }
                }

                if (isDeleted) {
                    const giftName = giftFileName.replace(".png", "");
                    const giftEmojis = { "rocket": "🚀", "rose": "🌹", "trophy": "🏆" };
                    const emoji = giftEmojis[giftName.toLowerCase()] || "🎁";
                    const cleanGiftName = giftName.replace(/[_*`[\]()]/g, "");

                    // Generate current date and time
                    const now = new Date();
                    const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    const successMsg = `**تم تحويل هديتك ${emoji} ${cleanGiftName} بنجاح** ✅\n\n` +
                                       `📅 **التاريخ:** ${dateStr}\n` +
                                       `⏰ **الوقت:** ${timeStr}\n\n` +
                                       `يرجى التواصل مع @ST_Abdou وإعادة توجيه هذه الرسالة له لتحصل على هديتك.\n\n` +
                                       `إذا لم تتلقى رداً خلال 24 ساعة، يرجى إعادة توجيه الرسالة مرة أخرى.`;

                    bot.sendMessage(chatId, successMsg, { parse_mode: "Markdown" }).catch(() => {
                        bot.sendMessage(chatId, successMsg.replace(/\*\*/g, ""));
                    });
                    showProfile(chatId, messageId);
                } else {
                    bot.sendMessage(chatId, "❌ Gift not found in your inventory.");
                }
            } catch (e) {
                bot.sendMessage(chatId, `❌ Redeem Error: ${e.message}`);
            }
        }
    } catch (globalErr) {
        console.error("Global Callback Error:", globalErr);
    }
});

// Handle text messages (Login Flow)
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!userSessions[chatId] || !userSessions[chatId].step || !text || text.startsWith("/")) return;

    try {
        if (userSessions[chatId].step === "waiting_username") {
            userSessions[chatId].tempUsername = text;
            userSessions[chatId].step = "waiting_password";
            bot.sendMessage(chatId, "Now enter your **Password**:", { parse_mode: "Markdown" }).catch(() => {});
        } 

        else if (userSessions[chatId].step === "waiting_password") {
            const username = userSessions[chatId].tempUsername;
            const password = text;

            try {
                const userData = await firebaseREST("GET", `users/${username}`);
                if (userData && userData.password === password) {
                    userSessions[chatId] = { username: username, step: "logged_in" };
                    bot.sendMessage(chatId, `✅ Welcome back, **${username}**! You are now logged in.`, { parse_mode: "Markdown" }).catch(() => {});
                    
                    const profileData = await getProfileText(username, userData);
                    bot.sendMessage(chatId, profileData.text, {
                        parse_mode: "Markdown",
                        reply_markup: profileData.markup
                    }).catch(() => {});
                } else {
                    bot.sendMessage(chatId, "❌ Invalid Username or Password. Try again /start").catch(() => {});
                    delete userSessions[chatId];
                }
            } catch (e) {
                bot.sendMessage(chatId, "❌ Database Error during login.").catch(() => {});
                delete userSessions[chatId];
            }
        }
    } catch (msgErr) {
        console.error("Message handling error:", msgErr);
    }
});

// Helper to generate profile text and markup
async function getProfileText(username, userData) {
    let gifts = userData.gifts || [];
    let giftList = Array.isArray(gifts) ? gifts : (typeof gifts === 'object' && gifts !== null ? Object.values(gifts) : []);

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
    
    keyboard.push([{ text: "🔙 Back to Menu", callback_data: "main_menu" }]);

    return { text: profileMsg, markup: { inline_keyboard: keyboard } };
}

// Show Profile Function (using editMessageText)
async function showProfile(chatId, messageId) {
    const username = userSessions[chatId].username;
    try {
        const userData = await firebaseREST("GET", `users/${username}`);
        const profileData = await getProfileText(username, userData);
        
        bot.editMessageText(profileData.text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: profileData.markup
        }).catch(() => {});
    } catch (e) {
        bot.sendMessage(chatId, "❌ Error loading profile.").catch(() => {});
    }
}

// Pre-checkout
bot.on("pre_checkout_query", (q) => bot.answerPreCheckoutQuery(q.id, true).catch(() => {}));

// Handle successful payment with crash-proof logic
bot.on("successful_payment", async (msg) => {
    const chatId = msg.chat.id;
    const payload = msg.successful_payment.invoice_payload;
    
    console.log("💰 Payment received, processing...");

    (async () => {
        try {
            const parts = payload.split("_");
            const amount = parseInt(parts[1]);
            const username = parts[2];

            if (!username) throw new Error("No username in payload");

            const userData = await firebaseREST("GET", `users/${username}`);
            if (!userData) throw new Error(`User ${username} not found`);

            const currentStars = userData.stars || 0;
            const newStars = currentStars + amount;

            await firebaseREST("PATCH", `users/${username}`, { stars: newStars });

            bot.sendMessage(chatId, `✅ Successfully added ${amount} Stars to your account, **${username}**!`, { parse_mode: "Markdown" }).catch(() => {});
            console.log(`✅ Stars added to ${username}`);
            
        } catch (e) {
            console.error("❌ Payment processing error:", e.message);
            bot.sendMessage(chatId, `❌ Payment Update Error: ${e.message}`).catch(() => {});
        }
    })();
});

console.log("🤖 Account Bot is running with Time & Date added...");