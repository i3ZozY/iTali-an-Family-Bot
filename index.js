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
const MEMORY_CHANNEL_ID = '1482070630424641737';    // روم الذاكرة الأبدية

// أيدي الدون
const ADMIN_IDS = ["1292916898484457538"];

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// ================= ذاكرة البوت (سيتم حفظها واستعادتها) =================
let botData = {
    claimedUsers: [],           // Set will be reconstructed
    familyBlacklist: [],
    familyRewards: [
        { amount: 5, chance: 70 },
        { amount: 10, chance: 15 },
        { amount: 20, chance: 10 },
        { amount: 50, chance: 5 }
    ],
    publicUsers: [],
    publicNames: [],
    publicEmails: [],
    publicPhones: [],
    publicIbans: [],
    clickedUsers: [],
    publicBlacklist: [],
    duplicateStrikes: [],       // [ [userId, strikes], ... ]
    pendingSubmissions: [],     // [ [userId, {name,email,phone,iban}], ... ]
    publicBudgetLimit: 50,
    totalPublicSpent: 0,
    publicRewards: [
        { amount: 0, chance: 55 },
        { amount: 5, chance: 40 },
        { amount: 10, chance: 5 }
    ]
};

// تحويل المصفوفات إلى Sets/Maps بعد التحميل
function convertLoadedData() {
    botData.claimedUsers = new Set(botData.claimedUsers);
    botData.familyBlacklist = new Set(botData.familyBlacklist);
    botData.publicUsers = new Set(botData.publicUsers);
    botData.publicNames = new Set(botData.publicNames);
    botData.publicEmails = new Set(botData.publicEmails);
    botData.publicPhones = new Set(botData.publicPhones);
    botData.publicIbans = new Set(botData.publicIbans);
    botData.clickedUsers = new Set(botData.clickedUsers);
    botData.publicBlacklist = new Set(botData.publicBlacklist);
    botData.duplicateStrikes = new Map(botData.duplicateStrikes);
    botData.pendingSubmissions = new Map(botData.pendingSubmissions);
}

// تهيئة البيانات للتحويل إلى JSON
function prepareDataForSaving() {
    return {
        claimedUsers: Array.from(botData.claimedUsers),
        familyBlacklist: Array.from(botData.familyBlacklist),
        familyRewards: botData.familyRewards,
        publicUsers: Array.from(botData.publicUsers),
        publicNames: Array.from(botData.publicNames),
        publicEmails: Array.from(botData.publicEmails),
        publicPhones: Array.from(botData.publicPhones),
        publicIbans: Array.from(botData.publicIbans),
        clickedUsers: Array.from(botData.clickedUsers),
        publicBlacklist: Array.from(botData.publicBlacklist),
        duplicateStrikes: Array.from(botData.duplicateStrikes.entries()),
        pendingSubmissions: Array.from(botData.pendingSubmissions.entries()),
        publicBudgetLimit: botData.publicBudgetLimit,
        totalPublicSpent: botData.totalPublicSpent,
        publicRewards: botData.publicRewards
    };
}

// دالة حفظ البيانات في الروم
async function saveToDiscord() {
    try {
        const channel = await client.channels.fetch(MEMORY_CHANNEL_ID);
        if (!channel) return console.error("روم الذاكرة غير موجود!");
        
        const dataToSave = prepareDataForSaving();
        const content = JSON.stringify(dataToSave);
        await channel.send(`DATABASE_UPDATE|${content}`);
        console.log("✅ تم حفظ الذاكرة بنجاح.");
    } catch (error) {
        console.error("خطأ في حفظ الذاكرة:", error);
    }
}

// دالة استرجاع البيانات عند التشغيل
async function loadFromDiscord() {
    try {
        const channel = await client.channels.fetch(MEMORY_CHANNEL_ID);
        const messages = await channel.messages.fetch({ limit: 10 });
        const lastDbMsg = messages.find(m => m.content.startsWith('DATABASE_UPDATE|'));

        if (lastDbMsg) {
            const jsonStr = lastDbMsg.content.split('|')[1];
            const loadedData = JSON.parse(jsonStr);
            
            // نسخ البيانات المحملة إلى botData
            botData.claimedUsers = loadedData.claimedUsers || [];
            botData.familyBlacklist = loadedData.familyBlacklist || [];
            botData.familyRewards = loadedData.familyRewards || botData.familyRewards;
            botData.publicUsers = loadedData.publicUsers || [];
            botData.publicNames = loadedData.publicNames || [];
            botData.publicEmails = loadedData.publicEmails || [];
            botData.publicPhones = loadedData.publicPhones || [];
            botData.publicIbans = loadedData.publicIbans || [];
            botData.clickedUsers = loadedData.clickedUsers || [];
            botData.publicBlacklist = loadedData.publicBlacklist || [];
            botData.duplicateStrikes = loadedData.duplicateStrikes || [];
            botData.pendingSubmissions = loadedData.pendingSubmissions || [];
            botData.publicBudgetLimit = loadedData.publicBudgetLimit || 50;
            botData.totalPublicSpent = loadedData.totalPublicSpent || 0;
            botData.publicRewards = loadedData.publicRewards || botData.publicRewards;

            convertLoadedData();
            console.log("✅ تم استعادة ذاكرة الدون بنجاح.");
        } else {
            // إذا لم توجد رسالة سابقة، نستخدم القيم الافتراضية مع تحويلها
            convertLoadedData();
            console.log("⚪ لم يتم العثور على ذاكرة سابقة، البدء بذاكرة جديدة.");
        }
    } catch (error) {
        console.error("خطأ في استعادة الذاكرة:", error);
        // في حالة الفشل، نضمن تحويل القيم الافتراضية
        convertLoadedData();
    }
}

