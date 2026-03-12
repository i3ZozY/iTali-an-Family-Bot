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

const TOKEN = process.env.TOKEN;

const LOG_CHANNEL = "1481705807560310874";

const VAULT_IMAGE = "https://images-ext-1.discordapp.net/external/7Pu3JB_gfrOlWCgqMDVaVNKSQyMwWfZFKF-nILTx30A/https/probot.media/khP5cxQfuI.jpg?format=webp&width=1376&height=860";

const claimedUsers = new Set();

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

client.once("ready", () => {

console.log("الدون جاهز وتم فتح دفتر العائلة.");

});

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

كل ما يحدث هنا يتم تسجيله بدقة.`)
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

انتظر قليلًا بينما يحدد الدون نصيبك.`)
.setFooter({text:"كل شيء يسجل في دفتر الدون"})
.setTimestamp();

await interaction.reply({
embeds:[waitingEmbed],
ephemeral:true
});

setTimeout(async () => {

const amount = getEidiya();

const resultEmbed = new EmbedBuilder()

.setColor(getColorByAmount(amount))
.setTitle("عيدية العائلة")
.setDescription(`
بعد تفقد خزنة العائلة، قرر الدون مقدار عيديتك.

المبلغ الذي حصلت عليه:

**${amount} ريال**

تم تسجيل هذه العملية رسميًا في **دفتر الدون**.`)
.setFooter({text:"العائلة لا تنسى"})
.setTimestamp();

await interaction.editReply({
embeds:[resultEmbed]
});

const channel = client.channels.cache.get(LOG_CHANNEL);

if(channel){

const logEmbed = new EmbedBuilder()

.setColor("#111111")
.setTitle("دفتر الدون")
.setDescription(`
${interaction.user} استلم عيديته.

المبلغ:
**${amount} ريال**

تم تسجيل العملية في دفتر العائلة.`)
.setTimestamp();

channel.send({embeds:[logEmbed]});

}

},10000);

}

});

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

اضغط على زر **أبي عيدية** ليقوم الدون بتحديد نصيبك بنفسه.

كل عضو يحصل على عيدية واحدة فقط، ويتم تسجيل كل شيء في **دفتر الدون**.`)
.setImage(VAULT_IMAGE)
.setFooter({text:"العائلة فوق كل شيء"})
.setTimestamp();

message.channel.send({
embeds:[embed],
components:[row]
});

}

});


client.login(TOKEN);
