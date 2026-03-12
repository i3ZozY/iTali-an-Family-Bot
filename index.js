const express = require("express");
const app = express();
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
  ModalSubmitInteraction,
  Partialsلغلغلل
} = require("discord.js");

// سيرفر بسيط لمنع نوم الاستضافة
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(3000, () => console.log("Keep alive server started"));

// إنشاء البوت
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

const TOKEN = process.env.TOKEN;

// الرومات
const LOG_CHANNEL_FAMILY = "1481705807560310874"; // العائلية
const LOG_CHANNEL_PUBLIC = "1481757344269336807"; // العلنية
const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// تخزين من أخذ العيدية
const claimedFamily = new Set();
const claimedPublic = new Set();

// دوال لتحديد العيدية
function getEidiya() {
  const random = Math.floor(Math.random() * 100) + 1;
  if (random <= 70) return 5;
  if (random <= 85) return 10;
  if (random <= 95) return 20;
  return 50;
}

function getColorByAmount(amount) {
  if(amount === 5) return "#6e6e6e";
  if(amount === 10) return "#3498db";
  if(amount === 20) return "#9b59b6";
  if(amount === 50) return "#d4af37";
  return "#8B0000";
}

// جاهزية البوت
client.once("ready", () => {
  console.log("🤵‍♂️ الدون جاهز والدفتر مفتوح!");
});

// =======================
// النسخة العائلية
// =======================
client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  // العائلية
  if(interaction.customId === "eidiya_button" && interaction.channelId === LOG_CHANNEL_FAMILY) {
    const userId = interaction.user.id;
    if(claimedFamily.has(userId)) {
      const rejectEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("🚫 تم تسجيل اسمك مسبقًا")
        .setDescription(`اسمك مسجل بالفعل في **دفتر الدون**. لقد استلمت عيديتك مسبقًا.`)
        .setFooter({text:"دفتر الدون لا ينسى"}).setTimestamp();
      return interaction.reply({embeds:[rejectEmbed], ephemeral:true});
    }

    claimedFamily.add(userId);

    const waitingEmbed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("💰 خزنة العائلة")
      .setDescription(`قام الدون بفتح **خزنة العائلة** الآن. انتظر قليلًا بينما يحدد نصيبك.`)
      .setFooter({text:"كل شيء يسجل في دفتر الدون"}).setTimestamp();

    await interaction.reply({embeds:[waitingEmbed], ephemeral:true});

    setTimeout(async () => {
      const amount = getEidiya();
      const resultEmbed = new EmbedBuilder()
        .setColor(getColorByAmount(amount))
        .setTitle("💰 عيدية العائلة")
        .setDescription(`الدون قرر مقدار عيديتك: **${amount} ريال**.`)
        .setFooter({text:"العائلة لا تنسى"}).setTimestamp();

      await interaction.editReply({embeds:[resultEmbed]});

      const channel = client.channels.cache.get(LOG_CHANNEL_FAMILY);
      if(channel){
        const logEmbed = new EmbedBuilder()
          .setColor("#111111")
          .setTitle("📜 دفتر الدون")
          .setDescription(`${interaction.user} استلم عيديته.\nالمبلغ: **${amount} ريال**.`)
          .setTimestamp();
        channel.send({embeds:[logEmbed]});
      }
    },10000);
  }
});

// النسخة العلنية (DM)
client.on("messageCreate", async message => {
  if(message.channel.type !== 1) return; // DM فقط
  const userId = message.author.id;
  if(claimedPublic.has(userId)) return message.channel.send("🚫 لقد استلمت العيدية مسبقًا.");

  // زر البداية
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("public_eidiya")
        .setLabel("احصل على عيدية")
        .setStyle(ButtonStyle.Success)
    );

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("💰 خزنة العيدية")
    .setDescription(`مرحبًا بك، الدون مستعد لتوزيع عيديتك.\nاضغط الزر أدناه للبدء.`)
    .setImage(VAULT_IMAGE)
    .setFooter({text:"الدون يراقب كل شيء"})
    .setTimestamp();

  await message.channel.send({embeds:[embed], components:[row]});
});