// ================= دوال مساعدة إضافية =================
const cooldowns = new Map(); // هذا لا يحتاج للحفظ

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
    if (totalChance !== 100 && newRewards.length > 0) return null;
    return newRewards.length > 0 ? newRewards : null;
}

// ================= تشغيل البوت =================
client.once("ready", async () => {
    console.log("الدون جاهز... جاري فتح دفاتر المافيا.");
    await loadFromDiscord(); // استعادة الذاكرة عند التشغيل
});

client.on("messageCreate", async message => {
    if(message.author.bot) return;

    if (message.guild && message.guild.id !== ALLOWED_GUILD) return;

    const args = message.content.split(/\s+/);
    const command = args[0].toLowerCase();
    const isDon = ADMIN_IDS.includes(message.author.id);

    // ================= أوامر الإدارة (للدون فقط) =================
    if (isDon) {
        if (command === "!eid_public_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            botData.publicBlacklist.add(targetId);
            await saveToDiscord();
            return message.reply(`تم إدراج ${targetId} في القائمة السوداء الخاصة بعيدية الدون.`);
        }
        if (command === "!eid_public_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            botData.publicBlacklist.delete(targetId);
            botData.duplicateStrikes.delete(targetId);
            await saveToDiscord();
            return message.reply(`تم العفو عن ${targetId} من القائمة السوداء لعيدية الدون.`);
        }

        if (command === "!eid_family_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            botData.familyBlacklist.add(targetId);
            await saveToDiscord();
            return message.reply(`تم حظر ${targetId} من عيدية العائلة.`);
        }
        if (command === "!eid_family_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            botData.familyBlacklist.delete(targetId);
            await saveToDiscord();
            return message.reply(`تم فك حظر ${targetId} من عيدية العائلة.`);
        }

        if (command === "!eid_public_reset") {
            botData.publicUsers.clear();
            botData.publicNames.clear();
            botData.publicEmails.clear();
            botData.publicPhones.clear();
            botData.publicIbans.clear();
            botData.clickedUsers.clear();
            botData.duplicateStrikes.clear();
            botData.pendingSubmissions.clear();
            botData.totalPublicSpent = 0;
            await saveToDiscord();
            return message.reply("تم تصفير الميزانية ومسح سجلات عيدية الدون لبدء عيد جديد.");
        }
        if (command === "!eid_family_reset") {
            botData.claimedUsers.clear();
            await saveToDiscord();
            return message.reply("تم مسح سجلات المستلمين لبدء عيدية عائلة جديدة.");
        }

        if (command === "!eid_public_amount" && args[1]) {
            const newLimit = parseInt(args[1]);
            if (!isNaN(newLimit)) {
                botData.publicBudgetLimit = newLimit;
                await saveToDiscord();
                return message.reply(`تم تعيين الحد الأقصى للميزانية بنجاح.`);
            }
        }

        if (command === "!eid_public_money") {
            const newRewards = parseRewardsArgs(args);
            if (newRewards) {
                botData.publicRewards = newRewards;
                await saveToDiscord();
                return message.reply("تم تعيين المبالغ ونسب الظهور لعيدية الدون بنجاح.");
            } else {
                return message.reply("صيغة خاطئة أو مجموع النسب لا يساوي 100. استخدم الصيغة: `المبلغ:النسبة` مثال: `!eid_public_money 0:50 5:30 10:20`");
            }
        }

        if (command === "!eid_family_money") {
            const newRewards = parseRewardsArgs(args);
            if (newRewards) {
                botData.familyRewards = newRewards;
                await saveToDiscord();
                return message.reply("تم تعيين المبالغ ونسب الظهور لعيدية العائلة بنجاح.");
            } else {
                return message.reply("صيغة خاطئة أو مجموع النسب لا يساوي 100. استخدم الصيغة: `المبلغ:النسبة` مثال: `!eid_family_money 5:50 10:30 50:20`");
            }
        }

        if (command === "!stats") {
            const totalDistributed = botData.totalPublicSpent; // يمكنك أيضًا حساب totalDistributed للعائلة إذا أردت
            const claimersCount = botData.claimedUsers.size;
            // أعلى عيدية من publicRewards? يمكننا حسابها من السجلات، ولكن سنبسطها:
            const highestClaim = Math.max(...botData.publicRewards.map(r => r.amount), 0);

            const statsEmbed = {
                color: 0xffd700,
                title: '📊 إحصائيات إمبراطورية الدون',
                fields: [
                    { name: '💰 إجمالي المبالغ الموزعة (عيدية الدون)', value: `${botData.totalPublicSpent} ريال`, inline: true },
                    { name: '👥 عدد المستفيدين (العائلة)', value: `${botData.claimedUsers.size} شخص`, inline: true },
                    { name: '🏆 أعلى عيدية', value: `${highestClaim} ريال`, inline: false },
                ],
                footer: { text: 'سجلات المافيا لا تنسى' },
                timestamp: new Date(),
            };
            return message.reply({ embeds: [statsEmbed] });
        }

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
                    { name: "!eid_family_money [المبلغ:النسبة]", value: "تحديد المبالغ ونسب ظهورها لعيدية العائلة." },
                    { name: "!stats", value: "عرض إحصائيات عامة (للدون فقط)." }
                )
                .setFooter({ text: "للاستخدام من قبل الدون فقط" });
            return message.reply({ embeds: [helpEmbed] });
        }
    }

    // ================= أمر العيدية الأساسي =================
    if(command === "!eid"){
        if (message.guild) {
            const isOwner = message.guild.ownerId === message.author.id;
            const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
            if (!isDon && !isOwner && !isAdmin) {
                return message.reply("هذا الأمر مخصص للإدارة ومالك السيرفر والدون فقط.");
            }
        }

        const userId = message.author.id;

        if(cooldowns.has(userId)){
            const expiry = cooldowns.get(userId) + 30000;
            if(Date.now() < expiry){
                const left = ((expiry - Date.now()) / 1000).toFixed(1);
                return message.reply(`تأنَّ قليلاً. انتظر ${left} ثانية.`).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
            }
        }
        cooldowns.set(userId, Date.now());

        try {
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
            } else {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                    .setCustomId("public_button")
                    .setLabel("أبي عيدية")
                    .setStyle(ButtonStyle.Primary)
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
    if (interaction.guild && interaction.guild.id !== ALLOWED_GUILD) return;

    try {
        if(interaction.isButton()){
            const userId = interaction.user.id;

            if(interaction.customId === "eidiya_family_button"){
                if(botData.familyBlacklist.has(userId)){
                    return interaction.reply({ content: "أنت محظور من عيدية العائلة بأمر الدون.", ephemeral: true });
                }
                if(botData.claimedUsers.has(userId)){
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

            if(interaction.customId === "public_button"){
                if(botData.publicBlacklist.has(userId)){
                    const blacklistEmbed = new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("أنت في القائمة السوداء ☠️")
                        .setDescription(`لقد تجاوزت حدودك وحاولت خداع الدون.\nأبواب العائلة مغلقة في وجهك للأبد.`)
                        .setFooter({text:"المافيا لا تغفر"});
                    return interaction.reply({ embeds:[blacklistEmbed], ephemeral:true });
                }

                if(botData.clickedUsers.has(userId) && !botData.pendingSubmissions.has(userId)){
                    const alreadyClickedEmbed = new EmbedBuilder()
                        .setColor("#e67e22")
                        .setTitle("تم استلام بياناتك مسبقاً 📜")
                        .setDescription(`لقد قمت بتقديم بياناتك بالفعل.\nالدون لا يقرأ البيانات مرتين.`);
                    return interaction.reply({ embeds:[alreadyClickedEmbed], ephemeral:true });
                }

                if(botData.totalPublicSpent >= botData.publicBudgetLimit){
                    const closedVaultEmbed = new EmbedBuilder()
                        .setColor("#34495e")
                        .setTitle("الخزنة أُغلقت 🚪")
                        .setDescription(`**الدون قفل الخزنة.**\nنفدت العطايا المخصصة لهذا العيد.`);
                    return interaction.reply({ embeds:[closedVaultEmbed], ephemeral:true });
                }

                const modal = new ModalBuilder()
                    .setCustomId("public_modal")
                    .setTitle("بياناتك لتسليم عيدية الدون");

                const nameInput = new TextInputBuilder().setCustomId("input_name").setLabel("الاسم الكامل").setStyle(TextInputStyle.Short).setRequired(true);
                const emailInput = new TextInputBuilder().setCustomId("input_email").setLabel("الإيميل").setStyle(TextInputStyle.Short).setRequired(true);
                const phoneInput = new TextInputBuilder().setCustomId("input_phone").setLabel("الهاتف (10 أرقام)").setStyle(TextInputStyle.Short).setRequired(true);
                const ibanInput = new TextInputBuilder().setCustomId("input_iban").setLabel("الآيبان (SA + 22 رقم)").setStyle(TextInputStyle.Short).setRequired(true);

                if (botData.pendingSubmissions.has(userId)) {
                    const oldData = botData.pendingSubmissions.get(userId);
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

            if(interaction.customId === "confirm_data"){
                const data = botData.pendingSubmissions.get(userId);
                if(!data) return interaction.reply({ content: "انتهت صلاحية جلستك.", ephemeral: true });

                if(botData.totalPublicSpent >= botData.publicBudgetLimit){
                    return interaction.update({ 
                        embeds: [new EmbedBuilder().setColor("#34495e").setTitle("الخزنة أُغلقت 🚪").setDescription("أغلق الدون الخزنة قبل وصول بياناتك.")],
                        components: [] 
                    });
                }

                botData.publicUsers.add(userId);
                botData.publicNames.add(data.name);
                botData.publicEmails.add(data.email);
                botData.publicPhones.add(data.phone);
                botData.publicIbans.add(data.iban);
                botData.pendingSubmissions.delete(userId); 
                botData.clickedUsers.add(userId);

                // حفظ مؤقت قبل تحديد المبلغ (لأن التحديث سيحدث بعد 8 ثوانٍ)
                await saveToDiscord();

                const waitingEmbed = new EmbedBuilder()
                    .setColor("#555555")
                    .setTitle("مراجعة البيانات")
                    .setDescription(`تم ارسال بياناتك **للدون**.\nيتم الآن تحديد نصيبك من الخزنة.. الصبر مطلوب الآن.`)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

                await interaction.update({ embeds:[waitingEmbed], components:[] });

                setTimeout(async () => {
                    let amount = getRandomReward(botData.publicRewards);
                    if(botData.totalPublicSpent + amount > botData.publicBudgetLimit) amount = botData.publicBudgetLimit - botData.totalPublicSpent; 
                    botData.totalPublicSpent += amount;

                    // حفظ بعد تحديث totalPublicSpent
                    await saveToDiscord();

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
                const data = botData.pendingSubmissions.get(userId) || { name:"", email:"", phone:"", iban:"" };
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
                botData.pendingSubmissions.delete(userId);
                botData.clickedUsers.delete(userId);
                await saveToDiscord();

                const cancelEmbed = new EmbedBuilder()
                    .setColor("#7f8c8d")
                    .setTitle("تم سحب الطلب")
                    .setDescription("تراجعت واحتفظت ببياناتك. خيار حكيم.");
                await interaction.update({ embeds:[cancelEmbed], components:[] });
            }
        }

        if(interaction.isModalSubmit()){
            const userId = interaction.user.id;

            if(interaction.customId === "family_modal"){
                let iban = interaction.fields.getTextInputValue("input_family_iban").replace(/\s+/g, '');

                if(!/^SA\d{22}$/i.test(iban)){
                    return interaction.reply({ content: "🚫 صيغة الآيبان خاطئة! يجب أن يبدأ بـ SA ويليه 22 رقماً.", ephemeral: true });
                }

                botData.claimedUsers.add(userId);
                await saveToDiscord();

                const waitingEmbed = new EmbedBuilder()
                    .setColor("#2f3136")
                    .setTitle("خزنة العائلة")
                    .setDescription(`قام الدون بفتح **خزنة العائلة** الآن ويقوم بتسجيل الآيبان الخاص بك.\nانتظر قليلًا بينما يحدد نصيبك.`)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

                await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

                setTimeout(async () => {
                    const amount = getRandomReward(botData.familyRewards);
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

                const isUpdating = botData.pendingSubmissions.has(userId);
                if (!isUpdating && (botData.publicNames.has(name) || botData.publicEmails.has(email) || botData.publicPhones.has(phone) || botData.publicIbans.has(iban))) {
                    let strikes = botData.duplicateStrikes.get(userId) || 0;
                    strikes++;
                    botData.duplicateStrikes.set(userId, strikes);
                    await saveToDiscord();

                    if(strikes >= 2){
                        botData.publicBlacklist.add(userId);
                        await saveToDiscord();
                        
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

                botData.pendingSubmissions.set(userId, { name, email, phone, iban });
                await saveToDiscord();

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
