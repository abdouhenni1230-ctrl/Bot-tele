const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token,{polling:true});

// Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: "https://timetowork-2d513-default-rtdb.firebaseio.com"
});

const db = admin.database();

// توليد كود عشوائي
function generateCode(length=6){
const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let result="";
for(let i=0;i<length;i++){
result+=chars.charAt(Math.floor(Math.random()*chars.length));
}
return result;
}

// start
bot.onText(//start/,msg=>{

bot.sendMessage(msg.chat.id,"مرحبا 👋\nاضغط لشراء كود مقابل 1 نجمة ⭐",{  
    reply_markup:{  
        inline_keyboard:[  
            [{text:"شراء كود ⭐",callback_data:"buy"}]  
        ]  
    }  
});

});

// زر الشراء
bot.on("callback_query",query=>{

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

// تأكيد الدفع
bot.on("pre_checkout_query",(query)=>{
bot.answerPreCheckoutQuery(query.id,true);
});

// بعد الدفع
bot.on("message",async(msg)=>{

if(msg.successful_payment){

const code = generateCode();  

 await db.ref("codes/"+code).set(false);  

 bot.sendMessage(  
     msg.chat.id,  
     "✅ تم الدفع بنجاح\n\n🔑 كودك:\n\n`"+code+"`",  
     {parse_mode:"Markdown"}  
 );

}

});