// التعامل مع زر العيدية العلني
client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;
  if(interaction.customId === "public_eidiya") {
    const userId = interaction.user.id;
    if(claimedPublic.has(userId)) {
      return interaction.reply({content:"🚫 لقد استلمت العيدية مسبقًا.", ephemeral:true});
    }

    // Modal لبيانات المستخدم
    const modal = new ModalBuilder()
      .setCustomId(`public_modal_${userId}`)
      .setTitle("بيانات العيدية");

    const nameInput = new TextInputBuilder()
      .setCustomId("full_name")
      .setLabel("اكتب اسمك الثلاثي أو الرباعي")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const phoneInput = new TextInputBuilder()
      .setCustomId("phone")
      .setLabel("رقم جوالك الخاص")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(20);

    const ibanInput = new TextInputBuilder()
      .setCustomId("iban")
      .setLabel("رقم الايبان الخاص بالبنك")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(34);

    const row1 = new ActionRowBuilder().addComponents(nameInput);
    const row2 = new ActionRowBuilder().addComponents(phoneInput);
    const row3 = new ActionRowBuilder().addComponents(ibanInput);

    modal.addComponents(row1, row2, row3);

    await interaction.showModal(modal);
  }
});

// التعامل مع Modal العلني
client.on("interactionCreate", async interaction => {
  if(!interaction.isModalSubmit()) return;
  if(!interaction.customId.startsWith("public_modal_")) return;

  const userId = interaction.user.id;
  if(claimedPublic.has(userId)) return interaction.reply({content:"🚫 لقد استلمت العيدية مسبقًا.", ephemeral:true});

  const fullName = interaction.fields.getTextInputValue("full_name");
  const phone = interaction.fields.getTextInputValue("phone");
  const iban = interaction.fields.getTextInputValue("iban");

  // منع التكرار البسيط حسب الرقم أو الاسم
  const logChannel = client.channels.cache.get(LOG_CHANNEL_PUBLIC);
  const messages = await logChannel.messages.fetch({ limit: 100 });
  const duplicate = messages.find(m => m.embeds[0]?.description?.includes(fullName) || m.embeds[0]?.description?.includes(iban) || m.embeds[0]?.description?.includes(phone));
  if(duplicate) return interaction.reply({content:"🚫 البيانات مسجلة مسبقًا.", ephemeral:true});

  const amount = getEidiya();
  claimedPublic.add(userId);

  const resultEmbed = new EmbedBuilder()
    .setColor(getColorByAmount(amount))
    .setTitle("💰 عيدية الدون")
    .setDescription(`تم تحديد عيديتك.\nالمبلغ: **${amount} ريال**\nتأكد من صحة الايبان لأنه إذا كان خطأ فلن يصلك المال.`)
    .setFooter({text:"العائلة لا تنسى"}).setTimestamp();

  await interaction.reply({embeds:[resultEmbed], ephemeral:true});

  if(logChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor("#111111")
      .setTitle("📜 سجل العيديات العلني")
      .setDescription(`اسم: ${fullName}\nرقم جوال: ${phone}\nIBAN: ${iban}\nالمبلغ: **${amount} ريال**\n${interaction.user}`)
      .setTimestamp();
    logChannel.send({embeds:[logEmbed]});
  }
});

// النسخة العائلية (أمر !eid)
client.on("messageCreate", async message => {
  if(message.content === "!eid" && message.channelId === LOG_CHANNEL_FAMILY){
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("eidiya_button")
          .setLabel("أبي عيدية")
          .setStyle(ButtonStyle.Success)
      );

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("خزنة العائلة 💰")
      .setDescription(`بأمر من **الدون** تم فتح خزنة العائلة اليوم.\nقرر الدون توزيع عيديات على أفراد العائلة.\nاضغط على الزر أدناه.`)
      .setImage(VAULT_IMAGE)
      .setFooter({text:"العائلة فوق كل شيء"}).setTimestamp();

    message.channel.send({embeds:[embed], components:[row]});
  }
});

client.login(TOKEN);

