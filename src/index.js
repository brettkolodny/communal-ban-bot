const Discord = require("discord.js");
const whitelist = require("./whitelist");

const botBanReason = "Communal Mod: User was banned from";

const client = new Discord.Client();

const admin = new Discord.User(client, { id: process.env.ADMIN });

const pendingBans = new Map();

function banUser(banId, reason, source) {
  client.guilds.cache.forEach((guild) => {
    if (source.guild && source.guild.id == guild.id) return;

    if (source.message) {
      source.message.reply(`Banning from ${guild.name}`);
    }

    console.log(`Banning ${banId} from ${guild.name}`);

    guild.members
      .ban(banId, {
        days: 1,
        reason: `${botBanReason} ${
          source.message
            ? `command by ${source.message.author.username}<${source.message.author.id}>`
            : `${source.guild.name}`
        } Reason: ${reason}`,
      })
      .catch((error) => {
        message.reply(`There was an error banning from ${guild.name}`);
        console.log(`Error: ${error.code}`);
      });
  });
}

function banByUsername(banId, message) {
  message.reply("Searching for users to ban...");

  client.guilds.cache.forEach(async (guild) => {
    let user = await new Discord.User(client, { id: banId }).fetch();

    let users = await guild.members
      .fetch({ query: user.username, limit: 0, force: true })
      .catch((error) => {
        console.log(
          `No users with the same username as ${banId} in ${guild.name}`
        );
      });

    if (!users || users.size == 0) {
      message.reply(`No users with that username in ${guild.name}`);
      return;
    }

    users.forEach((user) => {
      banUser(user.id, "Banned for username", { message: message });
    });
  });
}

async function isWhitelisted(userId) {
  const botGuilds = Array.from(client.guilds.cache);

  for (let [id, guild] of botGuilds) {
    if (whitelist.includes(id)) {
      try {
        const member = await guild.members.fetch(userId);
        if (
          member &&
          member.hasPermission(Discord.Permissions.FLAGS.BAN_MEMBERS)
        ) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
  }

  return false;
}

client.on("ready", () => {
  console.log("Ready to ban");
});

client.on("message", async (message) => {
  if (message.channel.type != "dm") {
    return;
  }

  const senderId = message.author.id;

  if (senderId == client.user.id) return;

  const [command, ...args] = message.content.trim().split(" ");

  if (pendingBans.has(senderId)) {
    if (command.toLowerCase() == "y" || command.toLowerCase() == "yes") {
      const [banIds, reason] = pendingBans.get(senderId);

      if (reason == "Banned for username") {
        banByUsername(banIds[0], message);
      } else {
        banIds.forEach((banId) => {
          banUser(banId, reason, { message: message });
        });
      }
    } else {
      message.reply("Canceling ban");
    }

    pendingBans.delete(senderId);
    return;
  }

  if (command == "!ban") {
    if (!(await isWhitelisted(senderId))) {
      message.reply("You do not have permission to interact with this bot");
      console.log(`User: ${senderId} attempted to use ban command`);
      admin.dmChannel.send(`User: ${senderId} attempted to use ban command`);
      return;
    }

    let idPattern = /\d{18}/;

    let banIds = [];
    let reason;

    for (let i in args) {
      if (args[i] == "") {
        continue;
      } else if (idPattern.test(args[i])) {
        banIds.push(args[i]);
      } else {
        reason = args.slice(i);
        break;
      }
    }

    reason = reason ? reason.join(" ") : "No reason given";

    pendingBans.set(senderId, [banIds, reason]);

    let usersToBan = "";

    for (let id of banIds) {
      const user = new Discord.User(client, { id: id });
      usersToBan += user.toString() + " ";
    }

    message.reply(
      `Are you sure you want to ban ${usersToBan}?\ntype [y]es to confirm or anything else to cancel.`
    );

    return;
  } else if (command == "!username") {
    if (!(await isWhitelisted(senderId))) {
      message.reply("You do not have permission to interact with this bot");
      console.log(`User: ${senderId} attempted to use ban command`);
      admin.dmChannel.send(`User: ${senderId} attempted to use ban command`);
      return;
    }

    let idPattern = /\d{18}/;
    let banId = args[0];

    if (!idPattern.test(banId)) {
      message.reply("Invalid ID");
      return;
    }

    pendingBans.set(senderId, [[banId], "Banned for username"]);

    const user = new Discord.User(client, { id: banId });
    message.reply(
      `Are you sure you want to ban all users with the same username as ${user.toString()}?\ntype [y]es to confirm or anything else to cancel.`
    );
  } else if (command == "!help") {
    if (args[0] == "ban") {
      message.reply(
        "\n**Useage**\n" +
          "This bot works passively by listening for bans on whitelisted servers and then performing the same ban on all other servers it is on.\n\n" +
          "Additionally you can ban any user whether they are on your server or not by using the `!ban` command.\n" +
          "To use the command, send this bot a direct message with the format: ```!ban <user id> <reason>```\n" +
          "You can give one or more `<user id>`\n" +
          "`<reason>` is optional.\n\n" +
          "A users's ID can be obtained by turning on `Developer Mode` at `Settings -> Appearances -> Advanced -> Developer Mode`\n" +
          "After that, you can right click a user and click `Copy ID` to get their unique ID.\n" +
          "\n**NOTE**\n" +
          "This bot is monitored. All bans performed by this bot are logged and any attempts to use this pot without permission are reported."
      );
    } else if (args[0] == "username") {
      message.reply(
        "\n**Useage**\n" +
          "To use this command, send the bot a direct message with the format ```!username <user id>```\n" +
          "This will ban all users with similar names on all of the servers the bot is on.\n" +
          "A users's ID can be obtained by turning on `Developer Mode` at `Settings -> Appearances -> Advanced -> Developer Mode`\n" +
          "After that, you can right click a user and click `Copy ID` to get their unique ID.\n" +
          "\n**NOTE**\n" +
          "This bot is monitored. All bans performed by this bot are logged and any attempts to use this pot without permission are reported."
      );
    } else {
      message.reply(
        "**Available Commands**\n\n" +
          "`!ban <user id> <reason>`\n" +
          "`!username <user id>`\n" +
          "`!servers`\n" +
          "`!help ban`\n" +
          "`!help username`\n" +
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

  banUser(user.id, banReason ? banReason : "No reason given", {
    guild: guild,
  });
});

client.login(process.env.TOKEN).catch(() => {
  console.log("Error logging in");
  process.exit(1);
});
