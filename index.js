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
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  InteractionType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

const TOKEN = process.env.TOKEN;
const FAMILY_LOG_CHANNEL = "1481705807560310874";
const PUBLIC_LOG_CHANNEL = "1481757344269336807";
const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

const claimedFamily = new Set();
const claimedPublic = new Set();
const publicData = new Map();

// دوال تحديد العيدية
function getFamilyEidiya() {
  const r = Math.floor(Math.random()*100)+1;
  if(r <= 70) return 5;
  if(r <= 85) return 10;
  if(r <= 95) return 20;
  return 50;
}

function getPublicEidiya() {
  const r = Math.floor(Math.random()*100)+1;
  if(r <= 55) return 0;
  else if(r <= 95) return 5;
  else return 10;
}

function getColorByAmount(amount) {
  if(amount === 0) return "#7f8c8d";
  if(amount === 5) return "#3498db";
  if(amount === 10) return "#9b59b6";
  if(amount === 20) return "#f39c12";
  if(amount === 50) return "#d4af37";
}

// ----------------------
// النسخة العائلية
// ----------------------
client.on("messageCreate", async message => {
  if(message.content === "!eid") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("family_eidiya_button")
        .setLabel("أبي عيدية")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("خزنة العائلة 💰")
      .setDescription(`
بأمر من **الدون** تم فتح خزنة العائلة اليوم.
قرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.
اضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك بنفسه.
كل عضو يحصل على عيدية واحدة فقط، ويتم تسجيل كل شيء في **دفتر الدون**.
      `)
      .setImage(VAULT_IMAGE)
      .setFooter({ text:"العائلة فوق كل شيء" })
      .setTimestamp();

    message.channel.send({ embeds:[embed], components:[row] });
  }
});

client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  // النسخة العائلية
  if(interaction.customId === "family_eidiya_button") {
    const userId = interaction.user.id;
    if(claimedFamily.has(userId)) {
      return interaction.reply({
        embeds:[new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("🚫 تم تسجيل اسمك مسبقًا")
          .setDescription("اسمك مسجل بالفعل في **دفتر الدون**. لقد استلمت عيديتك مسبقًا، ولا يمكن طلب عيدية أخرى.")
          .setFooter({text:"دفتر الدون لا ينسى"})
          .setTimestamp()
        ],
        ephemeral:true
      });
    }

    claimedFamily.add(userId);

    const waitingEmbed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("خزنة العائلة")
      .setDescription("قام الدون بفتح **خزنة العائلة** الآن. انتظر قليلًا بينما يحدد الدون نصيبك.")
      .setFooter({text:"كل شيء يسجل في دفتر الدون"})
      .setTimestamp();

    await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

    setTimeout(async ()=>{
      const amount = getFamilyEidiya();
      const resultEmbed = new EmbedBuilder()
        .setColor(getColorByAmount(amount))
        .setTitle("عيدية العائلة")
        .setDescription(`بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.\nالمبلغ: **${amount} ريال**\nتم تسجيل هذه العملية رسميًا في **دفتر الدون**.`)
        .setFooter({text:"العائلة لا تنسى"})
        .setTimestamp();

      await interaction.editReply({ embeds:[resultEmbed] });

      const channel = client.channels.cache.get(FAMILY_LOG_CHANNEL);
      if(channel) {
        const logEmbed = new EmbedBuilder()
          .setColor("#111111")
          .setTitle("دفتر الدون")
          .setDescription(`${interaction.user} استلم عيديته.\nالمبلغ: **${amount} ريال**\nتم تسجيل العملية في دفتر العائلة.`)
          .setTimestamp();
        channel.send({ embeds:[logEmbed] });
      }
    },10000);
  }

  // النسخة العلنية
  if(interaction.customId === "public_eidiya_button") {
    const userId = interaction.user.id;
    if(claimedPublic.has(userId)) {
      return interaction.reply({ content:"🚫 لقد استلمت عيديتك العلنية مسبقًا.", ephemeral:true });
    }
    claimedPublic.add(userId);

    const modal = new ModalBuilder()
      .setCustomId("public_eidiya_modal")
      .setTitle("ادخل بياناتك بدقة")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("full_name").setLabel("اكتب اسمك الثلاثي أو الرباعي").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("phone_number").setLabel("رقم جوالك الخاص").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("email").setLabel("بريدك الإلكتروني").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("iban").setLabel("رقم الإيبان الخاص بك").setStyle(TextInputStyle.Short).setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }
});

client.on("interactionCreate", async interaction => {
  if(interaction.type !== InteractionType.ModalSubmit) return;
  if(interaction.customId !== "public_eidiya_modal") return;

  const userId = interaction.user.id;
  const name = interaction.fields.getTextInputValue("full_name");
  const phone = interaction.fields.getTextInputValue("phone_number");
  const email = interaction.fields.getTextInputValue("email");
  const iban = interaction.fields.getTextInputValue("iban");

  // تحقق من التكرار
  for(const data of publicData.values()){
    if(data.phone === phone || data.email === email || data.iban === iban){
      return interaction.reply({ content:"🚫 تم العثور على بيانات مكررة. لا يمكنك الحصول على العيدية مرتين.", ephemeral:true });
    }
  }

  publicData.set(userId,{ name, phone, email, iban });

  // تحديد مبلغ العيدية العلنية
  let amount = getPublicEidiya();
  if(amount > 50) amount = 50; // الحد الأقصى

  const embed = new EmbedBuilder()
    .setColor(getColorByAmount(amount))
    .setTitle("عيديتك العلنية 💰")
    .setDescription(`تم تسجيل بياناتك بدقة في دفتر العيديات العلنية.\nالمبلغ الذي حصلت عليه: **${amount} ريال**\nتأكد من صحة الإيبان الخاص بك، أي خطأ يعني عدم وصول المبلغ.`)
    .setFooter({ text:"العائلة تراقب كل شيء" })
    .setTimestamp();

  await interaction.reply({ embeds:[embed], ephemeral:true });

  // تسجيل في اللوج العلني
  const logChannel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
  if(logChannel){
    const logEmbed = new EmbedBuilder()
      .setColor("#111111")
      .setTitle("سجل العيديات العلنية")
      .setDescription(`${interaction.user} استلم عيديته العلنية.\nالمبلغ: **${amount} ريال**\nتم تسجيل العملية في دفتر العيديات العلنية.`)
      .setTimestamp();
    logChannel.send({ embeds:[logEmbed] });
  }
});

// إرسال النسخة العلنية فقط عند الرسائل الخاصة
client.on("messageCreate", async message=>{
  if(message.channel.type !== 1) return;
  if(claimedPublic.has(message.author.id)) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("public_eidiya_button").setLabel("احصل على عيديتك").setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("خزنة العيدية العلنية 💰")
    .setDescription("مرحبًا بك، أيها العضو. اضغط على الزر أدناه لبدء العملية. يمكنك الحصول على عيدية واحدة فقط، وكل خطوة سيتم تسجيلها.")
    .setFooter({ text:"العيدية العلنية تخضع للدفتر" })
    .setTimestamp();

  message.channel.send({ embeds:[embed], components:[row] });
});

client.login(TOKEN);
