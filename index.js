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
    Partials,
    PermissionsBitField
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
const ALLOWED_GUILD = "1481377720330879078";      // سيرفر الدون المسموح
const LOG_CHANNEL = "1481705807560310874";          // روم العائلة
const PUBLIC_LOG_CHANNEL = "1481757344269336807";   // روم عيدية الدون

// أيدي الدون
const ADMIN_IDS = ["1292916898484457538"];

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// --- ذاكرة العائلة ---
let claimedUsers = new Set(); 
let familyBlacklist = new Set(); // المحظورين من عيدية العائلة
let familyRewards = [
    { amount: 5, chance: 70 },
    { amount: 10, chance: 15 },
    { amount: 20, chance: 10 },
    { amount: 50, chance: 5 }
];

// --- ذاكرة عيدية الدون ---
let publicUsers = new Set();
let publicNames = new Set();
let publicEmails = new Set();
let publicPhones = new Set();
let publicIbans = new Set();
let clickedUsers = new Set(); 
let publicBlacklist = new Set(); // المحظورين من عيدية الدون
let duplicateStrikes = new Map(); 
let pendingSubmissions = new Map(); 

let publicBudgetLimit = 50; 
let totalPublicSpent = 0; 
let publicRewards = [
    { amount: 0, chance: 55 },
    { amount: 5, chance: 40 },
    { amount: 10, chance: 5 }
];

const cooldowns = new Map();

// ================= الدوال المساعدة =================
function getRandomReward(rewardsArray) {
    const random = Math.floor(Math.random() * 100) + 1;
    let sum = 0;
    for (let r of rewardsArray) {
        sum += r.chance;
        if (random <= sum) return r.amount;
    }
    return rewardsArray.length > 0 ? rewardsArray[0].amount : 0;
}

function getColorByAmount(amount){
    if(amount === 0) return "#1c1c1c";
    if(amount === 5) return "#6e6e6e";
    if(amount === 10) return "#3498db";
    if(amount === 20) return "#9b59b6";
    if(amount >= 50) return "#d4af37";
    return "#7f8c8d";
}

// دالة لتحليل أوامر الفلوس (مثال: 5:70 10:30)
function parseRewardsArgs(args) {
    let newRewards = [];
    let totalChance = 0;
    for (let i = 1; i < args.length; i++) {
        let parts = args[i].split(":");
        if (parts.length === 2) {
            let amount = parseInt(parts[0]);
            let chance = parseInt(parts[1]);
            if (!isNaN(amount) && !isNaN(chance)) {
                newRewards.push({ amount, chance });
                totalChance += chance;
            }
        }
    }
    if (totalChance !== 100 && newRewards.length > 0) return null; // التأكد أن النسبة 100%
    return newRewards.length > 0 ? newRewards : null;
}

// ================= تشغيل البوت =================
client.once("ready", async () => {
    console.log("الدون جاهز... جاري فتح دفاتر المافيا.");
});

