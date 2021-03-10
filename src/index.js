const Discord = require("discord.js");
const whitelist = require("./whitelist");

const botBanReason = "Communal Mod: User was banned from";

const client = new Discord.Client();

const admin = new Discord.User(client, { id: process.env.ADMIN });

client.on("ready", () => {
  console.log("Ready to ban");
});

client.on("message", async (message) => {
  const senderId = message.author.id;

  if (senderId == client.user.id) return;

  const [command, banId] = message.content.split(" ");

  if (command == "!ban") {
    let isWhitelisted = false;

    const botGuilds = Array.from(client.guilds.cache);

    for (let [id, guild] of botGuilds) {
      if (whitelist.includes(id)) {
        const member = await guild.members.fetch(senderId);

        if (
          member &&
          member.hasPermission(Discord.Permissions.FLAGS.BAN_MEMBERS)
        ) {
          isWhitelisted = true;
          break;
        }
      }
    }

    if (!isWhitelisted) {
      message.reply("You do not have permission to interact with this bot");
      console.log(`User: ${senderId} attempted to use ban command`);
      admin.dmChannel.send(`User: ${senderId} attempted to use ban command`);
      return;
    }

    client.guilds.cache.forEach((guild) => {
      guild.members
        .ban(banId, {
          days: 1,
          reason: `${botBanReason} direct message by Brett`,
        })
        .catch((error) => {
          console.log(error);
          return true;
        })
        .then((error) => {
          if (error) {
            message.reply("There was an error");
          } else {
            message.reply(`Banned from ${guild.name}`);
          }
        });
    });
  }
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
        .catch((error) => {
          console.log(error);
        });
    }
  });
});

client.login(process.env.TOKEN).catch(() => {
  console.log("Error logging in");
  process.exit(1);
});
