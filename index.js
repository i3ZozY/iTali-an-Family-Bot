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
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder 
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

// روم تسجيل العيديات للعائلة
const LOG_CHANNEL = "1481705807560310874";

// روم تسجيل العيديات العامة
const PUBLIC_LOG_CHANNEL = "1481757344269336807";

// صورة الخزنة
const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

// المجموعات لمنع الغش والتكرار
const claimedUsers = new Set();         // العائلية
const claimedPublic = new Set();        // العلنية
const publicActiveUsers = new Set();    // لمنع ارسال اكثر من رسالة قبل الضغط على الزر

// تحديد العيدية
function getEidiya() {
  const random = Math.floor(Math.random()*100)+1;
  if(random <= 70) return 5;
  if(random <= 85) return 10;
  if(random <= 95) return 20;
  return 50;
}

// ألوان حسب مقدار العيدية
function getColorByAmount(amount){
  if(amount === 5) return "#6e6e6e";
  if(amount === 10) return "#3498db";
  if(amount === 20) return "#9b59b6";
  if(amount === 50) return "#d4af37";
}

// عند تشغيل البوت
client.once("ready", () => {
  console.log("🤵‍♂️ الدون جاهز وتم فتح دفتر العائلة.");
});

// ======== التفاعل مع الزر ========
client.on("interactionCreate", async interaction => {

  if(!interaction.isButton()) return;

  // النسخة العائلية
  if(interaction.customId === "eidiya_button"){

    const userId = interaction.user.id;

    if(claimedUsers.has(userId)){
      const rejectEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("🚫 تم تسجيل اسمك مسبقًا")
        .setDescription(`اسمك مسجل بالفعل في **دفتر الدون**.\nلقد استلمت عيديتك مسبقًا، لا يمكن طلب عيدية أخرى.`)
        .setFooter({text:"دفتر الدون لا ينسى"})
        .setTimestamp();

      return interaction.reply({ embeds:[rejectEmbed], ephemeral:true });
    }

    claimedUsers.add(userId);

    const waitingEmbed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("💰 خزنة العائلة")
      .setDescription(`قام الدون بفتح **خزنة العائلة** الآن.\nينظر في الصناديق ويقرر مقدار العيدية لكل فرد من أفراد العائلة.\nانتظر قليلًا بينما يحدد الدون نصيبك.`)
      .setFooter({text:"كل شيء يسجل في دفتر الدون"})
      .setTimestamp();

    await interaction.reply({ embeds:[waitingEmbed], ephemeral:true });

    setTimeout(async () => {
      const amount = getEidiya();
      const resultEmbed = new EmbedBuilder()
        .setColor(getColorByAmount(amount))
        .setTitle("💰 عيدية العائلة")
        .setDescription(`بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.\nالمبلغ الذي حصلت عليه:\n**${amount} ريال**\nتم تسجيل هذه العملية رسميًا في **دفتر الدون**.`)
        .setFooter({text:"العائلة لا تنسى"})
        .setTimestamp();

      await interaction.editReply({ embeds:[resultEmbed] });

      const channel = client.channels.cache.get(LOG_CHANNEL);
      if(channel){
        const logEmbed = new EmbedBuilder()
          .setColor("#111111")
          .setTitle("📜 دفتر الدون")
          .setDescription(`${interaction.user} استلم عيديته.\nالمبلغ:\n**${amount} ريال**\nتم تسجيل العملية في دفتر العائلة.`)
          .setTimestamp();

        channel.send({ embeds:[logEmbed] });
      }
    }, 10000);

  }

  // النسخة العلنية في DM
  if(interaction.customId === "public_eidiya"){

    const userId = interaction.user.id;

    if(claimedPublic.has(userId)){
      return interaction.reply({
        content: "🚫 تم استلام عيديتك مسبقًا، لا يمكن طلب عيدية ثانية.",
        ephemeral:true
      });
    }

    claimedPublic.add(userId);

    const amount = getEidiya();

    const resultEmbed = new EmbedBuilder()
      .setColor(getColorByAmount(amount))
      .setTitle("💰 خزنة العيدية")
      .setImage(VAULT_IMAGE)
      .setDescription(`بعد مراجعة الدون للخزنة، تم تحديد عيديتك.\nالمبلغ:\n**${amount} ريال**\nتم تسجيل العملية في دفتر العيديات العامة.`)
      .setFooter({text:"الدون يراقب كل شيء"})
      .setTimestamp();

    await interaction.reply({ embeds:[resultEmbed], ephemeral:true });

    const channel = client.channels.cache.get(PUBLIC_LOG_CHANNEL);
    if(channel){
      const logEmbed = new EmbedBuilder()
        .setColor("#2f3136")
        .setTitle("📜 سجل العيديات العامة")
        .setDescription(`${interaction.user} استلم عيديته.\nالمبلغ:\n**${amount} ريال**\nتم تسجيل العملية.`)
        .setTimestamp();
      channel.send({ embeds:[logEmbed] });
    }
  }

});

// ======== رسالة !eid للنسخة العائلية ========
client.on("messageCreate", async message => {
  if(message.content === "!eid"){

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
      .setDescription(`بأمر من **الدون** تم فتح خزنة العائلة اليوم.\nقرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.\nاضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك بنفسه.\nكل عضو يحصل على عيدية واحدة فقط، ويتم تسجيل كل شيء في **دفتر الدون**.`)
      .setImage(VAULT_IMAGE)
      .setFooter({text:"العائلة فوق كل شيء"})
      .setTimestamp();

    message.channel.send({ embeds:[embed], components:[row] });
  }
});

// ======== الرسائل العلنية في DM ========
client.on("messageCreate", async message => {
  if(message.channel.type !== 1) return; // DM فقط

  const userId = message.author.id;
  if(publicActiveUsers.has(userId) || claimedPublic.has(userId)) return;
  publicActiveUsers.add(userId);

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
    .setDescription(`مرحبًا بك، اضغط الزر أدناه للبدء بتحديد عيديتك.`)
    .setImage(VAULT_IMAGE)
    .setFooter({text:"الدون يراقب كل شيء"})
    .setTimestamp();

  await message.channel.send({embeds:[embed], components:[row]});
});

// تسجيل دخول البوت
client.login(TOKEN);
