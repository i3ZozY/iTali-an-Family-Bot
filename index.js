const express = require("express");
const app = express();

// سيرفر بسيط لمنع نوم الاستضافة
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(3000, () => console.log("Keep alive server started"));

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
    GatewayIntentBits.MessageContent
  ]
});

// التوكن من environment variable
const TOKEN = process.env.TOKEN;

// روم Log للعائلية
const LOG_CHANNEL_FAMILY = "1481705807560310874";

// روم Log للعلنية
const LOG_CHANNEL_PUBLIC = "1481757344269336807";

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// ========================
// بيانات النسخة العلنية
// ========================
const claimedUsersPublic = new Set();
const MAX_PUBLIC_CLAIMS = 50;
const submittedData = new Set(); // للتأكد من عدم تكرار الاسم/جوال/ايميل/ايبان

function getPublicEidiya() {
  const random = Math.floor(Math.random() * 100) + 1;
  if (random <= 55) return 0;
  if (random <= 95) return 5;
  return 10;
}

function getColorByAmount(amount) {
  if(amount === 0) return "#2f3136";
  if(amount === 5) return "#8B0000";
  if(amount === 10) return "#d4af37";
}

// ========================
// النسخة العائلية كما هي
// ========================
const claimedUsersFamily = new Set();

function getFamilyEidiya() {
  const random = Math.floor(Math.random()*100)+1;
  if(random <= 70) return 5;
  if(random <= 85) return 10;
  if(random <= 95) return 20;
  return 50;
}

function getFamilyColor(amount) {
  if(amount === 5) return "#6e6e6e";
  if(amount === 10) return "#3498db";
  if(amount === 20) return "#9b59b6";
  if(amount === 50) return "#d4af37";
}

// ========================
// البوت جاهز
// ========================
client.once("ready", () => {
  console.log("🤵‍♂️ الدون جاهز. كل شيء تحت المراقبة.");
});

