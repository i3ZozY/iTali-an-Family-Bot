const express = require("express");
const app = express();

// سيرفر بسيط لمنع نوم الاستضافة
app.get("/", (req, res) => {
  res.send("Bot is alive");
});
app.listen(3000, () => console.log("Keep alive server started"));

const {
  Client,
  GatewayIntentBits,
  Partials,
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
  partials: [Partials.Channel] // للسماح بالـ DM
});

const TOKEN = process.env.TOKEN;

// العائلة (Server)
const LOG_CHANNEL_FAMILY = "1481705807560310874";
// العيديات العلنية (DM)
const LOG_CHANNEL_PUBLIC = "1481757344269336807";

// لتخزين من أخذ العيدية
const claimedUsersFamily = new Set();
const claimedUsersPublic = new Set();
const usedDataPublic = new Set();

// نسب العيديات العلنية
function getEidiyaPublic() {
  const r = Math.floor(Math.random() * 100) + 1;
  if (r <= 55) return 0;
  if (r <= 95) return 5;
  return 10;
}

// ألوان حسب المبلغ
function getColorByAmount(amount) {
  if (amount === 0) return "#7f8c8d";
  if (amount === 5) return "#3498db";
  if (amount === 10) return "#f1c40f";
  return "#2ecc71";
}

client.once("ready", () => {
  console.log("🤵‍♂️ الدون جاهز والدفتر مفتوح.");
});

// ===================
// النسخة العلنية (DM)
// ===================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // DM فقط
  if (message.channel.type === 1) { // DM
    if (claimedUsersPublic.has(message.author.id)) {
      return message.channel.send({
        content: "🚫 الدون: لقد استلمت عيديتك بالفعل. لا يمكن التكرار!"
      });
    }

    // زر للحصول على عيدية
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("public_eidiya_button")
        .setLabel("احصل على عيديتك")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("💰 خزنة العيديات العلنية")
      .setDescription(
        `الدون يبتسم ويقول: "ها قد حان وقت توزيع عيديات العيد للموظفين الجدد!"  
اضغط على الزر لتبدأ رحلتك مع الدون، وتذكر… كل خطوة مسجلة في دفتر العائلة.`
      )
      .setFooter({ text: "العائلة لا تنسى شيئاً" })
      .setTimestamp();

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// عند الضغط على زر العيدية العلنية
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  // ================================
  // زر العيدية العلنية (DM)
  // ================================
  if (interaction.customId === "public_eidiya_button") {
    const userId = interaction.user.id;

    if (claimedUsersPublic.has(userId)) {
      return interaction.reply({
        content: "🚫 الدون: لقد استلمت عيديتك بالفعل!",
        ephemeral: true
      });
    }

    // فتح Modal لطلب البيانات
    const modal = new ModalBuilder()
      .setCustomId("public_eidiya_modal")
      .setTitle("📝 بيانات العيدية");

    const nameInput = new TextInputBuilder()
      .setCustomId("full_name")
      .setLabel("اسمك الكامل (رباعي أو ثلاثي)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const phoneInput = new TextInputBuilder()
      .setCustomId("phone_number")
      .setLabel("رقم جوالك الخاص")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const emailInput = new TextInputBuilder()
      .setCustomId("email")
      .setLabel("الإيميل الخاص بك")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const ibanInput = new TextInputBuilder()
      .setCustomId("iban")
      .setLabel("رقم الايبان الخاص بك")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(nameInput);
    const secondRow = new ActionRowBuilder().addComponents(phoneInput);
    const thirdRow = new ActionRowBuilder().addComponents(emailInput);
    const fourthRow = new ActionRowBuilder().addComponents(ibanInput);

    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

    await interaction.showModal(modal);
  }

  // ================================
  // التعامل مع Modal
  // ================================
  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId === "public_eidiya_modal") {
      const fullName = interaction.fields.getTextInputValue("full_name").trim();
      const phone = interaction.fields.getTextInputValue("phone_number").trim();
      const email = interaction.fields.getTextInputValue("email").trim();
      const iban = interaction.fields.getTextInputValue("iban").trim();

      const dataKey = `${fullName}|${phone}|${email}|${iban}`;

      if (claimedUsersPublic.has(interaction.user.id) || usedDataPublic.has(dataKey)) {
        return interaction.reply({
          content:
            "🚫 الدون: تم تسجيل بياناتك مسبقًا. لا يمكن طلب عيدية ثانية!",
          ephemeral: true
        });
      }

      claimedUsersPublic.add(interaction.user.id);
      usedDataPublic.add(dataKey);

      const amount = getEidiyaPublic();

      const embed = new EmbedBuilder()
        .setColor(getColorByAmount(amount))
        .setTitle("💰 عيدية العيد الخاصة بك")
        .setDescription(
          `بعد مراجعة دفتر العائلة بدقة، قرر الدون مقدار عيديتك:

المبلغ: **${amount} ريال**

تأكد من صحة الايبان الخاص بك، أي خطأ يمنع وصول العيدية.`
        )
        .setFooter({ text: "العائلة لا تنسى" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      // تسجيل العملية في Log
      const logChannel = client.channels.cache.get(LOG_CHANNEL_PUBLIC);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor("#111111")
          .setTitle("دفتر العيديات العلنية")
          .setDescription(
            `${interaction.user} استلم العيدية العلنية.\nالمبلغ: **${amount} ريال**\nالبيانات: ${fullName} | ${phone} | ${email} | ${iban}`
          )
          .setTimestamp();
        logChannel.send({ embeds: [logEmbed] });
      }
    }
  }
});

// =============================
// النسخة العائلية كما هي تمامًا
// =============================
// ... ضع هنا الكود الخاص بالسيرفر بدون أي تعديل ...

client.login(TOKEN);
