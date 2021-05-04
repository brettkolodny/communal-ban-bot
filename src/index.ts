import * as Discord from "discord.js";
import { whitelist } from "./whitelist";
import {
  banCommand,
  serversCommand,
  unbanCommand,
  usernameCommand,
  helpCommand,
  raidCommand,
} from "./commands";
import { pendingCommands, CommandType } from "./types";
import { banByUsername, banUser, unbanUser } from "./utility";

const BOT_BAN_REASON = "Communal Mod: User was banned from";

const client = new Discord.Client();

client.on("ready", () => {
  console.log("Ready to ban");
});

client.on("message", async (message) => {
  if (message.channel.type != "dm") {
    return;
  }

  const senderId = message.author.id;

  if (client.user != null && senderId == client.user.id) return;

  const [command, ...args] = message.content.trim().split(" ");

  if (pendingCommands.has(senderId)) {
    if (command.toLowerCase() == "y" || command.toLowerCase() == "yes") {
      const command = pendingCommands.get(senderId);

      if (command == undefined) {
        pendingCommands.delete(senderId);
        return;
      }

      const { banIds, reason, type } = command;

      if (!banIds || banIds.length == 0) {
        message.reply("No users to ban");
        return;
      }

      switch (type) {
        case CommandType.BAN:
          if (reason == "Banned for username") {
            banByUsername(client, banIds[0], message);
          } else {
            const replyMessage = await message.reply("Banning user(s)");
            banIds.forEach((banId) => {
              banUser(client, banId, reason, message);
            });
            replyMessage.edit("User(s) banned");
          }
          break;
        case CommandType.UNBAN:
          banIds.forEach((banId) => {
            unbanUser(client, banId, reason, message);
          });
          break;
      }
    } else {
      message.reply("Canceling ban");
    }

    pendingCommands.delete(senderId);
    return;
  }

  if (command == "!ban") {
    banCommand(client, message, args, senderId);
  } else if (command == "!raid") {
    raidCommand(client, message, args, senderId);
  } else if (command == "!username") {
    usernameCommand(client, message, args, senderId);
  } else if (command == "!unban") {
    unbanCommand(client, message, args, senderId);
  } else if (command == "!help") {
    helpCommand(message, args);
  } else if (command == "!servers") {
    serversCommand(client, message);
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
  if (!whitelist.has(guild.id)) {
    return;
  }

  const banReason = (await guild.fetchBan(user)).reason;
  if (
    banReason &&
    banReason.slice(0, BOT_BAN_REASON.length) == BOT_BAN_REASON
  ) {
    return;
  }

  banUser(client, user.id, banReason ? banReason : "No reason given", guild);
});

client.on("guildMemberAdd", (member) => {
  if (!whitelist.has(member.guild.id)) {
    return;
  }

  const blackList = whitelist.get(member.guild.id)?.blackList;

  if (blackList) {
    const username = member.user.username;

    for (const name of blackList) {
      if (username.toLowerCase().includes(name)) {
        member.ban(
          { 
            days: 7,
            reason: `${BOT_BAN_REASON}: Username on ${member.guild.name} blacklist`
          }
        ).catch(error => {
          console.log(`Error: ${error.code}`);
        });
      }
    }
  }
});


client.login(process.env.TOKEN).catch(() => {
  console.log("Error logging in");
  process.exit(1);
});
