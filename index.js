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

// ضع الأيدي الخاص بك هنا لتتمكن من استخدام أوامر الإدارة (الدون فقط)
const ADMIN_IDS = ["1292916898484457538"];

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// --- ذاكرة العائلة ---
const claimedUsers = new Set(); 

// --- ذاكرة العيدية العلنية والمافيا ---
let publicUsers = new Set();
let publicNames = new Set();
let publicEmails = new Set();
let publicPhones = new Set();
let publicIbans = new Set();
let clickedUsers = new Set(); 
let blacklistedUsers = new Set(); 
let duplicateStrikes = new Map(); 
let pendingSubmissions = new Map(); 

// حماية السبام (Rate Limit)
const cooldowns = new Map();

let totalPublicSpent = 0; // الحد الأقصى 50

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

// ================= استرجاع البيانات عند التشغيل =================
client.once("ready", async () => {
    console.log("الدون جاهز... جاري فتح دفاتر المافيا.");
    
    try {
        const channel = await client.channels.fetch(PUBLIC_LOG_CHANNEL);
        if(channel) {
            let lastId;
            let totalFetched = 0;
            while(true) {
                const options = { limit: 100 };
                if(lastId) options.before = lastId;
                const msgs = await channel.messages.fetch(options);
                if(msgs.size === 0) break;
                
                msgs.forEach(msg => {
                    if(msg.embeds.length > 0) {
                        const embed = msg.embeds[0];
                        
                        // استرجاع القائمة السوداء
                        if(embed.title && embed.title.includes("القائمة السوداء")) {
                            const idMatch = embed.description.match(/\*\*ID:\*\*\s+(\d+)/);
                            if(idMatch) blacklistedUsers.add(idMatch[1]);
                        }
                        
                        // استرجاع السجلات المالية
                        if(embed.fields && embed.fields.length >= 6) {
                            const fields = embed.fields;
                            const idMatch = fields[0].value.match(/\((\d+)\)/);
                            if(idMatch) {
                                publicUsers.add(idMatch[1]);
                                clickedUsers.add(idMatch[1]);
                            }
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
                totalFetched += msgs.size;
            }
            console.log(`تم استرجاع السجلات. صرف الشارع حتى الآن: ${totalPublicSpent} ريال. المحظورين: ${blacklistedUsers.size}`);
        }
    } catch (err) {
        console.error("حدث خطأ أثناء قراءة اللوق:", err);
    }
});

client.on("messageCreate", async message => {
    if(message.author.bot) return;

    // ================= أوامر الإدارة (للدون فقط) =================
    if (ADMIN_IDS.includes(message.author.id)) {
        const args = message.content.split(" ");
        const command = args[0].toLowerCase();

        // تصفير الميزانية
        if (command === "!reset_public") {
            publicUsers.clear();
            publicNames.clear();
            publicEmails.clear();
            publicPhones.clear();
            publicIbans.clear();
            clickedUsers.clear();
            duplicateStrikes.clear();
            totalPublicSpent = 0;
            return message.reply("تم تصفير ميزانية الشارع وفتح الخزنة من جديد. السجلات السابقة بقيت في اللوق لكن الذاكرة نُظفت.");
        }

        // حظر يدوي
        if (command === "!ban" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            blacklistedUsers.add(targetId);
            
            const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
            if(channel){
                const banLog = new EmbedBuilder()
                    .setColor("#8b0000")
                    .setTitle("🚨 سجل القائمة السوداء (يدوي)")
                    .setDescription(`بأمر مباشر من الدون، تم حظر هذا الشخص نهائياً.\n**ID:** ${targetId}\nلن يستلم أي عيدية بعد اليوم.`)
                    .setTimestamp();
                channel.send({embeds: [banLog]});
            }
            return message.reply(`تم إدراج ${targetId} في القائمة السوداء.`);
        }

        // فك الحظر
        if (command === "!unban" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            if(blacklistedUsers.has(targetId)){
                blacklistedUsers.delete(targetId);
                duplicateStrikes.delete(targetId); // تصفير محاولات الغش له
                return message.reply(`تم العفو عن ${targetId} بأمر الدون.`);
            } else {
                return message.reply("هذا الشخص ليس في القائمة السوداء.");
            }
        }
    }

    // ================= أمر العيدية (!eid) =================
    if(message.content === "!eid"){
        const userId = message.author.id;

        // حماية السبام (30 ثانية)
        if(cooldowns.has(userId)){
            const expiry = cooldowns.get(userId) + 30000;
            if(Date.now() < expiry){
                const left = ((expiry - Date.now()) / 1000).toFixed(1);
                return message.reply(`تأنَّ قليلاً يا صديقي. انتظر ${left} ثانية قبل طلب مقابلة الدون مجدداً.`).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
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
            
            // --- 2. الخاص (الشارع) ---
            else {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                    .setCustomId("public_button")
                    .setLabel("أبي عيدية")
                    .setStyle(ButtonStyle.Secondary)
                );

                const embed = new EmbedBuilder()
                    .setColor("#2c3e50") 
                    .setTitle("خزنة الدون 💰")
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
    
    try {
        // ================= الأزرار =================
        if(interaction.isButton()){
            
            // --- زر عيدية العائلة ---
            if(interaction.customId === "eidiya_family_button"){
                const userId = interaction.user.id;
                
                if(claimedUsers.has(userId)){
                    const rejectEmbed = new EmbedBuilder()
                        .setColor("#ff0000")
                        .setTitle("🚫 تم تسجيل اسمك مسبقًا")
                        .setDescription(`اسمك مسجل بالفعل في **دفتر الدون**.\nلقد استلمت عيديتك مسبقًا.`)
                        .setFooter({text:"دفتر الدون لا ينسى"})
                        .setTimestamp();
                    return interaction.reply({ embeds:[rejectEmbed], ephemeral:true });
                }

                // مودل العائلة لطلب الآيبان
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

            // --- زر العلني (الشارع) ---
            if(interaction.customId === "public_button"){
                const userId = interaction.user.id;

                if(blacklistedUsers.has(userId)){
                    const blacklistEmbed = new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("أنت في القائمة السوداء ☠️")
                        .setDescription(`لقد تجاوزت حدودك وحاولت خداع الدون.\nأبواب العائلة مغلقة في وجهك للأبد.`)
                        .setFooter({text:"المافيا لا تغفر"})
                        .setTimestamp();
                    return interaction.reply({ embeds:[blacklistEmbed], ephemeral:true });
                }

                if(clickedUsers.has(userId)){
                    const alreadyClickedEmbed = new EmbedBuilder()
                        .setColor("#e67e22")
                        .setTitle("تم استلام بياناتك مسبقاً 📜")
                        .setDescription(`لقد قمت بتقديم بياناتك بالفعل.\nالدون لا يقرأ البيانات مرتين.`)
                        .setFooter({text:"البيانات مسجلة بالدم"})
                        .setTimestamp();
                    return interaction.reply({ embeds:[alreadyClickedEmbed], ephemeral:true });
                }

                if(totalPublicSpent >= 50){
                    const closedVaultEmbed = new EmbedBuilder()
                        .setColor("#34495e")
                        .setTitle("الخزنة أُغلقت 🚪")
                        .setDescription(`**الدون قفل الخزنة.**\nنفدت العطايا المخصصة لهذا العيد.`)
                        .setFooter({text:"المافيا توزع بمقدار"})
                        .setTimestamp();
                    return interaction.reply({ embeds:[closedVaultEmbed], ephemeral:true });
                }

                clickedUsers.add(userId);

                const modal = new ModalBuilder()
                    .setCustomId("public_modal")
                    .setTitle("بياناتك لتسليم عيديتك");

                const nameInput = new TextInputBuilder().setCustomId("input_name").setLabel("الاسم الكامل (الرباعي)").setStyle(TextInputStyle.Short).setRequired(true);
                const emailInput = new TextInputBuilder().setCustomId("input_email").setLabel("الإيميل (يجب أن يحتوي على @)").setStyle(TextInputStyle.Short).setRequired(true);
                const phoneInput = new TextInputBuilder().setCustomId("input_phone").setLabel("الهاتف (10 أرقام)").setStyle(TextInputStyle.Short).setRequired(true);
                const ibanInput = new TextInputBuilder().setCustomId("input_iban").setLabel("الآيبان (SA + 22 رقم)").setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(emailInput),
                    new ActionRowBuilder().addComponents(phoneInput),
                    new ActionRowBuilder().addComponents(ibanInput)
                );

                await interaction.showModal(modal);
            }

            // --- أزرار التأكيد (العلني) ---
            if(interaction.customId === "confirm_data"){
                const userId = interaction.user.id;
                const data = pendingSubmissions.get(userId);
                
                if(!data) return interaction.reply({ content: "انتهت صلاحية جلستك.", ephemeral: true });

                if(totalPublicSpent >= 50){
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

                const waitingEmbed = new EmbedBuilder()
                    .setColor("#555555")
                    .setTitle("مراجعة البيانات")
                    .setDescription(`تم ارسال بياناتك **للدون**.\nيتم الآن تحديد نصيبك من الخزنة.. الصبر مطلوب الآن.`)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({text:"القرار لا يُراجع"})
                    .setTimestamp();

                await interaction.update({ embeds:[waitingEmbed], components:[] });

                setTimeout(async () => {
                    let amount = getPublicEidiya();
                    if(totalPublicSpent + amount > 50) amount = 50 - totalPublicSpent; 
                    totalPublicSpent += amount;

                    let desc = amount === 0 
                        ? `نفث الدون دخان سيجاره وقرر أنك لا تستحق شيئاً.\n\nالمبلغ: **0 ريال**\nاعتبر بقاءك آمناً هو أعظم عيدية.`
                        : `أومأ الدون برأسه ووافق على مكافأتك.\n\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\nسيتم تحويلها لآيبانك.`;

                    const resultEmbed = new EmbedBuilder()
                        .setColor(getPublicColorByAmount(amount))
                        .setTitle("قرار الدون")
                        .setDescription(desc)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({text:"انتهت المعاملة."})
                        .setTimestamp();

                    try { await interaction.editReply({ embeds:[resultEmbed] }); } catch(e){}

                    const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                    if(channel){
                        const logEmbed = new EmbedBuilder()
                            .setColor("#050505")
                            .setTitle("سجلات العيدية الموثقة")
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

            if(interaction.customId === "cancel_data"){
                pendingSubmissions.delete(interaction.user.id);
                clickedUsers.delete(interaction.user.id); 

                const cancelEmbed = new EmbedBuilder()
                    .setColor("#7f8c8d")
                    .setTitle("تم سحب الطلب")
                    .setDescription("تراجعت واحتفظت ببياناتك. خيار حكيم.")
                    .setTimestamp();
                await interaction.update({ embeds:[cancelEmbed], components:[] });
            }
        }

        // ================= النماذج (Modals) =================
        if(interaction.isModalSubmit()){
            
            // --- مودل العائلة ---
            if(interaction.customId === "family_modal"){
                const userId = interaction.user.id;
                let iban = interaction.fields.getTextInputValue("input_family_iban").replace(/\s+/g, '');

                // تحقق الآيبان للعائلة
                if(!/^SA\d{22}$/i.test(iban)){
                    return interaction.reply({ content: "🚫 صيغة الآيبان خاطئة! يجب أن يبدأ بـ SA ويليه 22 رقماً.", ephemeral: true });
                }

                claimedUsers.add(userId);

                const waitingEmbed = new EmbedBuilder()
                    .setColor("#2f3136")
                    .setTitle("خزنة العائلة")
                    .setDescription(`قام الدون بفتح **خزنة العائلة** الآن ويقوم بتسجيل الآيبان الخاص بك.\nانتظر قليلًا بينما يحدد نصيبك.`)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({text:"كل شيء يسجل في دفتر الدون"})
                    .setTimestamp();

                await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

                setTimeout(async () => {
                    const amount = getEidiya();
                    const resultEmbed = new EmbedBuilder()
                        .setColor(getColorByAmount(amount))
                        .setTitle("عيدية العائلة")
                        .setDescription(`بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.\n\nالمبلغ:\n**${amount} ريال**\n\nالآيبان المسجل: \`${iban}\``)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({text:"العائلة لا تنسى"})
                        .setTimestamp();

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

            // --- مودل الشارع (العلني) ---
            if(interaction.customId === "public_modal"){
                const userId = interaction.user.id;
                const name = interaction.fields.getTextInputValue("input_name").trim();
                const email = interaction.fields.getTextInputValue("input_email").trim();
                const phone = interaction.fields.getTextInputValue("input_phone").replace(/\s+/g, '');
                const iban = interaction.fields.getTextInputValue("input_iban").replace(/\s+/g, '');

                // 1. الفحص المنطقي للبيانات (Data Validation)
                if(!email.includes("@")){
                    clickedUsers.delete(userId); // نعطيه فرصة يضغط الزر تاني يصحح
                    return interaction.reply({ content: "🚫 الإيميل غير صحيح. يجب أن يحتوي على علامة @.", ephemeral: true });
                }
                if(!/^\d{10}$/.test(phone)){
                    clickedUsers.delete(userId);
                    return interaction.reply({ content: "🚫 رقم الهاتف غير صحيح. يجب أن يتكون من 10 أرقام فقط.", ephemeral: true });
                }
                if(!/^SA\d{22}$/i.test(iban)){
                    clickedUsers.delete(userId);
                    return interaction.reply({ content: "🚫 الآيبان غير صحيح. يجب أن يبدأ بـ SA ويليه 22 رقماً.", ephemeral: true });
                }

                // 2. نظام كشف الغش
                if(publicNames.has(name) || publicEmails.has(email) || publicPhones.has(phone) || publicIbans.has(iban)){
                    let strikes = duplicateStrikes.get(userId) || 0;
                    strikes++;
                    duplicateStrikes.set(userId, strikes);

                    if(strikes >= 2){
                        blacklistedUsers.add(userId);
                        
                        // سجل الخونة يرسل للوق
                        const logChannel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                        if(logChannel){
                            const banLog = new EmbedBuilder()
                                .setColor("#8b0000")
                                .setTitle("🚨 سجل القائمة السوداء (تلقائي)")
                                .setDescription(`تم رصد محاولة احتيال متكررة!\n**المستخدم:** ${interaction.user}\n**ID:** ${userId}\n**السبب:** محاولة إدخال بيانات مكررة عمداً بعد التحذير.`)
                                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                                .setTimestamp();
                            logChannel.send({embeds: [banLog]});
                        }

                        const banEmbed = new EmbedBuilder()
                            .setColor("#8b0000")
                            .setTitle("القائمة السوداء 🩸")
                            .setDescription(`لقد نفد صبر الدون.\nحاولت التحايل ببيانات مسجلة مسبقاً. تم إدراجك في **القائمة السوداء** نهائياً.`)
                            .setTimestamp();
                        return interaction.reply({ embeds:[banEmbed], ephemeral:true });
                    } else {
                        const warnEmbed = new EmbedBuilder()
                            .setColor("#e74c3c")
                            .setTitle("تحذير أخير من الدون ⚠️")
                            .setDescription(`لقد رصدنا أن بياناتك مسجلة لشخص آخر.\nهذا هو **التحذير الأول والأخير**. المحاولة القادمة تعني القائمة السوداء.`)
                            .setTimestamp();
                        clickedUsers.delete(userId); // نعطيه فرصة يصلح إذا كان غلطان مو غشاش
                        return interaction.reply({ embeds:[warnEmbed], ephemeral:true });
                    }
                }

                // البيانات سليمة، تأكيد أخير
                pendingSubmissions.set(userId, { name, email, phone, iban });

                const confirmEmbed = new EmbedBuilder()
                    .setColor("#f39c12")
                    .setTitle("تأكيد بياناتك 📄")
                    .setDescription(`اقرأ بتمعن قبل أن يختم الدون:\n\n**الآيبان المدخل:**\n\`${iban}\`\n\nهل أنت متأكد؟ إذا كان خاطئاً، لن يتم تحويل المبلغ.`)
                    .setFooter({text:"المافيا لا تصحح أخطاء الآخرين"})
                    .setTimestamp();

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("confirm_data").setLabel("نعم، الآيبان صحيح").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("cancel_data").setLabel("إلغاء الطلب").setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
            }
        }
    } catch (error) {
        console.error("حدث خطأ غير متوقع في الاستجابة:", error);
    }
});

client.login(TOKEN);
