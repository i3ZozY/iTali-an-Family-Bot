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
const TARGET_GUILD_ID = "1481377720330879078";      // السيرفر الوحيد المسموح للبوت بالعمل فيه
const LOG_CHANNEL = "1481705807560310874";          // روم العائلة
const PUBLIC_LOG_CHANNEL = "1481757344269336807";   // روم عيدية الدون

// الأيدي الوحيد الذي يملك الصلاحيات الإدارية العليا (أنت)
const ADMIN_IDS = ["1292916898484457538"];

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// ================= الذاكرة =================
// --- ذاكرة العائلة (ميزانية مفتوحة) ---
const claimedUsers = new Set(); 
const familyBlacklistedUsers = new Set();

// --- ذاكرة عيدية الدون (ميزانية 50 ريال) ---
const publicUsers = new Set();
const publicNames = new Set();
const publicEmails = new Set();
const publicPhones = new Set();
const publicIbans = new Set();
const clickedUsers = new Set(); 
const publicBlacklistedUsers = new Set(); 
const duplicateStrikes = new Map(); 
const pendingSubmissions = new Map(); 

let totalPublicSpent = 0; // ميزانية عيدية الدون (الحد 50 ريال)

// حماية السبام (Rate Limit)
const cooldowns = new Map();

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

client.once("ready", () => {
    console.log("الدون جاهز... وكل عام وأنتم بخير.");
});

