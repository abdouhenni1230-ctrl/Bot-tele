const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token,{polling:true});

bot.onText(/\/start/,msg=>{
    
    bot.sendMessage(msg.chat.id,"مرحبا 👋\nاضغط لشراء كود مقابل 5 نجوم ⭐",{
        reply_markup:{
            inline_keyboard:[
                [{text:"شراء كود ⭐",callback_data:"buy"}]
            ]
        }
    });

});

bot.on("callback_query",query=>{
    
    if(query.data==="buy"){
        
        const prices=[{label:"code",amount:1}];

        bot.sendInvoice(
            query.message.chat.id,
            "Buy Code",
            "Get access code",
            "payload",
            "stars",
            "XTR",
            prices
            {
             start_parameter: 'payment'
            }
        );
    }

});