// ========================
// التعامل مع الأزرار والـ Modal
// ========================
client.on("interactionCreate", async interaction => {

  // ======= النسخة العائلية =======
  if(interaction.isButton() && interaction.customId === "eidiya_button") {
    const userId = interaction.user.id;

    if(claimedUsersFamily.has(userId)) {
      return interaction.reply({ 
        content: "🚫 اسمك مسجل بالفعل في دفتر الدون. لا يمكن طلب عيدية ثانية.", 
        ephemeral:true 
      });
    }

    claimedUsersFamily.add(userId);

    const waitingEmbed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("💰 خزنة العائلة")
      .setDescription(`الدون يفتش الخزنة بعناية ويقرر نصيبك من العيدية. انتظر 10 ثوانٍ...`)
      .setFooter({ text: "العائلة لا تنسى أحداً" })
      .setTimestamp();

    await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

    setTimeout(async () => {
      const amount = getFamilyEidiya();

      const resultEmbed = new EmbedBuilder()
        .setColor(getFamilyColor(amount))
        .setTitle("💰 عيدية العائلة")
        .setDescription(`تم تحديد عيديتك من قبل الدون:

**${amount} ريال**

كل شيء مسجل في دفتر الدون.`)
        .setFooter({ text: "الدون يرى كل شيء" })
        .setTimestamp();

      await interaction.editReply({ embeds:[resultEmbed] });

      const logChannel = client.channels.cache.get(LOG_CHANNEL_FAMILY);
      if(logChannel){
        const logEmbed = new EmbedBuilder()
          .setColor("#111111")
          .setTitle("📜 دفتر الدون")
          .setDescription(`${interaction.user} استلم عيديته. المبلغ: **${amount} ريال**`)
          .setTimestamp();
        logChannel.send({ embeds:[logEmbed] });
      }

    },10000);
  }

  // ======= النسخة العلنية مع Modal =======
  if(interaction.isButton() && interaction.customId === "public_eidiya") {

    const userId = interaction.user.id;

    if(claimedUsersPublic.size >= MAX_PUBLIC_CLAIMS) {
      return interaction.reply({ content: "⛔ خزنة العيديات أغلقت. تم الوصول للحد الأقصى.", ephemeral:true });
    }

    if(claimedUsersPublic.has(userId)) {
      return interaction.reply({ content: "🚫 تم تسجيل طلبك مسبقًا. لا يمكن تكرار المحاولة!", ephemeral:true });
    }

    claimedUsersPublic.add(userId);

    // إنشاء Modal لجمع البيانات
    const modal = new ModalBuilder()
      .setCustomId("public_eidiya_modal")
      .setTitle("طلب عيدية العائلة العلنية");

    const nameInput = new TextInputBuilder()
      .setCustomId("user_name")
      .setLabel("اكتب اسمك الرباعي أو الثلاثي")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const phoneInput = new TextInputBuilder()
      .setCustomId("user_phone")
      .setLabel("اكتب رقم جوالك الخاص")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(15);

    const emailInput = new TextInputBuilder()
      .setCustomId("user_email")
      .setLabel("ايميلك الخاص")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const ibanInput = new TextInputBuilder()
      .setCustomId("user_iban")
      .setLabel("رقم الايبان الخاص بك (تأكد منه قبل الإرسال!)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const row1 = new ActionRowBuilder().addComponents(nameInput);
    const row2 = new ActionRowBuilder().addComponents(phoneInput);
    const row3 = new ActionRowBuilder().addComponents(emailInput);
    const row4 = new ActionRowBuilder().addComponents(ibanInput);

    modal.addComponents(row1, row2, row3, row4);

    await interaction.showModal(modal);
  }

  // التعامل مع Modal
  if(interaction.type === InteractionType.ModalSubmit && interaction.customId === "public_eidiya_modal") {

    const name = interaction.fields.getTextInputValue("user_name");
    const phone = interaction.fields.getTextInputValue("user_phone");
    const email = interaction.fields.getTextInputValue("user_email");
    const iban = interaction.fields.getTextInputValue("user_iban");

    // التأكد من عدم تكرار البيانات
    const uniqueKey = `${name}|${phone}|${email}|${iban}`;
    if(submittedData.has(uniqueKey)) {
      return interaction.reply({ content: "🚫 تم تسجيل هذه البيانات مسبقًا، لا يمكن طلب عيدية ثانية!", ephemeral:true });
    }
    submittedData.add(uniqueKey);

    const amount = getPublicEidiya();

    const resultEmbed = new EmbedBuilder()
      .setTitle("💰 عيدية العائلة العلنية")
      .setColor(getColorByAmount(amount))
      .setDescription(
`الدون راجع بياناتك بعناية:

الاسم: **${name}**
الجوال: **${phone}**
الايميل: **${email}**
الآيبان: **${iban}**

تم تحديد عيديتك العلنية: **${amount} ريال**

⚠️ تذكر: إذا كان الايبان خاطئًا، لن يصلك المبلغ.`)
      .setFooter({ text:"العائلة لا تنسى أحداً" })
      .setTimestamp();

    await interaction.reply({ embeds:[resultEmbed], ephemeral:true });

    const logChannel = client.channels.cache.get(LOG_CHANNEL_PUBLIC);
    if(logChannel){
      const logEmbed = new EmbedBuilder()
        .setTitle("📜 سجل العيديات العلنية")
        .setColor("#111111")
        .setDescription(
`${interaction.user} استلم عيديته العلنية.
الاسم: ${name}
الجوال: ${phone}
الايميل: ${email}
الآيبان: ${iban}
المبلغ: **${amount} ريال**`)
        .setTimestamp();

      logChannel.send({ embeds:[logEmbed] });
    }
  }
});

// الرسائل الأولية
client.on("messageCreate", async message => {
  // رسالة العائلية
  if(message.content === "!eid") {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("eidiya_button")
          .setLabel("أبي عيدية")
          .setStyle(ButtonStyle.Success)
      );

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("💰 خزنة العائلة")
      .setDescription(`اليوم فتح الدون خزنة العائلة للعائلة الموثوقة فقط.
اضغط على الزر أدناه لتعرف نصيبك من العيدية.
كل عضو يحصل على محاولة واحدة فقط.`)
      .setImage(VAULT_IMAGE)
      .setFooter({ text:"العائلة فوق كل شيء" })
      .setTimestamp();

    message.channel.send({ embeds:[embed], components:[row] });
  }

  // رسالة العلنية
  if(message.content === "!public_eid") {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("public_eidiya")
          .setLabel("احصل على عيديتك")
          .setStyle(ButtonStyle.Success)
      );

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("💰 خزنة العيديات العلنية")
      .setDescription(`الدون فتح خزنة العيديات العلنية للعامة.
الحد الأقصى للمشاركين: **${MAX_PUBLIC_CLAIMS}** عضو.
اضغط على الزر لطلب عيديتك. كل شيء يُسجل في دفتر الدون.`)
      .setImage(VAULT_IMAGE)
      .setFooter({ text:"العائلة لا تنسى أحداً" })
      .setTimestamp();

    message.channel.send({ embeds:[embed], components:[row] });
  }
});

client.login(TOKEN);