client.on("messageCreate", async message => {
    if(message.author.bot) return;

    // حصر البوت للعمل في السيرفر المسموح أو في الخاص فقط
    if (message.guild && message.guild.id !== ALLOWED_GUILD) return;

    const args = message.content.split(/\s+/);
    const command = args[0].toLowerCase();
    const isDon = ADMIN_IDS.includes(message.author.id);

    // ================= أوامر الإدارة (للدون فقط) =================
    if (isDon) {
        // حظر وفك الحظر (العلني / عيدية الدون)
        if (command === "!eid_public_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            publicBlacklist.add(targetId);
            return message.reply(`تم إدراج ${targetId} في القائمة السوداء الخاصة بعيدية الدون.`);
        }
        if (command === "!eid_public_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            publicBlacklist.delete(targetId);
            duplicateStrikes.delete(targetId);
            return message.reply(`تم العفو عن ${targetId} من القائمة السوداء لعيدية الدون.`);
        }

        // حظر وفك الحظر (العائلة)
        if (command === "!eid_family_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            familyBlacklist.add(targetId);
            return message.reply(`تم حظر ${targetId} من عيدية العائلة.`);
        }
        if (command === "!eid_family_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            familyBlacklist.delete(targetId);
            return message.reply(`تم فك حظر ${targetId} من عيدية العائلة.`);
        }

        // تصفير الميزانية والسجلات
        if (command === "!eid_public_reset") {
            publicUsers.clear(); publicNames.clear(); publicEmails.clear();
            publicPhones.clear(); publicIbans.clear(); clickedUsers.clear();
            duplicateStrikes.clear(); pendingSubmissions.clear();
            totalPublicSpent = 0;
            return message.reply("تم تصفير الميزانية ومسح سجلات عيدية الدون لبدء عيد جديد.");
        }
        if (command === "!eid_family_reset") {
            claimedUsers.clear();
            return message.reply("تم مسح سجلات المستلمين لبدء عيدية عائلة جديدة.");
        }

        // تحديد الميزانية
        if (command === "!eid_public_amount" && args[1]) {
            const newLimit = parseInt(args[1]);
            if (!isNaN(newLimit)) {
                publicBudgetLimit = newLimit;
                return message.reply(`تم تعيين الحد الأقصى للميزانية بنجاح.`);
            }
        }

        // تحديد المبالغ ونسبها لعيدية الدون
        // مثال: !eid_public_money 0:50 5:30 10:20
        if (command === "!eid_public_money") {
            const newRewards = parseRewardsArgs(args);
            if (newRewards) {
                publicRewards = newRewards;
                return message.reply("تم تعيين المبالغ ونسب الظهور لعيدية الدون بنجاح.");
            } else {
                return message.reply("صيغة خاطئة أو مجموع النسب لا يساوي 100. استخدم الصيغة: `المبلغ:النسبة` مثال: `!eid_public_money 0:50 5:30 10:20`");
            }
        }

        // تحديد المبالغ ونسبها لعيدية العائلة
        if (command === "!eid_family_money") {
            const newRewards = parseRewardsArgs(args);
            if (newRewards) {
                familyRewards = newRewards;
                return message.reply("تم تعيين المبالغ ونسب الظهور لعيدية العائلة بنجاح.");
            } else {
                return message.reply("صيغة خاطئة أو مجموع النسب لا يساوي 100. استخدم الصيغة: `المبلغ:النسبة` مثال: `!eid_family_money 5:50 10:30 50:20`");
            }
        }

        // أمر المساعدة
        if (command === "!help") {
            const helpEmbed = new EmbedBuilder()
                .setColor("#d4af37")
                .setTitle("قائمة أوامر بوت الدون")
                .addFields(
                    { name: "!eid", value: "لإرسال رسالة العيدية. (في السيرفر للإدارة فقط، في الخاص للجميع)" },
                    { name: "!eid_public_block / unblock [ID]", value: "حظر/فك حظر شخص من عيدية الدون (الخاص)" },
                    { name: "!eid_family_block / unblock [ID]", value: "حظر/فك حظر شخص من عيدية العائلة (السيرفر)" },
                    { name: "!eid_public_reset", value: "تصفير الميزانية وسجلات عيدية الدون" },
                    { name: "!eid_family_reset", value: "تصفير سجلات المستلمين لعيدية العائلة" },
                    { name: "!eid_public_amount [رقم]", value: "تحديد ميزانية عيدية الدون" },
                    { name: "!eid_public_money [المبلغ:النسبة]", value: "تحديد المبالغ ونسب ظهورها لعيدية الدون. مثال: `!eid_public_money 0:50 10:50`" },
                    { name: "!eid_family_money [المبلغ:النسبة]", value: "تحديد المبالغ ونسب ظهورها لعيدية العائلة." }
                )
                .setFooter({ text: "للاستخدام من قبل الدون فقط" });
            return message.reply({ embeds: [helpEmbed] });
        }
    }

    // ================= أمر العيدية الأساسي =================
    if(command === "!eid"){
        // في السيرفر: يحق فقط للإدارة إرسال الأمر
        if (message.guild) {
            const isOwner = message.guild.ownerId === message.author.id;
            const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
            if (!isDon && !isOwner && !isAdmin) {
                return message.reply("هذا الأمر مخصص للإدارة ومالك السيرفر والدون فقط.");
            }
        }

        const userId = message.author.id;

        // حماية السبام (30 ثانية)
        if(cooldowns.has(userId)){
            const expiry = cooldowns.get(userId) + 30000;
            if(Date.now() < expiry){
                const left = ((expiry - Date.now()) / 1000).toFixed(1);
                return message.reply(`تأنَّ قليلاً. انتظر ${left} ثانية.`).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
            }
        }
        cooldowns.set(userId, Date.now());

        try {
            // --- 1. سيرفر العائلة ---
            if(message.guild){
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                    .setCustomId("eidiya_family_button")
                    .setLabel("أبي عيدية")
                    .setStyle(ButtonStyle.Success)
                );

                const embed = new EmbedBuilder()
                    .setColor("#8B0000") 
                    .setTitle("خزنة العائلة 💰")
                    .setDescription(`بأمر من **الدون** تم فتح خزنة العائلة اليوم.\n\nقرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.\n\nاضغط على زر **أبي عيدية** وضع الآيبان الخاص بك ليحدد الدون نصيبك.\n\nكل عضو يحصل على عيدية واحدة فقط.`)
                    .setImage(VAULT_IMAGE)
                    .setFooter({text:"العائلة فوق كل شيء"})
                    .setTimestamp();

                return message.channel.send({ embeds:[embed], components:[row] });
            } 
            
            // --- 2. الخاص (عيدية الدون) ---
            else {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                    .setCustomId("public_button")
                    .setLabel("أبي عيدية")
                    .setStyle(ButtonStyle.Primary) // اللون الأزرق كما طلبت
                );

                const embed = new EmbedBuilder()
                    .setColor("#2c3e50") 
                    .setTitle("خزنة عيدية الدون 💰")
                    .setDescription(`العيدية على **الدون**!\n\nقرر الدون فتح جزء من خزنته لكم.\nالفرصة تأتي مرة واحدة، ومن يحاول العبث أو النصب على الدون، سيجد نفسه في قائمة لا يتمنى دخولها.\n\nاضغط على زر **أبي عيدية** وسجل بياناتك.`)
                    .setImage(VAULT_IMAGE)
                    .setFooter({text:"الدون يراقبك"})
                    .setTimestamp();

                return message.channel.send({ embeds:[embed], components:[row] });
            }
        } catch(err) {
            console.log("خطأ في إرسال رسالة البداية:", err);
        }
    }
});

