const Discord = require("discord.js");
const whitelist = require("./whitelist");

const botBanReason = "Communal Mod: User was banned from";

const client = new Discord.Client();

client.on("ready", () => {
  console.log("Ready to ban");
});

client.on("guildBanAdd", async (guild, user) => {
  if (!whitelist.includes(guild.id)) {
    return;
  }

  const banReason = (await guild.fetchBan(user)).reason;
  if (banReason && banReason.slice(0, botBanReason.length) == botBanReason) {
    return;
  }

  const botGuilds = client.guilds;

  botGuilds.cache.forEach((g) => {
    if (guild.id != g.id) {
      console.log(`Banning ${user.id} on ${g.name}`);

      g.members
        .ban(user.id, {
          days: 1,
          reason: `${botBanReason} ${guild.name}`,
        })
        .catch((error) => console.log(error));
    }
  });
});

client.login(process.env.TOKEN).catch(() => {
  console.log("Error logging in");
  process.exit(1);
});
