const express = require("express");
const app = express();

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
    Partials
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

const TOKEN = process.env.TOKEN;

// ================= الإعدادات الأساسية =================
const LOG_CHANNEL = "1481705807560310874";          // روم العائلة
const PUBLIC_LOG_CHANNEL = "1481757344269336807";   // روم العلني (للشارع)

const ADMIN_IDS = ["1292916898484457538"];

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// --- الذاكرة ---
const claimedUsers = new Set(); 
let publicUsers = new Set();
let publicNames = new Set();
let publicEmails = new Set();
let publicPhones = new Set();
let publicIbans = new Set();
let clickedUsers = new Set(); 
let blacklistedUsers = new Set(); 
let duplicateStrikes = new Map(); 
let pendingSubmissions = new Map(); 

const cooldowns = new Map();
let totalPublicSpent = 0; 

// ================= الدوال المساعدة =================
function getEidiya(){
    const random = Math.floor(Math.random()*100)+1;
    if(random <= 70) return 5;
    if(random <= 85) return 10;
    if(random <= 95) return 20;
    return 50;
}
function getColorByAmount(amount){
    if(amount === 5) return "#6e6e6e";
    if(amount === 10) return "#3498db";
    if(amount === 20) return "#9b59b6";
    if(amount === 50) return "#d4af37";
}
function getPublicEidiya(){
    const random = Math.floor(Math.random()*100)+1;
    if(random <= 55) return 0;
    if(random <= 95) return 5;
    return 10;
}
function getPublicColorByAmount(amount){
    if(amount === 0) return "#1c1c1c"; 
    if(amount === 5) return "#7f8c8d"; 
    if(amount === 10) return "#2980b9"; 
}

// ================= استرجاع البيانات =================
client.once("ready", async () => {
    console.log("الدون جاهز... جاري فتح دفاتر المافيا.");
    try {
        const channel = await client.channels.fetch(PUBLIC_LOG_CHANNEL);
        if(channel) {
            let lastId;
            while(true) {
                const options = { limit: 100 };
                if(lastId) options.before = lastId;
                const msgs = await channel.messages.fetch(options);
                if(msgs.size === 0) break;
                msgs.forEach(msg => {
                    if(msg.embeds.length > 0) {
                        const embed = msg.embeds[0];
                        if(embed.title && embed.title.includes("القائمة السوداء")) {
                            const idMatch = embed.description.match(/\*\*ID:\*\*\s+(\d+)/);
                            if(idMatch) blacklistedUsers.add(idMatch[1]);
                        }
                        if(embed.fields && embed.fields.length >= 6) {
                            const fields = embed.fields;
                            const idMatch = fields[0].value.match(/\((\d+)\)/);
                            if(idMatch) { publicUsers.add(idMatch[1]); clickedUsers.add(idMatch[1]); }
                            publicNames.add(fields[1].value);
                            publicEmails.add(fields[2].value);
                            publicPhones.add(fields[3].value);
                            publicIbans.add(fields[4].value);
                            const amtMatch = fields[5].value.match(/\*\*(\d+)\s+ريال\*\*/);
                            if(amtMatch) totalPublicSpent += parseInt(amtMatch[1]);
                        }
                    }
                });
                lastId = msgs.last().id;
            }
        }
    } catch (err) { console.error("خطأ في استرجاع اللوق:", err); }
});

