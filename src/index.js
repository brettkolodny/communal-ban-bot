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

  const [command, arg] = message.content.trim().split(" ");

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
      message.reply(`Banning from ${guild.name}`);

      guild.members
        .ban(arg, {
          days: 1,
          reason: `${botBanReason} command by ${message.author.username}, ID: ${senderId}`,
        })
        .catch((error) => {
          message.reply(`There was an error banning from ${guild.name}`);
          console.log(error);
        });
    });
  } else if (command == "!help") {
    if (arg == "ban") {
      message.reply(
        "\n**Useage**\n" +
          "This bot works passively by listening for bans on whitelisted servers and then performing the same ban on all other servers it is on.\n\n" +
          "Additionally you can ban any user whether they are on your server or not by using the `ban!` command.\n" +
          "To use the command, send this bot a direct message with the format: ```ban! <user id>```\n" +
          "A users's ID can be obtained by turning on `Developer Mode` at `Settings -> Appearances -> Advanced -> Developer Mode`\n" +
          "After that, you can right click a user and click `Copy ID` to get their unique ID.\n" +
          "\n**NOTE**\n" +
          "This bot is monitored. All bans performed by this bot are logged and any attempts to use this pot without permission are reported."
      );
    } else if (arg == "servers") {
    } else {
      message.reply(
        "**Available Commands**\n\n" +
          "`!ban <id>`\n" +
          "`!servers`\n" +
          "`!help ban`\n" +
          "\n**NOTE**\n" +
          "This bot is monitored. All bans performed by this bot are logged and any attempts to use this pot without permission are reported."
      );
    }
  } else if (command == "!servers") {
    const servers = [];

    for (let [_, guild] of Array.from(client.guilds.cache)) {
      servers.push(guild.name);
    }

    const serversList =
      servers.length > 0 ? servers.join("\n") : "This bot is in no servers";

    message.reply(serversList);
  } else {
    message.reply(
      "**This is the Communal Mod bot!**\n" +
        "The goal of this bot is to help fight scammers by making it so a scammer only needs to be banned on one server to automatically be banned on all the servers this bot is on.\n" +
        "Enter `!help` for help\n" +
        "\n**NOTE**\n" +
        "This bot is monitored. All bans performed by this bot are logged and any attempts to use this pot without permission are reported."
    );
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
