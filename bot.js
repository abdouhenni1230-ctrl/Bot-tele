const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const path = require("path");

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

let db = null;

// تشغيل Firebase
try {

const serviceAccount = require(path.join(__dirname,"serviceAccountKey.json"));

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
});

db = admin.database();

} catch (e) {

console.log("Firebase error:",e);

}

// توليد كود
function generateCode(length = 6){

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

let result = "";

for(let i=0;i<length;i++){

result += chars.charAt(Math.floor(Math.random()*chars.length));

}

return result;

}

// start
bot.onText(/\/start/, (msg)=>{

bot.sendMessage(msg.chat.id,
"👋 مرحبا\nاضغط الزر لشراء كود مقابل ⭐1",
{
reply_markup:{
inline_keyboard:[
[{text:"شراء كود ⭐",callback_data:"buy"}]
]
}
}
);

});

// زر الشراء
bot.on("callback_query",(query)=>{

if(query.data === "buy"){

bot.answerCallbackQuery(query.id);

const prices = [{label:"code",amount:1}];

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

// الموافقة على الدفع
bot.on("pre_checkout_query",(query)=>{

bot.answerPreCheckoutQuery(query.id,true);

});

// بعد الدفع
bot.on("successful_payment",async (msg)=>{

try{

const code = generateCode();

if(!db){

bot.sendMessage(msg.chat.id,
"❌ خطأ: Firebase غير متصل"
);

return;

}

// حفظ الكود
await db.ref("codes/"+code).set({

used:false,
created:Date.now()

});

// إرسال الكود
bot.sendMessage(
msg.chat.id,
"✅ تم الدفع بنجاح!\n\n🔑 كودك الخاص:\n\n`"+code+"`",
{parse_mode:"Markdown"}
);

}catch(err){

bot.sendMessage(
msg.chat.id,
"❌ حدث خطأ أثناء إنشاء الكود\n\n"+err.message
);

}

});

// أخطاء polling
bot.on("polling_error",(err)=>{

bot.sendMessage(
process.env.ADMIN_ID,
"❌ polling error\n"+err.message
);

});

console.log("Bot running...");