client.on("messageCreate", async message => {
    if(message.author.bot) return;

    if (ADMIN_IDS.includes(message.author.id)) {
        const args = message.content.split(" ");
        const command = args[0].toLowerCase();
        if (command === "!reset_public") {
            publicUsers.clear(); publicNames.clear(); publicEmails.clear();
            publicPhones.clear(); publicIbans.clear(); clickedUsers.clear();
            duplicateStrikes.clear(); totalPublicSpent = 0;
            return message.reply("تم تصفير ميزانية الشارع.");
        }
        if (command === "!ban" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            blacklistedUsers.add(targetId);
            return message.reply(`تم إدراج ${targetId} في القائمة السوداء.`);
        }
        if (command === "!unban" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            blacklistedUsers.delete(targetId);
            return message.reply(`تم العفو عن ${targetId}.`);
        }
    }

    if(message.content === "!eid"){
        const userId = message.author.id;
        if(cooldowns.has(userId)){
            const expiry = cooldowns.get(userId) + 30000;
            if(Date.now() < expiry) return message.reply(`انتظر قليلاً...`);
        }
        cooldowns.set(userId, Date.now());

        if(message.guild){
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("eidiya_family_button").setLabel("أبي عيدية").setStyle(ButtonStyle.Success)
            );
            const embed = new EmbedBuilder()
                .setColor("#8B0000").setTitle("خزنة العائلة 💰").setImage(VAULT_IMAGE).setTimestamp()
                .setDescription(`بأمر من **الدون** تم فتح خزنة العائلة اليوم.\n\nقرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.\n\nاضغط على زر **أبي عيدية** وضع الآيبان الخاص بك ليحدد الدون نصيبك.\n\nكل عضو يحصل على عيدية واحدة فقط.`)
                .setFooter({text:"العائلة فوق كل شيء"});
            return message.channel.send({ embeds:[embed], components:[row] });
        } else {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("public_button").setLabel("عيدية الدون").setStyle(ButtonStyle.Primary) // تم التغيير للأزرق
            );
            const embed = new EmbedBuilder()
                .setColor("#2c3e50").setTitle("خزنة الدون 💰").setImage(VAULT_IMAGE).setTimestamp()
                .setDescription(`العيدية على **الدون**!\n\nقرر الدون فتح جزء من خزنته لكم بمناسبة عيد الفطر المبارك.\nالفرصة تأتي مرة واحدة، ومن يحاول العبث أو النصب على الدون، سيجد نفسه في قائمة لا يتمنى دخولها.\n\nاضغط على زر **عيدية الدون** وسجل بياناتك.`)
                .setFooter({text:"الدون يراقبك"});
            return message.channel.send({ embeds:[embed], components:[row] });
        }
    }
});

