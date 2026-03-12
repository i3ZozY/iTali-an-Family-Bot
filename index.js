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

// أيديات الرومات
const LOG_CHANNEL = "1481705807560310874";          // روم العائلة
const PUBLIC_LOG_CHANNEL = "1481757344269336807";   // روم العلني (للشارع)

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// --- ذاكرة العائلة ---
const claimedUsers = new Set(); // الكود الأصلي حقك

// --- ذاكرة العيدية العلنية (للتحقق ومنع التكرار) ---
const publicUsers = new Set();
const publicNames = new Set();
const publicEmails = new Set();
const publicPhones = new Set();
const publicIbans = new Set();
const clickedUsers = new Set(); // منع ضغط الزر مرتين
const blacklistedUsers = new Set(); // القائمة السوداء للمافيا
const duplicateStrikes = new Map(); // عداد المحاولات الاحتيالية
const pendingSubmissions = new Map(); // حفظ البيانات المؤقتة لخطوة التأكيد

let totalPublicSpent = 0; // إجمالي ما تم صرفه للشارع (الحد الأقصى 50)

// الدوال الخاصة بالعائلة
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

// الدوال الخاصة بالعلني
function getPublicEidiya(){
    const random = Math.floor(Math.random()*100)+1;
    if(random <= 55) return 0;
    if(random <= 95) return 5;
    return 10;
}
function getPublicColorByAmount(amount){
    if(amount === 0) return "#1c1c1c"; // أسود غامق جداً
    if(amount === 5) return "#7f8c8d"; // رمادي مزرق
    if(amount === 10) return "#2980b9"; // أزرق داكن
}

// استرجاع البيانات من اللوق عند التشغيل
client.once("ready", async () => {
    console.log("الدون جاهز وتم فتح دفتر العائلة.");
    
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
                    if(msg.embeds.length > 0 && msg.embeds[0].fields) {
                        const fields = msg.embeds[0].fields;
                        if(fields.length >= 6) {
                            // استخراج البيانات بناءً على ترتيب الحقول المرسلة للوق
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
            console.log(`تم استرجاع السجلات العلنية بنجاح. وتم رصد العمليات السابقة.`);
        }
    } catch (err) {
        console.error("حدث خطأ أثناء قراءة اللوق:", err);
    }
});

client.on("messageCreate", async message => {
    if(message.author.bot) return;

    if(message.content === "!eid"){
        
        // --- 1. إذا كان الأمر في سيرفر (عيدية العائلة - الكود الأصلي) ---
        if(message.guild){
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId("eidiya_button")
                .setLabel("أبي عيدية")
                .setStyle(ButtonStyle.Success)
            );

            const embed = new EmbedBuilder()
                .setColor("#8B0000") // أحمر قاني للعائلة
                .setTitle("خزنة العائلة 💰")
                .setDescription(`بأمر من **الدون** تم فتح خزنة العائلة اليوم.\n\nقرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.\n\nاضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك بنفسه.\n\nكل عضو يحصل على عيدية واحدة فقط، ويتم تسجيل كل شيء في **دفتر الدون**.`)
                .setImage(VAULT_IMAGE)
                .setFooter({text:"العائلة فوق كل شيء"})
                .setTimestamp();

            return message.channel.send({ embeds:[embed], components:[row] });
        } 
        
        // --- 2. إذا كان الأمر في الخاص DMs (العيدية العلنية) ---
        else {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId("public_button")
                .setLabel("أبي عيدية")
                .setStyle(ButtonStyle.Secondary)
            );

            const embed = new EmbedBuilder()
                .setColor("#2c3e50") // لون كحلي غامق للشارع
                .setTitle("خزنة الدون 💰")
                .setDescription(` العيدية على **الدون**!.\n\nقرر الدون فتح جزء من خزنته لكم.\nالفرصة تأتي مرة واحدة، ومن يحاول العبث أو النصب على الدون، سيجد نفسه في قائمة لا يتمنى دخولها.\n\nاضغط على زر **أبي عيدية** وسجل بياناتك.`)
                .setImage(VAULT_IMAGE)
                .setFooter({text:"الدون يراقبك"})
                .setTimestamp();

            return message.channel.send({ embeds:[embed], components:[row] });
        }
    }
});

