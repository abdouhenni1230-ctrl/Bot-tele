const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const path = require("path");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Firebase
const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
});

const db = admin.database();

function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
  "👋 مرحبا\nاضغط الزر لشراء كود مقابل 1 نجمة ⭐", {
    reply_markup:{
      inline_keyboard:[
        [{text:"شراء كود ⭐",callback_data:"buy"}]
      ]
    }
  });
});

// زر الشراء
bot.on("callback_query", (query)=>{

  if(query.data==="buy"){

    bot.answerCallbackQuery(query.id);

    const prices=[{label:"code",amount:1}];

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

// pre checkout
bot.on("pre_checkout_query",(query)=>{
  bot.answerPreCheckoutQuery(query.id,true);
});


// هنا الحدث الصحيح للدفع
bot.on("message",async(msg)=>{

  if(msg.successful_payment){

    try{

      const code = generateCode();

      await db.ref("codes/"+code).set({
        used:false,
        created:Date.now(),
        userId:msg.from.id
      });

      bot.sendMessage(msg.chat.id,
      "✅ تم الدفع بنجاح\n\n🔑 كودك:\n`"+code+"`",
      {parse_mode:"Markdown"});

    }catch(err){

      bot.sendMessage(msg.chat.id,
      "❌ خطأ أثناء حفظ الكود:\n"+err);

    }

  }

});

console.log("Bot running...");