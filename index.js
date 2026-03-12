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

// أيديات الرومات
const FAMILY_LOG_CHANNEL = "1481705807560310874";
const PUBLIC_LOG_CHANNEL = "1481757344269336807";

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// --- ذاكرة العائلة ---
const claimedFamilyUsers = new Set();

// --- ذاكرة العيدية العلنية (للتحقق من التكرار) ---
const publicNames = new Set();
const publicEmails = new Set();
const publicPhones = new Set();
const publicIbans = new Set();

// --- ميزانية العيدية العلنية ---
let publicVaultBalance = 50; // الحد المسموح 50 ريال

// دالة حساب عيدية العائلة
function getFamilyEidiya(){
    const random = Math.floor(Math.random() * 100) + 1;
    if(random <= 70) return 5;
    if(random <= 85) return 10;
    if(random <= 95) return 20;
    return 50;
}

// دالة حساب العيدية العلنية
function getPublicEidiya(){
    const random = Math.floor(Math.random() * 100) + 1;
    if(random <= 55) return 0;  // 55%
    if(random <= 95) return 5;  // 40%
    return 10;                  // 5%
}

function getColorByAmount(amount){
    if(amount === 0) return "#2b2b2b";
    if(amount === 5) return "#6e6e6e";
    if(amount === 10) return "#3498db";
    if(amount === 20) return "#9b59b6";
    if(amount === 50) return "#d4af37";
}

client.once("ready", () => {
    console.log("الدون جاهز، تم فتح دفتر العائلة والسجلات العلنية.");
});

// التعامل مع الأوامر
client.on("messageCreate", async message => {
    if(message.author.bot) return;

    // --- أمر العائلة ---
    if(message.content === "!eid"){
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("family_btn")
                .setLabel("أبي عيدية")
                .setStyle(ButtonStyle.Success)
        );

        const embed = new EmbedBuilder()
            .setColor("#8B0000")
            .setTitle("خزنة العائلة 💰")
            .setDescription(`بأمر من **الدون** تم فتح خزنة العائلة اليوم.\n\nقرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.\n\nاضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك بنفسه.\n\nكل عضو يحصل على عيدية واحدة فقط، ويتم تسجيل كل شيء في **دفتر الدون**.`)
            .setImage(VAULT_IMAGE)
            .setFooter({text:"العائلة فوق كل شيء"})
            .setTimestamp();

        message.channel.send({ embeds:[embed], components:[row] });
    }

    // --- الأمر العلني للجميع ---
    if(message.content === "!public_eid"){
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("public_btn")
                .setLabel("أبي عيدية")
                .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
            .setColor("#2c3e50")
            .setTitle("عطايا الكابو 🕴️")
            .setDescription(`سمع **الدون** بولائكم في الشوارع، وقرر فتح جزء صغير من خزنته للعامة.\n\nالفرصة تأتي مرة واحدة، والموارد محدودة.\n\nاضغط على الزر بالأسفل لتقديم **عقد الولاء** وطلب نصيبك من الشارع.\n\n**تحذير:** من يحاول خداع العائلة ببيانات مكررة، سيتم وضعه في القائمة السوداء.`)
            .setImage(VAULT_IMAGE)
            .setFooter({text:"عيون العائلة في كل مكان"})
            .setTimestamp();

        message.channel.send({ embeds:[embed], components:[row] });
    }
});

