const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

let db = null;
let firebaseError = null;

// محاولة تشغيل Firebase
try {

const serviceAccountPath = path.join(__dirname,"serviceAccountKey.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath,"utf8"));

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
});

db = admin.database();

}catch(err){

firebaseError = err.message;

}


// توليد كود
function generateCode(length=6){

const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let result="";

for(let i=0;i<length;i++){
result+=chars.charAt(Math.floor(Math.random()*chars.length));
}

return result;

}



// عند ارسال /start
bot.onText(/\/start/, async (msg)=>{

const chatId = msg.chat.id;


// المرحلة 1
await bot.sendMessage(chatId,"1️⃣ تم استقبال الأمر /start");


// المرحلة 2: توليد الكود
let code;

try{

code = generateCode();

await bot.sendMessage(chatId,"2️⃣ تم إنشاء الكود:\n"+code);

}catch(err){

await bot.sendMessage(chatId,"❌ خطأ أثناء إنشاء الكود:\n"+err.message);
return;

}


// المرحلة 3: التحقق من Firebase
if(firebaseError){

await bot.sendMessage(
chatId,
"❌ Firebase لم يعمل:\n"+firebaseError
);

return;

}else{

await bot.sendMessage(chatId,"3️⃣ Firebase يعمل");

}


// المرحلة 4: حفظ الكود
try{

await db.ref("codes/"+code).set({
used:false,
created:Date.now()
});

await bot.sendMessage(
chatId,
"4️⃣ تم حفظ الكود في قاعدة البيانات بنجاح ✅"
);

}catch(err){

await bot.sendMessage(
chatId,
"❌ حدث خطأ أثناء حفظ الكود:\n"+err.message
);

}

});