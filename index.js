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
    console.log("الدون جاهز... والسيجار مشتعل. عيد فطر مبارك.");
});

client.on("messageCreate", async message => {
    if(message.author.bot) return;

    if(message.guild && message.guild.id !== TARGET_GUILD_ID) return;

    const args = message.content.split(" ");
    const command = args[0].toLowerCase();

    // ================= أوامر الإدارة (للدون فقط) =================
    if (ADMIN_IDS.includes(message.author.id)) {
        
        if (command === "!eid_public_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            publicBlacklistedUsers.add(targetId);
            return message.reply(`تم وضع ${targetId} في القائمة السوداء. المافيا لا ترحم.`);
        }

        if (command === "!eid_public_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            publicBlacklistedUsers.delete(targetId);
            duplicateStrikes.delete(targetId);
            return message.reply(`تم العفو عن ${targetId}. فليشكر الدون على هذه الفرصة.`);
        }

        if (command === "!eid_family_block" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            familyBlacklistedUsers.add(targetId);
            return message.reply(`تم طرد ${targetId} من العائلة. الخيانة ثمنها غالي.`);
        }

        if (command === "!eid_family_unblock" && args[1]) {
            const targetId = args[1].replace(/[<@!>]/g, '');
            familyBlacklistedUsers.delete(targetId);
            return message.reply(`عاد ${targetId} لصفوف العائلة بأمر من الدون.`);
        }

        if (command === "!eid_public_reset") {
            publicUsers.clear();
            publicNames.clear();
            publicEmails.clear();
            publicPhones.clear();
            publicIbans.clear();
            clickedUsers.clear();
            duplicateStrikes.clear();
            totalPublicSpent = 0;
            return message.reply("تم تصفير ميزانية عيدية الدون (50 ريال). السجلات نُظفت بالدم.");
        }

        if (command === "!eid_family_reset") {
            claimedUsers.clear();
            return message.reply("تم مسح دفاتر العائلة. الخزنة مفتوحة بلا حدود من جديد.");
        }
    }

    if (command === "!help") {
        const helpEmbed = new EmbedBuilder()
            .setColor("#2c3e50")
            .setTitle("📜 أوامر نظام المافيا")
            .setDescription("إليك الأوامر المتاحة في أروقة الدون:")
            .addFields({ name: "أوامر عامة:", value: "`!eid` - طلب العيدية (في الخاص للشارع، وفي السيرفر للعائلة فقط)." })
            .setThumbnail(client.user.displayAvatarURL());

        if (ADMIN_IDS.includes(message.author.id)) {
            helpEmbed.addFields(
                { name: "🛡️ إدارة عيدية الدون (الشارع):", value: "`!eid_public_block <id>`\n`!eid_public_unblock <id>`\n`!eid_public_reset`" },
                { name: "🩸 إدارة عيدية العائلة:", value: "`!eid_family_block <id>`\n`!eid_family_unblock <id>`\n`!eid_family_reset`" }
            );
        }
        helpEmbed.setFooter({ text: "الدون يراقب كل شيء.. عيد فطر مبارك." }).setTimestamp();
        return message.reply({ embeds: [helpEmbed] });
    }

    if(command === "!eid"){
        const userId = message.author.id;

        if(cooldowns.has(userId)){
            const expiry = cooldowns.get(userId) + 30000;
            if(Date.now() < expiry){
                const left = ((expiry - Date.now()) / 1000).toFixed(1);
                return message.reply(`تأنَّ قليلاً. الدون لا يحب الإزعاج. انتظر ${left} ثانية.`).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
            }
        }
        cooldowns.set(userId, Date.now());

        try {
            // --- 1. سيرفر العائلة ---
            if(message.guild){
                const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.guild.ownerId === message.author.id;
                
                if(!isAdmin){
                    return message.reply("🚫 هذا الأمر لزعماء العائلة فقط. إذا أردت عيدية الدون، اذهب إلى الخاص واكتب `!eid`.");
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("eidiya_family_button").setLabel("أبي عيدية").setStyle(ButtonStyle.Success)
                );

                const embed = new EmbedBuilder()
                    .setColor("#8B0000") 
                    .setTitle("خزنة العائلة 💰")
                    .setDescription(`بمناسبة حلول عيد الفطر المبارك، أمر **الدون** بفتح الخزنة للعائلة.\n\nالولاء يُكافأ هنا. اضغط على الزر وضع الآيبان الخاص بك.\n\n*وكل عام وأنتم السند الحقيقي للدون.*`)
                    .setImage(VAULT_IMAGE)
                    .setFooter({text:"العائلة فوق كل شيء"})
                    .setTimestamp();

                return message.channel.send({ embeds:[embed], components:[row] });
            } 
            
            // --- 2. الخاص (عيدية الدون) ---
            else {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("public_button").setLabel("عيدية الدون").setStyle(ButtonStyle.Primary) // الزر باللون الأزرق
                );

                const embed = new EmbedBuilder()
                    .setColor("#2c3e50") 
                    .setTitle("خزنة الدون 💼")
                    .setDescription(`**بمناسبة عيد الفطر المبارك، يهنئكم الدون..**\n\nولكن تذكر: قوانين المافيا لا تتغير.\nقرر الدون فتح جزء من خزنته (50 ريالاً فقط) تُوزع على من يستحق.\n\nالفرصة تأتي مرة واحدة. إياك والعبث أو التلاعب بالبيانات، فالقائمة السوداء تنتظر.\n\nاضغط على الزر أدناه وسجل بياناتك.`)
                    .setImage(VAULT_IMAGE)
                    .setFooter({text:"المافيا لا تغفر الأخطاء. عيد مبارك."})
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
            
            if(interaction.customId === "eidiya_family_button"){
                const userId = interaction.user.id;
                if(familyBlacklistedUsers.has(userId)) return interaction.reply({ content: "☠️ لقد تم طردك من العائلة. لا عيدية لك.", ephemeral: true });
                if(claimedUsers.has(userId)) return interaction.reply({ embeds:[new EmbedBuilder().setColor("#ff0000").setTitle("🚫 دفتر الدون لا ينسى").setDescription(`استلمت نصيبك مسبقاً. الطمع يدمر الرجال.`)], ephemeral:true });

                const modal = new ModalBuilder().setCustomId("family_modal").setTitle("توقيع العائلة");
                const ibanInput = new TextInputBuilder().setCustomId("input_family_iban").setLabel("الآيبان البنكي (SA + 22 رقم)").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(ibanInput));
                await interaction.showModal(modal);
            }

            if(interaction.customId === "public_button"){
                const userId = interaction.user.id;
                if(publicBlacklistedUsers.has(userId)) return interaction.reply({ embeds:[new EmbedBuilder().setColor("#000000").setTitle("القائمة السوداء ☠️").setDescription(`مكانك في الظلام. المافيا أغلقت أبوابها في وجهك.`)], ephemeral:true });
                if(clickedUsers.has(userId)) return interaction.reply({ content: "📜 بياناتك قيد المراجعة أو تم استلامها. الدون لا ينظر للورقة مرتين.", ephemeral: true });
                if(totalPublicSpent >= 50) return interaction.reply({ content: "🚪 أُغلقت الخزنة. نفدت عطايا الدون لهذا العيد. كل عام وأنت بخير.", ephemeral: true });

                clickedUsers.add(userId);

                const modal = new ModalBuilder().setCustomId("public_modal").setTitle("عقد الدون 📜");
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

            // --- زر تعديل البيانات ---
            if(interaction.customId === "edit_data"){
                const userId = interaction.user.id;
                const data = pendingSubmissions.get(userId);
                
                if(!data) return interaction.reply({ content: "انتهت صلاحية الوثيقة. أعد الطلب من البداية.", ephemeral: true });

                const modal = new ModalBuilder().setCustomId("public_modal").setTitle("تعديل البيانات 📝");
                const nameInput = new TextInputBuilder().setCustomId("input_name").setLabel("الاسم الكامل (الرباعي)").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.name);
                const emailInput = new TextInputBuilder().setCustomId("input_email").setLabel("الإيميل").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.email);
                const phoneInput = new TextInputBuilder().setCustomId("input_phone").setLabel("الهاتف").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.phone);
                const ibanInput = new TextInputBuilder().setCustomId("input_iban").setLabel("الآيبان").setStyle(TextInputStyle.Short).setRequired(true).setValue(data.iban);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(emailInput),
                    new ActionRowBuilder().addComponents(phoneInput),
                    new ActionRowBuilder().addComponents(ibanInput)
                );

                await interaction.showModal(modal);
            }

            // --- زر التأكيد ---
            if(interaction.customId === "confirm_data"){
                const userId = interaction.user.id;
                const data = pendingSubmissions.get(userId);
                
                if(!data) return interaction.reply({ content: "الوثيقة اختفت. حاول مجدداً.", ephemeral: true });
                if(totalPublicSpent >= 50) return interaction.update({ embeds: [new EmbedBuilder().setColor("#34495e").setTitle("الخزنة أُغلقت 🚪").setDescription("عذراً، أغلق الدون الخزنة. عيد فطر مبارك.")], components: [] });

                publicUsers.add(userId);
                publicNames.add(data.name);
                publicEmails.add(data.email);
                publicPhones.add(data.phone);
                publicIbans.add(data.iban);
                pendingSubmissions.delete(userId); 

                const waitingEmbed = new EmbedBuilder().setColor("#555555").setTitle("مراجعة القرار ⏳").setDescription(`ورقتك الآن بين يدي **الدون**.\nيتم اتخاذ القرار النهائي.. الهدوء مطلوب.`);
                await interaction.update({ embeds:[waitingEmbed], components:[] });

                setTimeout(async () => {
                    let amount = getPublicEidiya();
                    if(totalPublicSpent + amount > 50) amount = 50 - totalPublicSpent; 
                    totalPublicSpent += amount;

                    let desc = amount === 0 
                        ? `نفث الدون دخان سيجاره وقرر أنك لا تستحق شيئاً.\n\nالمبلغ: **0 ريال**\nاعتبر بقاءك آمناً هو أعظم عيدية. كل عام وأنت بخير.`
                        : `أومأ الدون برأسه، قرارٌ حكيم.\n\nالمبلغ:\n**${amount} ريال**\nسيتم التحويل لآيبانك. عيد فطر مبارك.`;

                    const resultEmbed = new EmbedBuilder().setColor(getPublicColorByAmount(amount)).setTitle("القرار النهائي ⚖️").setDescription(desc).setTimestamp();
                    try { await interaction.editReply({ embeds:[resultEmbed] }); } catch(e){}

                    const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                    if(channel){
                        const logEmbed = new EmbedBuilder().setColor("#1c1c1c").setTitle("سجلات عيدية الدون").addFields({ name: "صاحب الطلب", value: `${interaction.user}`, inline: false },{ name: "الآيبان", value: data.iban, inline: false },{ name: "المبلغ", value: `**${amount} ريال**`, inline: false });
                        channel.send({embeds:[logEmbed]});
                    }
                }, 8000);
            }

            if(interaction.customId === "cancel_data"){
                pendingSubmissions.delete(interaction.user.id);
                clickedUsers.delete(interaction.user.id); 
                await interaction.update({ embeds:[new EmbedBuilder().setColor("#7f8c8d").setTitle("تم التراجع").setDescription("انسحبت بهدوء. قرار قد يحفظ حياتك.")], components:[] });
            }
        }

        if(interaction.isModalSubmit()){
            if(interaction.customId === "family_modal"){
                const userId = interaction.user.id;
                let iban = interaction.fields.getTextInputValue("input_family_iban").replace(/\s+/g, '');

                if(!/^SA\d{22}$/i.test(iban)) return interaction.reply({ content: "🚫 صيغة الآيبان خاطئة! يجب أن يبدأ بـ SA ويليه 22 رقماً.", ephemeral: true });

                claimedUsers.add(userId);

                const waitingEmbed = new EmbedBuilder().setColor("#2f3136").setTitle("خزنة العائلة").setDescription(`الدون يسجل اسمك في دفتر العائلة.. انتظر قرار التوزيع.`);
                await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

                setTimeout(async () => {
                    let amount = getEidiya();
                    const resultEmbed = new EmbedBuilder().setColor(getColorByAmount(amount)).setTitle("عيدية العائلة").setDescription(`المبلغ:\n**${amount} ريال**\n\nالآيبان المسجل: \`${iban}\`\n*عيد فطر سعيد يا ابن العائلة.*`).setTimestamp();
                    try { await interaction.editReply({ embeds:[resultEmbed] }); } catch(e){}

                    const channel = client.channels.cache.get(LOG_CHANNEL);
                    if(channel) channel.send({embeds:[new EmbedBuilder().setColor("#111111").setTitle("دفتر الدون - العائلة").setDescription(`${interaction.user} استلم عيديته.\nالمبلغ: **${amount} ريال**\nالآيبان: \`${iban}\``)]});
                }, 8000);
            }

            if(interaction.customId === "public_modal"){
                const userId = interaction.user.id;
                const name = interaction.fields.getTextInputValue("input_name").trim();
                const email = interaction.fields.getTextInputValue("input_email").trim();
                const phone = interaction.fields.getTextInputValue("input_phone").replace(/\s+/g, '');
                const iban = interaction.fields.getTextInputValue("input_iban").replace(/\s+/g, '');

                if(!email.includes("@")){
                    clickedUsers.delete(userId); 
                    return interaction.reply({ content: "🚫 الإيميل غير صحيح. المافيا تحتاج عنواناً دقيقاً.", ephemeral: true });
                }
                if(!/^\d{10}$/.test(phone)){
                    clickedUsers.delete(userId);
                    return interaction.reply({ content: "🚫 رقم الهاتف يجب أن يكون 10 أرقام بالضبط.", ephemeral: true });
                }
                if(!/^SA\d{22}$/i.test(iban)){
                    clickedUsers.delete(userId);
                    return interaction.reply({ content: "🚫 الآيبان خاطئ! يجب أن يبدأ بـ SA متبوعاً بـ 22 رقماً.", ephemeral: true });
                }

                // تجنب احتساب ضربة غش إذا كان المستخدم يعدل بياناته ولم يغيرها
                const isEditingOwnData = pendingSubmissions.has(userId) && 
                    pendingSubmissions.get(userId).iban === iban && 
                    pendingSubmissions.get(userId).email === email;

                if(!isEditingOwnData && (publicNames.has(name) || publicEmails.has(email) || publicPhones.has(phone) || publicIbans.has(iban))){
                    let strikes = duplicateStrikes.get(userId) || 0;
                    strikes++;
                    duplicateStrikes.set(userId, strikes);

                    if(strikes >= 2){
                        publicBlacklistedUsers.add(userId);
                        return interaction.reply({ content: "🩸 لقد غضب الدون. تم رميك في القائمة السوداء.", ephemeral:true });
                    } else {
                        clickedUsers.delete(userId); 
                        return interaction.reply({ content: "⚠️ تحذير المافيا الأول: هذه البيانات مستخدمة مسبقاً. المحاولة القادمة ثمنها غالٍ.", ephemeral:true });
                    }
                }

                pendingSubmissions.set(userId, { name, email, phone, iban });

                const confirmEmbed = new EmbedBuilder()
                    .setColor("#f39c12")
                    .setTitle("وثيقة الدون 📄")
                    .setDescription(`اقرأ بتمعن قبل الختم:\n\n**الآيبان المدخل:**\n\`${iban}\`\n\nهل المعلومات صحيحة؟ الدون لا يصحح أخطاء الآخرين.`);

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("confirm_data").setLabel("نعم، الختم نهائي").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("edit_data").setLabel("تعديل البيانات").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("cancel_data").setLabel("تمزيق الوثيقة").setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
            }
        }
    } catch (error) {
        console.error("حدث خطأ:", error);
    }
});

client.login(TOKEN);