// التعامل مع الأزرار والنماذج (Modals)
client.on("interactionCreate", async interaction => {
    
    // ==========================================
    // 1. التعامل مع الأزرار
    // ==========================================
    if(interaction.isButton()){
        
        // --- زر العائلة ---
        if(interaction.customId === "family_btn"){
            const userId = interaction.user.id;

            if(claimedFamilyUsers.has(userId)){
                const rejectEmbed = new EmbedBuilder()
                    .setColor("#ff0000")
                    .setTitle("🚫 تم تسجيل اسمك مسبقًا")
                    .setDescription(`اسمك مسجل بالفعل في **دفتر الدون**.\n\nلقد استلمت عيديتك مسبقًا، ولا يمكن طلب عيدية أخرى.\n\nكل ما يحدث هنا يتم تسجيله بدقة.`)
                    .setFooter({text:"دفتر الدون لا ينسى"})
                    .setTimestamp();
                return interaction.reply({ embeds:[rejectEmbed], ephemeral:true });
            }

            claimedFamilyUsers.add(userId);

            const waitingEmbed = new EmbedBuilder()
                .setColor("#2f3136")
                .setTitle("خزنة العائلة")
                .setDescription(`قام الدون بفتح **خزنة العائلة** الآن.\n\nينظر في الصناديق ويقرر مقدار العيدية لكل فرد من أفراد العائلة.\n\nانتظر قليلًا بينما يحدد الدون نصيبك.`)
                .setFooter({text:"كل شيء يسجل في دفتر الدون"})
                .setTimestamp();

            await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

            setTimeout(async () => {
                const amount = getFamilyEidiya();
                const resultEmbed = new EmbedBuilder()
                    .setColor(getColorByAmount(amount))
                    .setTitle("عيدية العائلة")
                    .setDescription(`بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.\n\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\n\nتم تسجيل هذه العملية رسميًا في **دفتر الدون**.`)
                    .setFooter({text:"العائلة لا تنسى"})
                    .setTimestamp();

                await interaction.editReply({ embeds:[resultEmbed] });

                const channel = client.channels.cache.get(FAMILY_LOG_CHANNEL);
                if(channel){
                    const logEmbed = new EmbedBuilder()
                        .setColor("#111111")
                        .setTitle("دفتر الدون (داخلي)")
                        .setDescription(`${interaction.user} استلم عيديته.\n\nالمبلغ: **${amount} ريال**\n\nتم تسجيل العملية في دفتر العائلة.`)
                        .setTimestamp();
                    channel.send({embeds:[logEmbed]});
                }
            }, 10000);
        }

        // --- زر العلني ---
        if(interaction.customId === "public_btn"){
            
            // التحقق من الميزانية قبل فتح المودل
            if(publicVaultBalance <= 0){
                const closedVaultEmbed = new EmbedBuilder()
                    .setColor("#000000")
                    .setTitle("خزنة الشارع أُغلقت 🚪")
                    .setDescription(`**الدون قفل الخزنة.**\n\nنفذت الموارد المخصصة للشارع هذا اليوم.\nحظاً أوفر، فرصة أخرى في العيد القادم إذا بقيت على قيد الحياة.`)
                    .setFooter({text:"المافيا لا تعطي وعوداً"})
                    .setTimestamp();
                return interaction.reply({ embeds:[closedVaultEmbed], ephemeral:true });
            }

            // إنشاء نموذج (Modal) لجمع البيانات
            const modal = new ModalBuilder()
                .setCustomId("public_modal")
                .setTitle("عقد الولاء للدون");

            const nameInput = new TextInputBuilder()
                .setCustomId("input_name")
                .setLabel("الاسم الرباعي")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const emailInput = new TextInputBuilder()
                .setCustomId("input_email")
                .setLabel("البريد الإلكتروني")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const phoneInput = new TextInputBuilder()
                .setCustomId("input_phone")
                .setLabel("رقم الهاتف")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const ibanInput = new TextInputBuilder()
                .setCustomId("input_iban")
                .setLabel("رقم الآيبان (IBAN)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(emailInput),
                new ActionRowBuilder().addComponents(phoneInput),
                new ActionRowBuilder().addComponents(ibanInput)
            );

            await interaction.showModal(modal);
        }
    }

    // ==========================================
    // 2. التعامل مع النماذج (Modals)
    // ==========================================
    if(interaction.isModalSubmit()){
        if(interaction.customId === "public_modal"){
            
            const name = interaction.fields.getTextInputValue("input_name").trim();
            const email = interaction.fields.getTextInputValue("input_email").trim();
            const phone = interaction.fields.getTextInputValue("input_phone").trim();
            const iban = interaction.fields.getTextInputValue("input_iban").trim();

            // التحقق من التكرار في أي من البيانات
            if(publicNames.has(name) || publicEmails.has(email) || publicPhones.has(phone) || publicIbans.has(iban)){
                const fakeEmbed = new EmbedBuilder()
                    .setColor("#8B0000")
                    .setTitle("محاولة خداع العائلة 🩸")
                    .setDescription(`هل تعتقد أن الدون أحمق؟\n\nلقد وجدنا بيانات متطابقة (اسم، إيميل، رقم، أو آيبان) مسجلة مسبقاً في سجلاتنا.\n\n**تم رفض طلبك**، العيدية لشخص واحد، ومحاولة التلاعب عقوبتها وخيمة في عالمنا.`)
                    .setFooter({text:"المافيا ترى كل شيء"})
                    .setTimestamp();
                return interaction.reply({ embeds:[fakeEmbed], ephemeral:true });
            }

            // إضافة البيانات للذاكرة لمنع التكرار
            publicNames.add(name);
            publicEmails.add(email);
            publicPhones.add(phone);
            publicIbans.add(iban);

            // رسالة الانتظار
            const waitingEmbed = new EmbedBuilder()
                .setColor("#2f3136")
                .setTitle("مراجعة العقد")
                .setDescription(`رجالك المخلصين يسلمون عقدك إلى **الدون**.\n\nيتم الآن فحص ولائك وتحديد نصيبك من خزنة الشارع...`)
                .setFooter({text:"لا مجال للتراجع الآن"})
                .setTimestamp();

            await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

            setTimeout(async () => {
                let amount = getPublicEidiya();

                // التحقق النهائي من الميزانية (عشان ما يتعدى 50 ريال)
                if(amount > publicVaultBalance){
                    amount = publicVaultBalance; // يعطيه الباقي فقط
                }
                
                publicVaultBalance -= amount; // خصم المبلغ من الخزنة

                let desc = "";
                if(amount === 0){
                    desc = `نظر الدون في أوراقك، وقرر أنك لا تستحق شيئاً في الوقت الحالي.\n\nالمبلغ: **0 ريال**\n\nاعتبر بقاءك سليماً هو عيديتك.`;
                } else {
                    desc = `ابتسم الدون وقرر مكافأتك.\n\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\n\nسيتم تحويلها لآيبانك قريباً.`;
                }

                const resultEmbed = new EmbedBuilder()
                    .setColor(getColorByAmount(amount))
                    .setTitle("قرار الكابو")
                    .setDescription(desc)
                    .setFooter({text:`المتبقي في الخزنة العامة: ${publicVaultBalance} ريال`})
                    .setTimestamp();

                await interaction.editReply({ embeds:[resultEmbed] });

                // إرسال اللوق لروم الإدارة
                const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                if(channel){
                    const logEmbed = new EmbedBuilder()
                        .setColor("#111111")
                        .setTitle("سجلات الشارع (لوق العلني)")
                        .addFields(
                            { name: "صاحب الطلب", value: `${interaction.user} (${interaction.user.id})`, inline: false },
                            { name: "الاسم", value: name, inline: true },
                            { name: "الإيميل", value: email, inline: true },
                            { name: "الرقم", value: phone, inline: true },
                            { name: "الآيبان", value: iban, inline: false },
                            { name: "المبلغ المستلم", value: `**${amount} ريال**`, inline: false }
                        )
                        .setFooter({text:`الرصيد المتبقي للخزنة: ${publicVaultBalance} ريال`})
                        .setTimestamp();
                    
                    channel.send({embeds:[logEmbed]});
                }

            }, 8000); // 8 ثواني انتظار لإعطاء جو المافيا
        }
    }
});

client.login(TOKEN);