client.on("interactionCreate", async interaction => {
    try {
        if(interaction.isButton()){
            if(interaction.customId === "eidiya_family_button"){
                if(claimedUsers.has(interaction.user.id)) return interaction.reply({ content: "اسمك مسجل بالفعل في دفتر الدون.", ephemeral: true });
                const modal = new ModalBuilder().setCustomId("family_modal").setTitle("أدخل الآيبان البنكي");
                const ibanInput = new TextInputBuilder().setCustomId("input_family_iban").setLabel("الآيبان البنكي (SA + 22 رقم)").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(ibanInput));
                await interaction.showModal(modal);
            }

            if(interaction.customId === "public_button"){
                if(blacklistedUsers.has(interaction.user.id)) return interaction.reply({ content: "أنت في القائمة السوداء ☠️", ephemeral: true });
                if(clickedUsers.has(interaction.user.id)) return interaction.reply({ content: "لقد قدمت بياناتك مسبقاً.", ephemeral: true });
                if(totalPublicSpent >= 50) return interaction.reply({ content: "الخزنة أُغلقت 🚪", ephemeral: true });

                const modal = new ModalBuilder().setCustomId("public_modal").setTitle("بياناتك لتسليم عيديتك");
                const nameInput = new TextInputBuilder().setCustomId("input_name").setLabel("الاسم الكامل (الرباعي)").setStyle(TextInputStyle.Short).setRequired(true);
                const emailInput = new TextInputBuilder().setCustomId("input_email").setLabel("الإيميل").setStyle(TextInputStyle.Short).setRequired(true);
                const phoneInput = new TextInputBuilder().setCustomId("input_phone").setLabel("الهاتف").setStyle(TextInputStyle.Short).setRequired(true);
                const ibanInput = new TextInputBuilder().setCustomId("input_iban").setLabel("الآيبان").setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(emailInput),
                    new ActionRowBuilder().addComponents(phoneInput), new ActionRowBuilder().addComponents(ibanInput)
                );
                await interaction.showModal(modal);
            }

            // --- منطق زر تعديل البيانات ---
            if(interaction.customId === "edit_data"){
                const data = pendingSubmissions.get(interaction.user.id);
                if(!data) return interaction.reply({ content: "انتهت الجلسة، ابدأ من جديد.", ephemeral: true });

                const modal = new ModalBuilder().setCustomId("public_modal").setTitle("تعديل البيانات");
                const nameInput = new TextInputBuilder().setCustomId("input_name").setLabel("الاسم الكامل (الرباعي)").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.name);
                const emailInput = new TextInputBuilder().setCustomId("input_email").setLabel("الإيميل").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.email);
                const phoneInput = new TextInputBuilder().setCustomId("input_phone").setLabel("الهاتف").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.phone);
                const ibanInput = new TextInputBuilder().setCustomId("input_iban").setLabel("الآيبان").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.iban);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(emailInput),
                    new ActionRowBuilder().addComponents(phoneInput), new ActionRowBuilder().addComponents(ibanInput)
                );
                await interaction.showModal(modal);
            }

            if(interaction.customId === "confirm_data"){
                const userId = interaction.user.id;
                const data = pendingSubmissions.get(userId);
                if(!data) return interaction.reply({ content: "انتهت الجلسة.", ephemeral: true });
                
                clickedUsers.add(userId); // تثبيت التسجيل نهائياً عند التأكيد فقط
                publicUsers.add(userId); publicNames.add(data.name); publicEmails.add(data.email);
                publicPhones.add(data.phone); publicIbans.add(data.iban);
                pendingSubmissions.delete(userId);

                await interaction.update({ embeds: [new EmbedBuilder().setColor("#555555").setTitle("مراجعة البيانات").setDescription("يتم الآن تحديد نصيبك من الخزنة...")], components: [] });

                setTimeout(async () => {
                    let amount = getPublicEidiya();
                    if(totalPublicSpent + amount > 50) amount = 50 - totalPublicSpent;
                    totalPublicSpent += amount;
                    const resultEmbed = new EmbedBuilder().setColor(getPublicColorByAmount(amount)).setTitle("قرار الدون").setDescription(amount === 0 ? "قرر الدون أنك لا تستحق شيئاً." : `وافق الدون على مكافأتك بـ **${amount} ريال**.`);
                    await interaction.editReply({ embeds: [resultEmbed] });
                    
                    const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                    if(channel) channel.send({ embeds: [new EmbedBuilder().setTitle("سجل العيدية").addFields({name:"صاحب الطلب", value:`${interaction.user}`}, {name:"المبلغ", value:`${amount} ريال`}, {name:"الآيبان", value:data.iban})] });
                }, 8000);
            }

            if(interaction.customId === "cancel_data"){
                pendingSubmissions.delete(interaction.user.id);
                await interaction.update({ content: "تم إلغاء الطلب بطلب منك.", embeds: [], components: [] });
            }
        }

        if(interaction.isModalSubmit()){
            if(interaction.customId === "family_modal"){
                const iban = interaction.fields.getTextInputValue("input_family_iban").replace(/\s+/g, '');
                if(!/^SA\d{22}$/i.test(iban)) return interaction.reply({ content: "آيبان خاطئ.", ephemeral: true });
                claimedUsers.add(interaction.user.id);
                await interaction.reply({ content: "جاري المعالجة...", ephemeral: true });
                setTimeout(() => interaction.editReply({ content: `تم استلام عيدية بـ ${getEidiya()} ريال.` }), 5000);
            }

            if(interaction.customId === "public_modal"){
                const userId = interaction.user.id;
                const name = interaction.fields.getTextInputValue("input_name").trim();
                const email = interaction.fields.getTextInputValue("input_email").trim();
                const phone = interaction.fields.getTextInputValue("input_phone").trim();
                const iban = interaction.fields.getTextInputValue("input_iban").trim();

                // التحقق من صحة البيانات
                if(!email.includes("@") || !/^\d{10}$/.test(phone) || !/^SA\d{22}$/i.test(iban)) {
                    return interaction.reply({ content: "تأكد من صحة البيانات (الايميل، الهاتف 10 أرقام، الآيبان SA+22 رقم).", ephemeral: true });
                }

                // كشف الغش (فقط إذا لم يكن تعديلاً لنفس البيانات)
                const isEdit = pendingSubmissions.has(userId);
                if(!isEdit && (publicNames.has(name) || publicEmails.has(email) || publicPhones.has(phone) || publicIbans.has(iban))){
                    return interaction.reply({ content: "هذه البيانات مسجلة مسبقاً! الدون لا يحب الخداع.", ephemeral: true });
                }

                pendingSubmissions.set(userId, { name, email, phone, iban });

                const confirmEmbed = new EmbedBuilder()
                    .setColor("#f39c12").setTitle("تأكيد بياناتك 📄").setTimestamp()
                    .setDescription(`بمناسبة عيد الفطر، راجع بياناتك يا صديقي:\n\n**الآيبان:** \`${iban}\`\n\nالدون لا يصحح أخطاء الآخرين، تأكد قبل الختم.`);

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("confirm_data").setLabel("نعم، الختم نهائي").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("edit_data").setLabel("تعديل البيانات").setStyle(ButtonStyle.Secondary), // زر التعديل المطلوب
                    new ButtonBuilder().setCustomId("cancel_data").setLabel("إلغاء الطلب").setStyle(ButtonStyle.Danger)
                );

                if(interaction.replied || interaction.deferred) {
                    await interaction.editReply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
                } else {
                    await interaction.reply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
                }
            }
        }
    } catch (e) { console.error(e); }
});

client.login(TOKEN);
