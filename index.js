const express = require("express");
const app = express();

// سيرفر بسيط لمنع نوم الاستضافة
app.get("/", (req, res) => {
    res.send("Bot is alive");
});

app.listen(3000, () => {
    console.log("Keep alive server started");
});

const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionType
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL'] // عشان DM يشتغل
});

// التوكن
const TOKEN = process.env.TOKEN;

// رومات اللوج
const LOG_CHANNEL = "1481705807560310874"; // النسخة العائلية
const PUBLIC_LOG_CHANNEL = "1481757344269336807"; // النسخة العلنية

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// النسخة العائلية
const claimedUsers = new Set();

// النسخة العلنية
const publicClaimedUsers = new Map();
let publicTotal = 0;
const PUBLIC_LIMIT = 50; // الحد الأقصى للعيديات في النسخة العلنية

function getEidiya(){
    const random = Math.floor(Math.random()*100)+1;
    if(random <= 55) return 0;
    if(random <= 95) return 5;
    return 10;
}

function getColorByAmount(amount){
    if(amount === 0) return "#7f8c8d";
    if(amount === 5) return "#3498db";
    if(amount === 10) return "#9b59b6";
    if(amount === 20) return "#f39c12";
    if(amount === 50) return "#d4af37";
}

// =================== النسخة العائلية ===================
client.once("ready", () => {
    console.log("الدون جاهز وتم فتح دفتر العائلة.");
});

client.on("interactionCreate", async interaction => {
    // النسخة العائلية
    if(interaction.isButton() && interaction.customId === "eidiya_button"){
        const userId = interaction.user.id;

        if(claimedUsers.has(userId)){
            const rejectEmbed = new EmbedBuilder()
                .setColor("#ff0000")
                .setTitle("🚫 تم تسجيل اسمك مسبقًا")
                .setDescription(`
اسمك مسجل بالفعل في **دفتر الدون**.

لقد استلمت عيديتك مسبقًا، ولا يمكن طلب عيدية أخرى.

كل ما يحدث هنا يتم تسجيله بدقة.`)
                .setFooter({text:"دفتر الدون لا ينسى"})
                .setTimestamp();

            return interaction.reply({
                embeds:[rejectEmbed],
                ephemeral:true
            });
        }

        claimedUsers.add(userId);

        const waitingEmbed = new EmbedBuilder()
            .setColor("#2f3136")
            .setTitle("خزنة العائلة")
            .setDescription(`
قام الدون بفتح **خزنة العائلة** الآن.

ينظر في الصناديق ويقرر مقدار العيدية لكل فرد من أفراد العائلة.

انتظر قليلًا بينما يحدد الدون نصيبك.`)
            .setFooter({text:"كل شيء يسجل في دفتر الدون"})
            .setTimestamp();

        await interaction.reply({
            embeds:[waitingEmbed],
            ephemeral:true
        });

        setTimeout(async () => {
            const amount = getEidiya();

            const resultEmbed = new EmbedBuilder()
                .setColor(getColorByAmount(amount))
                .setTitle("عيدية العائلة")
                .setDescription(`
بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.

المبلغ الذي حصلت عليه:

**${amount} ريال**

تم تسجيل هذه العملية رسميًا في **دفتر الدون**.`)
                .setFooter({text:"العائلة لا تنسى"})
                .setTimestamp();

            await interaction.editReply({
                embeds:[resultEmbed]
            });

            const channel = client.channels.cache.get(LOG_CHANNEL);
            if(channel){
                const logEmbed = new EmbedBuilder()
                    .setColor("#111111")
                    .setTitle("دفتر الدون")
                    .setDescription(`
${interaction.user} استلم عيديته.

المبلغ:
**${amount} ريال**

تم تسجيل العملية في دفتر العائلة.`)
                    .setTimestamp();

                channel.send({embeds:[logEmbed]});
            }
        },10000);
    }
});

// امر !eid النسخة العائلية
client.on("messageCreate", async message => {
    if(message.content === "!eid"){
        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId("eidiya_button")
            .setLabel("أبي عيدية")
            .setStyle(ButtonStyle.Success)
        );

        const embed = new EmbedBuilder()
            .setColor("#8B0000")
            .setTitle("خزنة العائلة 💰")
            .setDescription(`
بأمر من **الدون** تم فتح خزنة العائلة اليوم.

قرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.

اضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك بنفسه.

كل عضو يحصل على عيدية واحدة فقط، ويتم تسجيل كل شيء في **دفتر الدون**.`)
            .setImage(VAULT_IMAGE)
            .setFooter({text:"العائلة فوق كل شيء"})
            .setTimestamp();

        message.channel.send({
            embeds:[embed],
            components:[row]
        });
    }
});