client.on("messageCreate", async message => {
    if(message.author.bot) return;

    // منع البوت من العمل في سيرفرات أخرى (السماح بالخاص والسيرفر المحدد فقط)
    if(message.guild && message.guild.id !== TARGET_GUILD_ID) return;

    const args = message.content.split(" ");
    const command = args[0].toLowerCase();

    // ================= أوامر الإدارة (للدون فقط) =================
    if (ADMIN_IDS.includes(message.author.id)) {
        
        // --- حظر من عيدية الدون ---
        if (command === "!eid_public_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            publicBlacklistedUsers.add(targetId);
            return message.reply(`تم منع ${targetId} من استلام عيدية الدون.`);
        }

        // --- فك الحظر من عيدية الدون ---
        if (command === "!eid_public_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            publicBlacklistedUsers.delete(targetId);
            duplicateStrikes.delete(targetId);
            return message.reply(`تم فك الحظر عن ${targetId} ليتمكن من استلام عيدية الدون.`);
        }

        // --- حظر من العيدية العائلية ---
        if (command === "!eid_family_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            familyBlacklistedUsers.add(targetId);
            return message.reply(`تم حرمان ${targetId} من عيدية العائلة.`);
        }

        // --- فك الحظر من العيدية العائلية ---
        if (command === "!eid_family_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            familyBlacklistedUsers.delete(targetId);
            return message.reply(`تم العفو عن ${targetId} وإعادته لاستلام عيدية العائلة.`);
        }

        // --- تصفير ميزانية وسجلات عيدية الدون ---
        if (command === "!eid_public_reset") {
            publicUsers.clear();
            publicNames.clear();
            publicEmails.clear();
            publicPhones.clear();
            publicIbans.clear();
            clickedUsers.clear();
            duplicateStrikes.clear();
            totalPublicSpent = 0;
            return message.reply("تم تصفير ميزانية عيدية الدون (عادت 50 ريال) ومسح السجلات لبدء التوزيع من جديد.");
        }

        // --- تصفير سجلات العائلة ---
        if (command === "!eid_family_reset") {
            claimedUsers.clear();
            return message.reply("تم مسح دفاتر العائلة لبدء التوزيع من جديد (ميزانية العائلة مفتوحة).");
        }
    }

    // ================= أمر المساعدة (!help) =================
    if (command === "!help") {
        const helpEmbed = new EmbedBuilder()
            .setColor("#2c3e50")
            .setTitle("📜 أوامر نظام العيدية")
            .setDescription("إليك جميع الأوامر المتاحة:")
            .addFields(
                { name: "أوامر عامة:", value: "`!eid` - لطلب العيدية (في الخاص للجميع، وفي السيرفر للإدارة فقط)." }
            )
            .setThumbnail(client.user.displayAvatarURL());

        if (ADMIN_IDS.includes(message.author.id)) {
            helpEmbed.addFields(
                { name: "✨ أوامر عيدية الدون:", value: "`!eid_public_block <id>` - حظر شخص.\n`!eid_public_unblock <id>` - فك الحظر.\n`!eid_public_reset` - تصفير السجلات والميزانية (50 ريال)." },
                { name: "🩸 أوامر عيدية العائلة:", value: "`!eid_family_block <id>` - حظر شخص.\n`!eid_family_unblock <id>` - فك الحظر.\n`!eid_family_reset` - تصفير سجلات الاستلام (لا يوجد حد للميزانية)." }
            );
        }
        helpEmbed.setFooter({ text: "كل عام وأنتم بخير 🌙" }).setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }

    // ================= أمر العيدية (!eid) =================
    if(command === "!eid"){
        const userId = message.author.id;

        // حماية السبام (30 ثانية)
        if(cooldowns.has(userId)){
            const expiry = cooldowns.get(userId) + 30000;
            if(Date.now() < expiry){
                const left = ((expiry - Date.now()) / 1000).toFixed(1);
                return message.reply(`مهلاً يا صديقي! انتظر ${left} ثانية قبل المحاولة مجدداً.`).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
            }
        }
        cooldowns.set(userId, Date.now());

        try {
            // --- 1. سيرفر العائلة ---
            if(message.guild){
                const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.guild.ownerId === message.author.id;
                
                if(!isAdmin){
                    return message.reply("🚫 هذا الأمر مخصص للإدارة فقط لتوزيع عيدية العائلة. اذهب إلى الخاص واكتب `!eid` لطلب عيدية الدون.");
                }

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
                    .setLabel("طلب العيدية 🎁")
                    .setStyle(ButtonStyle.Primary)
                );

                const embed = new EmbedBuilder()
                    .setColor("#f1c40f") 
                    .setTitle("✨ عيدية الدون ✨")
                    .setDescription(`**كل عام وأنتم بخير! 🌙**\n\nبمناسبة العيد السعيد، قرر الدون توزيع عيدية خاصة لكم لإدخال السرور على قلوبكم.\nالميزانية محدودة والفرصة تأتي مرة واحدة، فتأكد من إدخال بياناتك بشكل صحيح.\n\nاضغط على زر **طلب العيدية** وسجل بياناتك.`)
                    .setImage(VAULT_IMAGE)
                    .setFooter({text:"عيدكم مبارك 🎉"})
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
        if(interaction.isButton()){
            
            // --- زر عيدية العائلة ---
            if(interaction.customId === "eidiya_family_button"){
                const userId = interaction.user.id;
                
                if(familyBlacklistedUsers.has(userId)){
                    return interaction.reply({ content: "☠️ لقد تم طردك من العائلة. لا يحق لك المطالبة بأي عيدية.", ephemeral: true });
                }

                if(claimedUsers.has(userId)){
                    const rejectEmbed = new EmbedBuilder().setColor("#ff0000").setTitle("🚫 تم تسجيل اسمك مسبقًا").setDescription(`اسمك مسجل بالفعل في **دفتر الدون**.\nلقد استلمت عيديتك مسبقًا.`);
                    return interaction.reply({ embeds:[rejectEmbed], ephemeral:true });
                }

                const modal = new ModalBuilder().setCustomId("family_modal").setTitle("أدخل الآيبان البنكي");
                const ibanInput = new TextInputBuilder().setCustomId("input_family_iban").setLabel("الآيبان البنكي (SA + 22 رقم)").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(ibanInput));
                await interaction.showModal(modal);
            }

            // --- زر عيدية الدون (الخاص) ---
            if(interaction.customId === "public_button"){
                const userId = interaction.user.id;

                if(publicBlacklistedUsers.has(userId)){
                    const blacklistEmbed = new EmbedBuilder().setColor("#e74c3c").setTitle("عذراً 🚫").setDescription(`تم حظر حسابك من استلام عيدية الدون بسبب مخالفة سابقة.`);
                    return interaction.reply({ embeds:[blacklistEmbed], ephemeral:true });
                }

                if(clickedUsers.has(userId)){
                    return interaction.reply({ content: "📜 لقد قمت بتقديم بياناتك بالفعل. نتمنى لك عيداً سعيداً!", ephemeral: true });
                }

                if(totalPublicSpent >= 50){
                    return interaction.reply({ content: "🚪 **كل عام وأنتم بخير!** للأسف نفدت الميزانية المخصصة لعيدية الدون هذا العيد.", ephemeral: true });
                }

                clickedUsers.add(userId);

                const modal = new ModalBuilder().setCustomId("public_modal").setTitle("بيانات استلام العيدية 🎁");
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

            // --- أزرار التأكيد (عيدية الدون) ---
            if(interaction.customId === "confirm_data"){
                const userId = interaction.user.id;
                const data = pendingSubmissions.get(userId);
                
                if(!data) return interaction.reply({ content: "انتهت صلاحية الجلسة. يرجى المحاولة مرة أخرى.", ephemeral: true });

                if(totalPublicSpent >= 50){
                    return interaction.update({ embeds: [new EmbedBuilder().setColor("#34495e").setTitle("الخزنة أُغلقت 🚪").setDescription("عذراً، انتهت الميزانية قبل اكتمال طلبك. عيدك مبارك!")], components: [] });
                }

                publicUsers.add(userId);
                publicNames.add(data.name);
                publicEmails.add(data.email);
                publicPhones.add(data.phone);
                publicIbans.add(data.iban);
                pendingSubmissions.delete(userId); 

                const waitingEmbed = new EmbedBuilder().setColor("#f39c12").setTitle("مراجعة البيانات ⏳").setDescription(`تم إرسال بياناتك بنجاح.\nيتم الآن تحديد نصيبك من عيدية الدون.. لحظات من فضلك!`);
                await interaction.update({ embeds:[waitingEmbed], components:[] });

                setTimeout(async () => {
                    let amount = getPublicEidiya();
                    if(totalPublicSpent + amount > 50) amount = 50 - totalPublicSpent; 
                    totalPublicSpent += amount;

                    let desc = amount === 0 
                        ? `حظاً أوفر هذه المرة! نصيبك من العشوائية كان **0 ريال**.\n\nلكن الأهم.. **كل عام وأنت بخير وعيد مبارك! 🌙✨**`
                        : `**عيدك مبارك! 🎉**\n\nلقد حصلت على عيدية بقيمة:\n**${amount} ريال**\n\nسيتم تحويلها لآيبانك قريباً. كل عام وأنت بخير!`;

                    const resultEmbed = new EmbedBuilder().setColor(getPublicColorByAmount(amount)).setTitle("عيدية الدون 🎁").setDescription(desc).setTimestamp();
                    try { await interaction.editReply({ embeds:[resultEmbed] }); } catch(e){}

                    const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                    if(channel){
                        const logEmbed = new EmbedBuilder().setColor("#f1c40f").setTitle("سجلات عيدية الدون").addFields({ name: "صاحب الطلب", value: `${interaction.user}`, inline: false },{ name: "الآيبان", value: data.iban, inline: false },{ name: "المبلغ", value: `**${amount} ريال**`, inline: false });
                        channel.send({embeds:[logEmbed]});
                    }
                }, 8000);
            }

            if(interaction.customId === "cancel_data"){
                pendingSubmissions.delete(interaction.user.id);
                clickedUsers.delete(interaction.user.id); 
                await interaction.update({ embeds:[new EmbedBuilder().setColor("#7f8c8d").setTitle("تم الإلغاء").setDescription("تم إلغاء طلبك بنجاح. عيدك مبارك!")], components:[] });
            }
        }

        // ================= النماذج (Modals) =================
        if(interaction.isModalSubmit()){
            
            // --- مودل العائلة ---
            if(interaction.customId === "family_modal"){
                const userId = interaction.user.id;
                let iban = interaction.fields.getTextInputValue("input_family_iban").replace(/\s+/g, '');

                if(!/^SA\d{22}$/i.test(iban)){
                    return interaction.reply({ content: "🚫 صيغة الآيبان خاطئة! يجب أن يبدأ بـ SA ويليه 22 رقماً.", ephemeral: true });
                }

                claimedUsers.add(userId);

                const waitingEmbed = new EmbedBuilder().setColor("#2f3136").setTitle("خزنة العائلة").setDescription(`قام الدون بفتح **خزنة العائلة** الآن ويقوم بتسجيل الآيبان الخاص بك.\nانتظر قليلًا بينما يحدد نصيبك.`);
                await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

                setTimeout(async () => {
                    let amount = getEidiya();

                    const resultEmbed = new EmbedBuilder()
                        .setColor(getColorByAmount(amount))
                        .setTitle("عيدية العائلة")
                        .setDescription(`المبلغ:\n**${amount} ريال**\n\nالآيبان المسجل: \`${iban}\``)
                        .setTimestamp();

                    try { await interaction.editReply({ embeds:[resultEmbed] }); } catch(e){}

                    const channel = client.channels.cache.get(LOG_CHANNEL);
                    if(channel){
                        const logEmbed = new EmbedBuilder().setColor("#111111").setTitle("دفتر الدون - العائلة").setDescription(`${interaction.user} استلم عيديته.\nالمبلغ: **${amount} ريال**\nالآيبان: \`${iban}\``);
                        channel.send({embeds:[logEmbed]});
                    }
                }, 8000);
            }

            // --- مودل عيدية الدون ---
            if(interaction.customId === "public_modal"){
                const userId = interaction.user.id;
                const name = interaction.fields.getTextInputValue("input_name").trim();
                const email = interaction.fields.getTextInputValue("input_email").trim();
                const phone = interaction.fields.getTextInputValue("input_phone").replace(/\s+/g, '');
                const iban = interaction.fields.getTextInputValue("input_iban").replace(/\s+/g, '');

                if(!email.includes("@")){
                    clickedUsers.delete(userId); 
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

                if(publicNames.has(name) || publicEmails.has(email) || publicPhones.has(phone) || publicIbans.has(iban)){
                    let strikes = duplicateStrikes.get(userId) || 0;
                    strikes++;
                    duplicateStrikes.set(userId, strikes);

                    if(strikes >= 2){
                        publicBlacklistedUsers.add(userId);
                        return interaction.reply({ content: "🚫 تم حظر حسابك بسبب تكرار إدخال بيانات مسجلة مسبقاً.", ephemeral:true });
                    } else {
                        clickedUsers.delete(userId); 
                        return interaction.reply({ content: "⚠️ تحذير: هذه البيانات مسجلة لشخص آخر. المحاولة القادمة ستؤدي إلى حظرك.", ephemeral:true });
                    }
                }

                pendingSubmissions.set(userId, { name, email, phone, iban });

                const confirmEmbed = new EmbedBuilder()
                    .setColor("#2ecc71")
                    .setTitle("تأكيد بياناتك 📄")
                    .setDescription(`**الآيبان المدخل:**\n\`${iban}\`\n\nهل أنت متأكد من صحة الآيبان لتصلك العيدية؟`);

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("confirm_data").setLabel("نعم، الآيبان صحيح").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("cancel_data").setLabel("إلغاء الطلب").setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
            }
        }
    } catch (error) {
        console.error("حدث خطأ:", error);
    }
});

client.login(TOKEN);
