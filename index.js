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
  InteractionType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

const TOKEN = process.env.TOKEN;

const FAMILY_LOG = "1481705807560310874";
const PUBLIC_LOG = "1481757344269336807";

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

const claimedUsers = new Set();

function getFamilyEidiya(){
const random = Math.floor(Math.random()*100)+1;

if(random <= 70) return 5;
if(random <= 85) return 10;
if(random <= 95) return 20;
return 50;
}

function getPublicEidiya(){

const random = Math.floor(Math.random()*100)+1;

if(random <= 55) return 0;
if(random <= 95) return 5;
return 10;

}

function getColor(amount){

if(amount === 0) return "#6e6e6e";
if(amount === 5) return "#3498db";
if(amount === 10) return "#2ecc71";
if(amount === 20) return "#9b59b6";
if(amount === 50) return "#d4af37";

}

client.once("ready", () => {

console.log("البوت جاهز.");

});


// ================= العائلة =================

client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return;

if(interaction.customId === "eidiya_button"){

const userId = interaction.user.id;

if(claimedUsers.has(userId)){

const rejectEmbed = new EmbedBuilder()

.setColor("#ff0000")
.setTitle("🚫 تم تسجيل اسمك مسبقًا")
.setDescription(`
اسمك مسجل بالفعل في **دفتر الدون**.

لقد استلمت عيديتك مسبقًا، ولا يمكن طلب عيدية أخرى.
`)
.setFooter({text:"دفتر الدون لا ينسى"})
.setTimestamp();

return interaction.reply({
embeds:[rejectEmbed],
ephemeral:true
});

}

claimedUsers.add(userId);

const waitingEmbed = new EmbedBuilder()

.setColor("#2f3136")
.setTitle("خزنة العائلة")
.setDescription(`
قام الدون بفتح **خزنة العائلة** الآن.

ينظر في الصناديق ويقرر مقدار العيدية لكل فرد من أفراد العائلة.
`)
.setFooter({text:"كل شيء يسجل في دفتر الدون"})
.setTimestamp();

await interaction.reply({
embeds:[waitingEmbed],
ephemeral:true
});

setTimeout(async () => {

const amount = getFamilyEidiya();

const resultEmbed = new EmbedBuilder()

.setColor(getColor(amount))
.setTitle("عيدية العائلة")
.setDescription(`
بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.

**${amount} ريال**
`)
.setTimestamp();

await interaction.editReply({
embeds:[resultEmbed]
});

const channel = client.channels.cache.get(FAMILY_LOG);

if(channel){

const logEmbed = new EmbedBuilder()

.setColor("#111111")
.setTitle("دفتر الدون")
.setDescription(`
${interaction.user}

المبلغ:
**${amount} ريال**
`)
.setTimestamp();

channel.send({embeds:[logEmbed]});

}

},10000);

}

});


// ================= امر العائلة =================

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
.setDescription(`
بأمر من **الدون** تم فتح خزنة العائلة اليوم.

قرر الدون توزيع عيديات على أفراد العائلة تقديرًا لولائهم.

اضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك.
`)
.setImage(VAULT_IMAGE)
.setFooter({text:"العائلة فوق كل شيء"})
.setTimestamp();

message.channel.send({
embeds:[embed],
components:[row]
});

}

});


// ================= النسخة العلنية =================

client.on("messageCreate", async message => {

if(message.author.bot) return;

if(message.guild) return;

const row = new ActionRowBuilder()
.addComponents(

new ButtonBuilder()
.setCustomId("public_button")
.setLabel("احصل على عيدية")
.setStyle(ButtonStyle.Primary)

);

const embed = new EmbedBuilder()

.setColor("#8B0000")
.setTitle("خزنة العيدية")
.setDescription(`
تم فتح خزنة العيدية.

اضغط الزر بالأسفل لطلب عيديتك.
`)
.setImage(VAULT_IMAGE)
.setTimestamp();

message.channel.send({
embeds:[embed],
components:[row]
});

});


// ================= زر العيدية العلنية =================

client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return;

if(interaction.customId === "public_button"){

const modal = new ModalBuilder()

.setCustomId("public_modal")
.setTitle("بيانات العيدية");

const name = new TextInputBuilder()
.setCustomId("name")
.setLabel("اسمك الثلاثي أو الرباعي")
.setStyle(TextInputStyle.Short)
.setRequired(true);

const phone = new TextInputBuilder()
.setCustomId("phone")
.setLabel("رقم جوالك")
.setStyle(TextInputStyle.Short)
.setRequired(true);

const email = new TextInputBuilder()
.setCustomId("email")
.setLabel("البريد الإلكتروني")
.setStyle(TextInputStyle.Short)
.setRequired(true);

const iban = new TextInputBuilder()
.setCustomId("iban")
.setLabel("رقم الايبان البنكي")
.setStyle(TextInputStyle.Short)
.setRequired(true);

modal.addComponents(
new ActionRowBuilder().addComponents(name),
new ActionRowBuilder().addComponents(phone),
new ActionRowBuilder().addComponents(email),
new ActionRowBuilder().addComponents(iban)
);

interaction.showModal(modal);

}

});


// ================= ارسال العيدية =================

client.on("interactionCreate", async interaction => {

if(interaction.type !== InteractionType.ModalSubmit) return;

if(interaction.customId !== "public_modal") return;

const name = interaction.fields.getTextInputValue("name");
const phone = interaction.fields.getTextInputValue("phone");
const email = interaction.fields.getTextInputValue("email");
const iban = interaction.fields.getTextInputValue("iban");

const amount = getPublicEidiya();

const embed = new EmbedBuilder()

.setColor(getColor(amount))
.setTitle("عيديتك")
.setDescription(`
تم تسجيل بياناتك بنجاح.

المبلغ الذي حصلت عليه:

**${amount} ريال**
`)
.setTimestamp();

await interaction.reply({
embeds:[embed],
ephemeral:true
});

const logChannel = client.channels.cache.get(PUBLIC_LOG);

if(logChannel){

const logEmbed = new EmbedBuilder()

.setColor("#111111")
.setTitle("سجل العيديات العامة")
.setDescription(`
المستخدم: ${interaction.user}

الاسم: ${name}

الجوال: ${phone}

الإيميل: ${email}

الايبان: ${iban}

المبلغ: **${amount} ريال**
`)
.setTimestamp();

logChannel.send({embeds:[logEmbed]});

}

});


client.login(TOKEN);