// =================== النسخة العلنية DM ===================
client.on("messageCreate", async message => {
    if(message.channel.type === 1){ // DM
        if(publicTotal >= PUBLIC_LIMIT){
            return message.channel.send("🚫 تم نفاذ جميع العيديات العلنية، الخزنة مغلقة.");
        }

        if(publicClaimedUsers.has(message.author.id)){
            return message.channel.send("🚫 لقد استلمت عيديتك العلنية مسبقًا، لا يمكنك طلب أخرى.");
        }

        // ابدأ جمع البيانات
        const modal = new ModalBuilder()
            .setCustomId("public_eid_modal")
            .setTitle("خزنة العيديات العلنية");

        const nameInput = new TextInputBuilder()
            .setCustomId("public_name")
            .setLabel("الاسم الرباعي أو الثلاثي")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const phoneInput = new TextInputBuilder()
            .setCustomId("public_phone")
            .setLabel("رقم جوالك الخاص")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const emailInput = new TextInputBuilder()
            .setCustomId("public_email")
            .setLabel("ايميلك الشخصي")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const ibanInput = new TextInputBuilder()
            .setCustomId("public_iban")
            .setLabel("رقم الايبان الخاص بك")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(nameInput);
        const row2 = new ActionRowBuilder().addComponents(phoneInput);
        const row3 = new ActionRowBuilder().addComponents(emailInput);
        const row4 = new ActionRowBuilder().addComponents(ibanInput);

        modal.addComponents(row1, row2, row3, row4);
        await message.channel.send({ content: "📝 يرجى ملء البيانات الخاصة بك في النافذة المنبثقة." });
        await message.author.send({ modals: [modal] });
    }
});

client.on("interactionCreate", async interaction => {
    if(interaction.type === InteractionType.ModalSubmit && interaction.customId === "public_eid_modal"){
        const userId = interaction.user.id;

        if(publicClaimedUsers.has(userId)){
            return interaction.reply({ content:"🚫 لقد استلمت عيديتك العلنية مسبقًا.", ephemeral:true });
        }

        const name = interaction.fields.getTextInputValue("public_name");
        const phone = interaction.fields.getTextInputValue("public_phone");
        const email = interaction.fields.getTextInputValue("public_email");
        const iban = interaction.fields.getTextInputValue("public_iban");

        // تحقق من تكرار البيانات
        for(const [, data] of publicClaimedUsers){
            if(data.phone === phone || data.email === email || data.iban === iban){
                return interaction.reply({ content:"🚫 هذه البيانات مستخدمة مسبقًا. لا يمكن تكرارها.", ephemeral:true });
            }
        }

        // اعطاء العيدية
        const amount = getEidiya();
        publicClaimedUsers.set(userId, {name, phone, email, iban, amount});
        publicTotal++;

        const embed = new EmbedBuilder()
            .setColor(getColorByAmount(amount))
            .setTitle("💰 عيدية العلن")
            .setDescription(`
تم التحقق من بياناتك بدقة.

الاسم: **${name}**
رقم الجوال: **${phone}**
الايميل: **${email}**
رقم الايبان: **${iban}**

الدون قرر مقدار عيديتك: **${amount} ريال**
`)
            .setFooter({ text: `العيديات العلنية: ${publicTotal}/${PUBLIC_LIMIT}`})
            .setTimestamp();

        await interaction.reply({ embeds:[embed] });

        // ارسال سجل العيديات العلنية
        const logChannel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
        if(logChannel){
            const logEmbed = new EmbedBuilder()
                .setColor("#111111")
                .setTitle("دفتر العيديات العلنية")
                .setDescription(`
${interaction.user} استلم عيديته العلنية.

المبلغ: **${amount} ريال**
تم تسجيل العملية في دفتر العيديات العلنية.`)
                .setTimestamp();

            logChannel.send({ embeds:[logEmbed] });
        }
    }
});

client.login(TOKEN);
