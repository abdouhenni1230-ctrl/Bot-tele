const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

// تحميل firebase
let serviceAccount;
try{
serviceAccount = require("./serviceAccountKey.json");
}catch(e){
bot.sendMessage(0,"خطأ في قراءة serviceAccountKey.json");
}

// تشغيل firebase
try{

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com/"
});

}catch(e){
}

const db = admin.database();

function generateCode(){

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

let code="";

for(let i=0;i<8;i++){

code += chars[Math.floor(Math.random()*chars.length)];

}

return code;

}

bot.onText(/\/start/, async (msg)=>{

const chatId = msg.chat.id;

try{

await bot.sendMessage(chatId,"تم استقبال الامر /start");

}catch(e){}

let code;

try{

code = generateCode();

await bot.sendMessage(chatId,"تم توليد الكود:\n"+code);

}catch(e){

bot.sendMessage(chatId,"مشكلة في توليد الكود");

return;

}

try{

await bot.sendMessage(chatId,"جار الاتصال بقاعدة البيانات...");

}catch(e){}

try{

await db.ref("codes/"+code).set({
code:code,
used:false,
created:Date.now()
});

await bot.sendMessage(chatId,"✅ تم تخزين الكود في Firebase");

}catch(e){

await bot.sendMessage(chatId,"❌ فشل تخزين الكود\n"+e.message);

}

});

// منع توقف السكربت
setInterval(()=>{},1000);