client.on("interactionCreate", async interaction => {
    
    // ==========================================
    // أزرار التفاعل
    // ==========================================
    if(interaction.isButton()){
        
        // ================= الكود الأصلي للعائلة =================
        if(interaction.customId === "eidiya_button"){
            const userId = interaction.user.id;
            if(claimedUsers.has(userId)){
                const rejectEmbed = new EmbedBuilder()
                    .setColor("#ff0000")
                    .setTitle("🚫 تم تسجيل اسمك مسبقًا")
                    .setDescription(`اسمك مسجل بالفعل في **دفتر الدون**.\n\nلقد استلمت عيديتك مسبقًا، ولا يمكن طلب عيدية أخرى.\n\nكل ما يحدث هنا يتم تسجيله بدقة.`)
                    .setFooter({text:"دفتر الدون لا ينسى"})
                    .setTimestamp();
                return interaction.reply({ embeds:[rejectEmbed], ephemeral:true });
            }

            claimedUsers.add(userId);
            const waitingEmbed = new EmbedBuilder()
                .setColor("#2f3136")
                .setTitle("خزنة العائلة")
                .setDescription(`قام الدون بفتح **خزنة العائلة** الآن.\n\nينظر في الصناديق ويقرر مقدار العيدية لكل فرد من أفراد العائلة.\n\nانتظر قليلًا بينما يحدد الدون نصيبك.`)
                .setFooter({text:"كل شيء يسجل في دفتر الدون"})
                .setTimestamp();

            await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

            setTimeout(async () => {
                const amount = getEidiya();
                const resultEmbed = new EmbedBuilder()
                    .setColor(getColorByAmount(amount))
                    .setTitle("عيدية العائلة")
                    .setDescription(`بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.\n\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\n\nتم تسجيل هذه العملية رسميًا في **دفتر الدون**.`)
                    .setFooter({text:"العائلة لا تنسى"})
                    .setTimestamp();

                await interaction.editReply({ embeds:[resultEmbed] });

                const channel = client.channels.cache.get(LOG_CHANNEL);
                if(channel){
                    const logEmbed = new EmbedBuilder()
                        .setColor("#111111")
                        .setTitle("دفتر الدون")
                        .setDescription(`${interaction.user} استلم عيديته.\n\nالمبلغ:\n**${amount} ريال**\n\nتم تسجيل العملية في دفتر العائلة.`)
                        .setTimestamp();
                    channel.send({embeds:[logEmbed]});
                }
            },10000);
        }

        // ================= كود العلني (الشارع) =================
        if(interaction.customId === "public_button"){
            const userId = interaction.user.id;

            // 1. التحقق من القائمة السوداء
            if(blacklistedUsers.has(userId)){
                const blacklistEmbed = new EmbedBuilder()
                    .setColor("#000000") // أسود قاتم
                    .setTitle("أنت في القائمة السوداء ☠️")
                    .setDescription(`لقد تجاوزت حدودك وحاولت خداع الدون.\n\nأبواب العائلة مغلقة في وجهك للأبد. لا تحاول مجدداً.`)
                    .setFooter({text:"المافيا لا تغفر"})
                    .setTimestamp();
                return interaction.reply({ embeds:[blacklistEmbed], ephemeral:true });
            }

            // 2. التحقق من ضغط الزر مسبقاً (ضغطة واحدة فقط)
            if(clickedUsers.has(userId)){
                const alreadyClickedEmbed = new EmbedBuilder()
                    .setColor("#e67e22") // برتقالي تحذيري
                    .setTitle("تم استلام بياناتك مسبقاً 📜")
                    .setDescription(`لقد قمت بتقديم بياناتك بالفعل.\n\nالدون لا يقرأ البيانات نفسها مرتين، والفرصة تأتي لشخص واحد فقط.`)
                    .setFooter({text:"البيانات مسجلة بالدم"})
                    .setTimestamp();
                return interaction.reply({ embeds:[alreadyClickedEmbed], ephemeral:true });
            }

            // 3. التحقق من الميزانية 
            if(totalPublicSpent >= 50){
                const closedVaultEmbed = new EmbedBuilder()
                    .setColor("#34495e") // رمادي مائل للظلام
                    .setTitle("الخزنة أُغلقت 🚪")
                    .setDescription(`**الدون قفل الخزنة.**\n\nنفدت العطايا المخصصة لهذا العيد.\nفرصة أخرى في العيد القادم.. إن بقيت حياً.`)
                    .setFooter({text:"المافيا توزع بمقدار"})
                    .setTimestamp();
                return interaction.reply({ embeds:[closedVaultEmbed], ephemeral:true });
            }

            // بمجرد الضغط يُسجل كشخص متفاعل لمنعه من التكرار
            clickedUsers.add(userId);

            // إنشاء النموذج بأسماء واضحة جداً
            const modal = new ModalBuilder()
                .setCustomId("public_modal")
                .setTitle("بياناتك لتسليم عيديتك");

            const nameInput = new TextInputBuilder()
                .setCustomId("input_name")
                .setLabel("الاسم الكامل (الرباعي)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const emailInput = new TextInputBuilder()
                .setCustomId("input_email")
                .setLabel("الإيميل الخاص بك (الذي تستخدمه)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const phoneInput = new TextInputBuilder()
                .setCustomId("input_phone")
                .setLabel("رقم الهاتف الخاص بك (الذي تستخدمه)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const ibanInput = new TextInputBuilder()
                .setCustomId("input_iban")
                .setLabel("الآيبان البنكي الخاص بك (لتحويل المبلغ)")
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

        // ================= زر التأكيد النهائي للعلني =================
        if(interaction.customId === "confirm_data"){
            const userId = interaction.user.id;
            const data = pendingSubmissions.get(userId);
            
            if(!data) {
                return interaction.reply({ content: "انتهت صلاحية جلستك أو حدث خطأ.", ephemeral: true });
            }

            // تحقق أخير من الميزانية قبل الصرف
            if(totalPublicSpent >= 50){
                return interaction.update({ 
                    embeds: [new EmbedBuilder().setColor("#34495e").setTitle("الخزنة أُغلقت 🚪").setDescription("أغلق الدون الخزنة قبل أن تصل بياناتك، الدون لا ينتظر أحد.")],
                    components: [] 
                });
            }

            // حفظ البيانات في ذاكرة البوت لمنع التكرار
            publicUsers.add(userId);
            publicNames.add(data.name);
            publicEmails.add(data.email);
            publicPhones.add(data.phone);
            publicIbans.add(data.iban);
            pendingSubmissions.delete(userId); // مسحها من المؤقت

            const waitingEmbed = new EmbedBuilder()
                .setColor("#555555") // رمادي متوسط
                .setTitle("مراجعة العقد")
                .setDescription(`تم ارسال بياناتك **للدون**.\n\nيتم الآن فحص بياناتك وتحديد نصيبك من الخزنة.. الصبر مطلوب الآن.`)
                .setFooter({text:"القرار لا يُراجع"})
                .setTimestamp();

            await interaction.update({ embeds:[waitingEmbed], components:[] });

            setTimeout(async () => {
                let amount = getPublicEidiya();
                
                if(totalPublicSpent + amount > 50){
                    amount = 50 - totalPublicSpent; 
                }
                totalPublicSpent += amount;

                let desc = "";
                if(amount === 0){
                    desc = `نفث الدون دخان سيجاره وقرر أنك لا تستحق شيئاً.\n\nالمبلغ: **0 ريال**\n\nاعتبر بقاءك آمناً هو أعظم عيدية.`;
                } else {
                    desc = `أومأ الدون برأسه ووافق على مكافأتك.\n\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\n\nسيتم تحويلها لآيبانك. تم إغلاق ملفك.`;
                }

                const resultEmbed = new EmbedBuilder()
                    .setColor(getPublicColorByAmount(amount))
                    .setTitle("قرار الدون")
                    .setDescription(desc)
                    .setFooter({text:"انتهت المعاملة."})
                    .setTimestamp();

                await interaction.editReply({ embeds:[resultEmbed] });

                // إرسال اللوق
                const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
                if(channel){
                    const logEmbed = new EmbedBuilder()
                        .setColor("#050505") // أسود للوق
                        .setTitle("سجلات العيدية الموثقة")
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

        // ================= زر إلغاء الطلب للعلني =================
        if(interaction.customId === "cancel_data"){
            pendingSubmissions.delete(interaction.user.id);
            // إزالة حظر الضغطة بما أنه ألغى بنفسه ولم يكمل
            clickedUsers.delete(interaction.user.id); 

            const cancelEmbed = new EmbedBuilder()
                .setColor("#7f8c8d")
                .setTitle("تم سحب الطلب")
                .setDescription("تراجعت عن عيديتك واحتفظت ببياناتك. خيار حكيم إذا لم تكن مستعداً للتعامل مع العائلة.")
                .setTimestamp();
            await interaction.update({ embeds:[cancelEmbed], components:[] });
        }
    }

    // ==========================================
    // معالجة المودل (النموذج العلني)
    // ==========================================
    if(interaction.isModalSubmit()){
        if(interaction.customId === "public_modal"){
            const userId = interaction.user.id;
            const name = interaction.fields.getTextInputValue("input_name").trim();
            const email = interaction.fields.getTextInputValue("input_email").trim();
            const phone = interaction.fields.getTextInputValue("input_phone").trim();
            const iban = interaction.fields.getTextInputValue("input_iban").trim();

            // نظام كشف الغش والتكرار
            if(publicNames.has(name) || publicEmails.has(email) || publicPhones.has(phone) || publicIbans.has(iban)){
                let strikes = duplicateStrikes.get(userId) || 0;
                strikes++;
                duplicateStrikes.set(userId, strikes);

                if(strikes >= 2){
                    blacklistedUsers.add(userId);
                    const banEmbed = new EmbedBuilder()
                        .setColor("#8b0000") // أحمر دموي للحظر
                        .setTitle("القائمة السوداء 🩸")
                        .setDescription(`لقد نفد صبر الدون.\n\nحاولت التحايل على الدون ببيانات مسجلة مسبقاً أكثر من مرة. تم إدراجك في **القائمة السوداء** نهائياً ولن تُقبل لك أي طلبات.`)
                        .setFooter({text:"الخيانة لا تُغتفر"})
                        .setTimestamp();
                    return interaction.reply({ embeds:[banEmbed], ephemeral:true });
                } else {
                    const warnEmbed = new EmbedBuilder()
                        .setColor("#e74c3c") // أحمر تحذيري
                        .setTitle("تحذير أخير من الدون ⚠️")
                        .setDescription(`هل تعتقد أن الدون يغفل عن شيء؟\n\nلقد رصدنا أن بياناتك (الاسم، أو الإيميل، أو الرقم، أو الآيبان) مسجلة لشخص آخر.\n\nهذا هو **التحذير الأول والأخير**. محاولة إدخال بيانات مكررة مرة أخرى تعني دخولك للقائمة السوداء.`)
                        .setFooter({text:"تراجع قبل فوات الأوان"})
                        .setTimestamp();
                    return interaction.reply({ embeds:[warnEmbed], ephemeral:true });
                }
            }

            // إذا البيانات سليمة، نعطيه فرصة يأكد الآيبان
            pendingSubmissions.set(userId, { name, email, phone, iban });

            const confirmEmbed = new EmbedBuilder()
                .setColor("#f39c12") // أصفر برتقالي للتنبيه
                .setTitle("تأكيد بياناتك 📄")
                .setDescription(`اقرأ بتمعن قبل أن يختم الدون على بياناتك:\n\n**الآيبان المدخل:**\n\`${iban}\`\n\nهل أنت متأكد من هذا الآيبان؟\n**إذا كان الآيبان خاطئاً، لن يتم تحويل المبلغ ولن تُعطى فرصة ثانية.**`)
                .setFooter({text:"المافيا لا تصحح أخطاء الآخرين"})
                .setTimestamp();

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("confirm_data")
                    .setLabel("نعم، الآيبان صحيح")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("cancel_data")
                    .setLabel("إلغاء الطلب")
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.reply({ embeds:[confirmEmbed], components:[confirmRow], ephemeral:true });
        }
    }
});

client.login(TOKEN);