client.on("interactionCreate", async interaction => {
    // التأكد أن التفاعل من السيرفر المسموح أو من الخاص
    if (interaction.guild && interaction.guild.id !== ALLOWED_GUILD) return;

    try {
        // ================= الأزرار =================
        if(interaction.isButton()){
            const userId = interaction.user.id;

            // --- زر عيدية العائلة ---
            if(interaction.customId === "eidiya_family_button"){
                if(familyBlacklist.has(userId)){
                    return interaction.reply({ content: "أنت محظور من عيدية العائلة بأمر الدون.", ephemeral: true });
                }
                if(claimedUsers.has(userId)){
                    const rejectEmbed = new EmbedBuilder()
                        .setColor("#ff0000")
                        .setTitle("🚫 تم تسجيل اسمك مسبقًا")
                        .setDescription(`اسمك مسجل بالفعل في **دفتر الدون**.\nلقد استلمت عيديتك مسبقًا.`)
                        .setFooter({text:"دفتر الدون لا ينسى"});
                    return interaction.reply({ embeds:[rejectEmbed], ephemeral:true });
                }

                const modal = new ModalBuilder()
                    .setCustomId("family_modal")
                    .setTitle("أدخل الآيبان البنكي");

                const ibanInput = new TextInputBuilder()
                    .setCustomId("input_family_iban")
                    .setLabel("الآيبان البنكي (SA + 22 رقم)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(ibanInput));
                await interaction.showModal(modal);
            }

            // --- زر عيدية الدون (الخاص) ---
            if(interaction.customId === "public_button"){
                if(publicBlacklist.has(userId)){
                    const blacklistEmbed = new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("أنت في القائمة السوداء ☠️")
                        .setDescription(`لقد تجاوزت حدودك وحاولت خداع الدون.\nأبواب العائلة مغلقة في وجهك للأبد.`)
                        .setFooter({text:"المافيا لا تغفر"});
                    return interaction.reply({ embeds:[blacklistEmbed], ephemeral:true });
                }

                if(clickedUsers.has(userId) && !pendingSubmissions.has(userId)){
                    // إذا أرسل ولم تكن بياناته معلقة في انتظار التأكيد
                    const alreadyClickedEmbed = new EmbedBuilder()
                        .setColor("#e67e22")
                        .setTitle("تم استلام بياناتك مسبقاً 📜")
                        .setDescription(`لقد قمت بتقديم بياناتك بالفعل.\nالدون لا يقرأ البيانات مرتين.`);
                    return interaction.reply({ embeds:[alreadyClickedEmbed], ephemeral:true });
                }

                if(totalPublicSpent >= publicBudgetLimit){
                    const closedVaultEmbed = new EmbedBuilder()
                        .setColor("#34495e")
                        .setTitle("الخزنة أُغلقت 🚪")
                        .setDescription(`**الدون قفل الخزنة.**\nنفدت العطايا المخصصة لهذا العيد.`);
                    return interaction.reply({ embeds:[closedVaultEmbed], ephemeral:true });
                }

                // فتح المودال لإدخال البيانات
                const modal = new ModalBuilder()
                    .setCustomId("public_modal")
                    .setTitle("بياناتك لتسليم عيدية الدون");

                const nameInput = new TextInputBuilder().setCustomId("input_name").setLabel("الاسم الكامل").setStyle(TextInputStyle.Short).setRequired(true);
                const emailInput = new TextInputBuilder().setCustomId("input_email").setLabel("الإيميل").setStyle(TextInputStyle.Short).setRequired(true);
                const phoneInput = new TextInputBuilder().setCustomId("input_phone").setLabel("الهاتف (10 أرقام)").setStyle(TextInputStyle.Short).setRequired(true);
                const ibanInput = new TextInputBuilder().setCustomId("input_iban").setLabel("الآيبان (SA + 22 رقم)").setStyle(TextInputStyle.Short).setRequired(true);

                // إذا كان المستخدم يود التعديل، نملأ البيانات القديمة
                if (pendingSubmissions.has(userId)) {
                    const oldData = pendingSubmissions.get(userId);
                    nameInput.setValue(oldData.name);
                    emailInput.setValue(oldData.email);
                    phoneInput.setValue(oldData.phone);
                    ibanInput.setValue(oldData.iban);
                }

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(emailInput),
                    new ActionRowBuilder().addComponents(phoneInput),
                    new ActionRowBuilder().addComponents(ibanInput)
                );

                await interaction.showModal(modal);
            }

            // --- أزرار التأكيد وتعديل البيانات (عيدية الدون) ---
            if(interaction.customId === "confirm_data"){
                const data = pendingSubmissions.get(userId);
                if(!data) return interaction.reply({ content: "انتهت صلاحية جلستك.", ephemeral: true });

                if(totalPublicSpent >= publicBudgetLimit){
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor("#34495e").setTitle("الخزنة أُغلقت 🚪").setDescription("أغلق الدون الخزنة قبل وصول بياناتك.")],
                        components: [] 
                    });
                }

                publicUsers.add(userId);
                publicNames.add(data.name);
                publicEmails.add(data.email);
                publicPhones.add(data.phone);
                publicIbans.add(data.iban);
                pendingSubmissions.delete(userId); 
                clickedUsers.add(userId);

                const waitingEmbed = new EmbedBuilder()
                    .setColor("#555555")
                    .setTitle("مراجعة البيانات")
                    .setDescription(`تم ارسال بياناتك **للدون**.\nيتم الآن تحديد نصيبك من الخزنة.. الصبر مطلوب الآن.`)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

                await interaction.update({ embeds:[waitingEmbed], components:[] });

                setTimeout(async () => {
                    let amount = getRandomReward(publicRewards);
                    if(totalPublicSpent + amount > publicBudgetLimit) amount = publicBudgetLimit - totalPublicSpent; 
                    totalPublicSpent += amount;

                    let desc = amount === 0 
                        ? `نفث الدون دخان سيجاره وقرر أنك لا تستحق شيئاً.\n\nالمبلغ: **0 ريال**\nاعتبر بقاءك آمناً هو أعظم عيدية.`
                        : `أومأ الدون برأسه ووافق على مكافأتك.\n\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\nسيتم تحويلها لآيبانك.`;

                    const resultEmbed = new EmbedBuilder()
                        .setColor(getColorByAmount(amount))
                        .setTitle("قرار الدون")
                        .setDescription(desc)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({text:"انتهت المعاملة."});

                    try { await interaction.editReply({ embeds:[resultEmbed] }); } catch(e){}

                    const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                    if(channel){
                        const logEmbed = new EmbedBuilder()
                            .setColor("#050505")
                            .setTitle("سجلات عيدية الدون الموثقة")
                            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                            .addFields(
                                { name: "صاحب الطلب", value: `${interaction.user} (${interaction.user.id})`, inline: false },
                                { name: "الاسم", value: data.name, inline: true },
                                { name: "الإيميل", value: data.email, inline: true },
                                { name: "الرقم", value: data.phone, inline: true },
                                { name: "الآيبان", value: data.iban, inline: false },
                                { name: "المبلغ المستلم", value: `**${amount} ريال**`, inline: false }
                            )
                            .setTimestamp();
                        channel.send({embeds:[logEmbed]});
                    }
                }, 8000);
            }

            if(interaction.customId === "edit_data"){
                // سيتم إعادة إظهار المودال عبر زر `public_button`، لذا نوجه المستخدم للضغط على الزر الأزرق مرة أخرى
                // أو نقوم بعرض المودال مباشرة هنا عبر تكرار الكود
                const data = pendingSubmissions.get(userId) || { name:"", email:"", phone:"", iban:"" };
                const modal = new ModalBuilder()
                    .setCustomId("public_modal")
                    .setTitle("تعديل بياناتك");

                const nameInput = new TextInputBuilder().setCustomId("input_name").setLabel("الاسم الكامل").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.name);
                const emailInput = new TextInputBuilder().setCustomId("input_email").setLabel("الإيميل").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.email);
                const phoneInput = new TextInputBuilder().setCustomId("input_phone").setLabel("الهاتف").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.phone);
                const ibanInput = new TextInputBuilder().setCustomId("input_iban").setLabel("الآيبان (SA + 22 رقم)").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.iban);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(emailInput),
                    new ActionRowBuilder().addComponents(phoneInput),
                    new ActionRowBuilder().addComponents(ibanInput)
                );
                await interaction.showModal(modal);
            }

            if(interaction.customId === "cancel_data"){
                pendingSubmissions.delete(userId);
                clickedUsers.delete(userId); 

                const cancelEmbed = new EmbedBuilder()
                    .setColor("#7f8c8d")
                    .setTitle("تم سحب الطلب")
                    .setDescription("تراجعت واحتفظت ببياناتك. خيار حكيم.");
                await interaction.update({ embeds:[cancelEmbed], components:[] });
            }
        }

        // ================= النماذج (Modals) =================
        if(interaction.isModalSubmit()){
            const userId = interaction.user.id;

            // --- مودل العائلة ---
            if(interaction.customId === "family_modal"){
                let iban = interaction.fields.getTextInputValue("input_family_iban").replace(/\s+/g, '');

                if(!/^SA\d{22}$/i.test(iban)){
                    return interaction.reply({ content: "🚫 صيغة الآيبان خاطئة! يجب أن يبدأ بـ SA ويليه 22 رقماً.", ephemeral: true });
                }

                claimedUsers.add(userId);

                const waitingEmbed = new EmbedBuilder()
                    .setColor("#2f3136")
                    .setTitle("خزنة العائلة")
                    .setDescription(`قام الدون بفتح **خزنة العائلة** الآن ويقوم بتسجيل الآيبان الخاص بك.\nانتظر قليلًا بينما يحدد نصيبك.`)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

                await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

                setTimeout(async () => {
                    const amount = getRandomReward(familyRewards);
                    const resultEmbed = new EmbedBuilder()
                        .setColor(getColorByAmount(amount))
                        .setTitle("عيدية العائلة")
                        .setDescription(`بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.\n\nالمبلغ:\n**${amount} ريال**\n\nالآيبان المسجل: \`${iban}\``)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

                    try { await interaction.editReply({ embeds:[resultEmbed] }); } catch(e){}

                    const channel = client.channels.cache.get(LOG_CHANNEL);
                    if(channel){
                        const logEmbed = new EmbedBuilder()
                            .setColor("#111111")
                            .setTitle("دفتر الدون - العائلة")
                            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                            .setDescription(`${interaction.user} استلم عيديته.\n\nالمبلغ: **${amount} ريال**\nالآيبان: \`${iban}\``)
                            .setTimestamp();
                        channel.send({embeds:[logEmbed]});
                    }
                }, 8000);
            }

            // --- مودل عيدية الدون ---
            if(interaction.customId === "public_modal"){
                const name = interaction.fields.getTextInputValue("input_name").trim();
                const email = interaction.fields.getTextInputValue("input_email").trim();
                const phone = interaction.fields.getTextInputValue("input_phone").replace(/\s+/g, '');
                const iban = interaction.fields.getTextInputValue("input_iban").replace(/\s+/g, '');

                if(!email.includes("@")){
                    return interaction.reply({ content: "🚫 الإيميل غير صحيح. يجب أن يحتوي على علامة @.", ephemeral: true });
                }
                if(!/^\d{10}$/.test(phone)){
                    return interaction.reply({ content: "🚫 رقم الهاتف غير صحيح. يجب أن يتكون من 10 أرقام فقط.", ephemeral: true });
                }
                if(!/^SA\d{22}$/i.test(iban)){
                    return interaction.reply({ content: "🚫 الآيبان غير صحيح. يجب أن يبدأ بـ SA ويليه 22 رقماً.", ephemeral: true });
                }

                // نظام كشف الغش والتكرار (إذا لم تكن البيانات للشخص نفسه في محاولة التعديل)
                const isUpdating = pendingSubmissions.has(userId);
                if (!isUpdating && (publicNames.has(name) || publicEmails.has(email) || publicPhones.has(phone) || publicIbans.has(iban))) {
                    let strikes = duplicateStrikes.get(userId) || 0;
                    strikes++;
                    duplicateStrikes.set(userId, strikes);

                    if(strikes >= 2){
                        publicBlacklist.add(userId);
                        
                        const logChannel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                        if(logChannel){
                            const banLog = new EmbedBuilder()
                                .setColor("#8b0000")
                                .setTitle("🚨 سجل القائمة السوداء (تلقائي)")
                                .setDescription(`تم رصد محاولة احتيال متكررة لعيدية الدون!\n**المستخدم:** ${interaction.user}\n**ID:** ${userId}\n**السبب:** محاولة إدخال بيانات مكررة عمداً بعد التحذير.`)
                                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                                .setTimestamp();
                            logChannel.send({embeds: [banLog]});
                        }

                        const banEmbed = new EmbedBuilder()
                            .setColor("#8b0000")
                            .setTitle("القائمة السوداء 🩸")
                            .setDescription(`لقد نفد صبر الدون.\nحاولت التحايل ببيانات مسجلة مسبقاً. تم إدراجك في **القائمة السوداء** نهائياً.`);
                        return interaction.reply({ embeds:[banEmbed], ephemeral:true });
                    } else {
                        const warnEmbed = new EmbedBuilder()
                            .setColor("#e74c3c")
                            .setTitle("تحذير أخير من الدون ⚠️")
                            .setDescription(`لقد رصدنا أن بياناتك مسجلة لشخص آخر.\nهذا هو **التحذير الأول والأخير**. المحاولة القادمة تعني القائمة السوداء.`);
                        return interaction.reply({ embeds:[warnEmbed], ephemeral:true });
                    }
                }

                pendingSubmissions.set(userId, { name, email, phone, iban });

                const confirmEmbed = new EmbedBuilder()
                    .setColor("#f39c12")
                    .setTitle("تأكيد بياناتك 📄")
                    .setDescription(`اقرأ بتمعن قبل أن يختم الدون:\n\n**الآيبان المدخل:**\n\`${iban}\`\n\n**هل بياناتك صحيحة؟** تأكد قبل الإرسال.`)
                    .setFooter({text:"استخدم زر تعديل البيانات إذا كان هناك خطأ"})
                    .setTimestamp();

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("confirm_data").setLabel("نعم، الآيبان صحيح").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("edit_data").setLabel("تعديل البيانات").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("cancel_data").setLabel("إلغاء الطلب").setStyle(ButtonStyle.Danger)
                );

                // إذا كان المستخدم يقوم بتعديل البيانات، نقوم بتحديث الرد السابق، وإلا نقوم بإنشاء رد جديد
                if (interaction.message) {
                    await interaction.update({ embeds:[confirmEmbed], components:[confirmRow] }).catch(async () => {
                         await interaction.reply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
                    });
                } else {
                    await interaction.reply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
                }
            }
        }
    } catch (error) {
        console.error("حدث خطأ غير متوقع في الاستجابة:", error);
    }
});

client.login(TOKEN);
