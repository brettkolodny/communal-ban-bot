import * as Discord from "discord.js";
import { isWhitelisted } from "./utility";
import { ID, CommandType, Command, pendingCommands } from "./types";
import { getUsersJoinedAt } from "./utility";

const adminId = process.env["ADMIN"];

if (!adminId) {
  console.log("Invalid Admin ID");
  process.exit(1);
}

export async function banCommand(
  client: Discord.Client,
  message: Discord.Message,
  args: string[],
  senderId: ID
) {
  const admin = new Discord.User(client, { id: adminId as string });
  if (!(await isWhitelisted(client, senderId))) {
    message.reply("You do not have permission to interact with this bot");
    console.log(`User: ${senderId} attempted to use ban command`);

    if (admin.dmChannel) {
      admin.dmChannel.send(`User: ${senderId} attempted to use ban command`);
    }
    return;
  }

  let idPattern = /\d{18}/;

  let banIds = [];
  let reason;

  for (let i = 0; i < args.length; i++) {
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

  pendingCommands.set(senderId, { banIds, reason, type: CommandType.BAN });

  let usersToBan = "";

  for (let id of banIds) {
    const user = new Discord.User(client, { id: id });
    usersToBan += user.toString() + " ";
  }

  const replyMessage = `Are you sure you want to ban ${usersToBan}?\ntype [y]es to confirm or anything else to cancel.`;
  
  if (replyMessage.length > 2000) {
    message.reply(`Too many users to display! Are you sure you want to ban ${banIds.length} users?\ntype [y]es to confirm or anything else to cancel.`);
  } else {
    message.reply(replyMessage);
  }
}

export async function raidCommand(
  client: Discord.Client,
  message: Discord.Message,
  args: string[],
  senderId: ID
) {
  const admin = new Discord.User(client, { id: adminId as string });

  if (!(await isWhitelisted(client, senderId))) {
    message.reply("You do not have permission to interact with this bot");
    console.log(`User: ${senderId} attempted to use raid command`);

    if (admin.dmChannel) {
      admin.dmChannel.send(`User: ${senderId} attempted to use raid command`);
    }

    return;
  }

  let idPattern = /\d{18}/;
  let [guildId, banId, start, end] = args;

  if (!idPattern.test(guildId) || !idPattern.test(banId)) {
    message.reply("Invalid Guild ID or User ID");
    return;
  }

  let startTime: number = parseInt(start);
  let endTime: number = parseInt(end);

  if (!(startTime && endTime)) {
    message.reply("Start and end time must be numbers");
    return;
  }

  let guild: Discord.Guild;

  try {
    guild = new Discord.Guild(client, { id: guildId });
  } catch {
    message.reply("Could not resolve guild from ID");
    return;
  }

  let joinTime: Date;

  try {
    const user = await guild.members.fetch(banId);

    const time = user ? user.joinedAt : null;

    if (time) {
      joinTime = time;
    } else {
      message.reply("Could not find users time joined");
      return;
    }
  } catch {
    message.reply("Member is not in that guild");
    return;
  }

  message.reply(
    "Searching for users to ban. If you're running this on a large guild it may take a while"
  );
  let banIds = await getUsersJoinedAt(
    client,
    guildId,
    joinTime,
    startTime,
    endTime
  );

  if (banIds.length == 0) {
    message.reply("No users joined at this time");
    return;
  }

  pendingCommands.set(senderId, {
    banIds,
    reason: "Banned during raid",
    type: CommandType.BAN,
  });

  let usersToBan = "";

  for (const id of banIds) {
    usersToBan += ` ${new Discord.User(client, { id: id }).toString()}`;
  }

  const replyMessage = `Are you sure you want to ban${usersToBan}?\ntype [y]es to confirm or anything else to cancel.`;

  if (replyMessage.length > 2000) {
    message.reply(`Too many users to display! Are you sure you want to ban ${banIds.length} users?\ntype [y]es to confirm or anything else to cancel.`);
  } else {
    message.reply(replyMessage);
  }
}

export async function usernameCommand(
  client: Discord.Client,
  message: Discord.Message,
  args: string[],
  senderId: ID
) {
  const admin = new Discord.User(client, { id: adminId as string });
  if (!(await isWhitelisted(client, senderId))) {
    message.reply("You do not have permission to interact with this bot");
    console.log(`User: ${senderId} attempted to use username command`);

    if (admin.dmChannel) {
      admin.dmChannel.send(
        `User: ${senderId} attempted to use username command`
      );
    }
    return;
  }

  let idPattern = /\d{18}/;
  let banId = args[0];

  if (!idPattern.test(banId)) {
    message.reply("Invalid ID");
    return;
  }

  pendingCommands.set(senderId, {
    banIds: [banId],
    reason: "Banned for username",
    type: CommandType.BAN,
  });

  const user = new Discord.User(client, { id: banId });
  message.reply(
    `Are you sure you want to ban all users with the same username as ${user.toString()}?\ntype [y]es to confirm or anything else to cancel.`
  );
}

export async function unbanCommand(
  client: Discord.Client,
  message: Discord.Message,
  args: string[],
  senderId: ID
) {
  const admin = new Discord.User(client, { id: adminId as string });
  if (!(await isWhitelisted(client, senderId))) {
    message.reply("You do not have permission to interact with this bot");
    console.log(`User: ${senderId} attempted to use unban command`);

    if (admin.dmChannel) {
      admin.dmChannel.send(`User: ${senderId} attempted to use ban command`);
    }

    return;
  }

  let idPattern = /\d{18}/;

  let banIds = [];
  let reason;

  for (let i = 0; i < args.length; i++) {
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

  pendingCommands.set(senderId, { banIds, reason, type: CommandType.UNBAN });

  let usersToBan = "";

  for (let id of banIds) {
    const user = new Discord.User(client, { id: id });
    usersToBan += user.toString() + " ";
  }

  const replyMessage = `Are you sure you want to unban ${usersToBan}?\ntype [y]es to confirm or anything else to cancel.`;
  
  if (replyMessage.length > 2000) {
    message.reply(`Too many users to display! Are you sure you want to unban ${banIds.length} users?\ntype [y]es to confirm or anything else to cancel.`);
  } else {
    message.reply(replyMessage);
  }
}

export async function helpCommand(message: Discord.Message, args: string[]) {
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
        "This bot is monitored. All bans performed by this bot are logged and any attempts to use this bot without permission are reported."
    );
  } else if (args[0] == "username") {
    message.reply(
      "\n**Useage**\n" +
        "To use this command, send the bot a direct message with the format ```!username <user id>```\n" +
        "This will ban all users with similar names on all of the servers the bot is on.\n" +
        "A users's ID can be obtained by turning on `Developer Mode` at `Settings -> Appearances -> Advanced -> Developer Mode`\n" +
        "After that, you can right click a user and click `Copy ID` to get their unique ID.\n" +
        "\n**NOTE**\n" +
        "This bot is monitored. All bans performed by this bot are logged and any attempts to use this bot without permission are reported."
    );
  } else if (args[0] == "unban") {
    message.reply(
      "\n**Useage**\n" +
        "To use the command, send this bot a direct message with the format: ```!ban <user id> <reason>```\n" +
        "You can give one or more `<user id>`\n" +
        "`<reason>` is optional.\n\n" +
        "A users's ID can be obtained by turning on `Developer Mode` at `Settings -> Appearances -> Advanced -> Developer Mode`\n" +
        "After that, you can right click a user and click `Copy ID` to get their unique ID.\n" +
        "\n**NOTE**\n" +
        "This bot is monitored. All bans performed by this bot are logged and any attempts to use this bot without permission are reported."
    );
  } else if (args[0] == "raid") {
    message.reply(
      "\n**Useage**\n" +
        "To use the command, send this bot a direct message with the format : ```!ban <server id> <user id> <before> <after>```\n" +
        "`<server id>` is the guild where the ban is happening\n" +
        "`<user id>` is a user in the raid, their time joined is anchor for the command\n" +
        "`<befor>` is the number of minutes before the provided user joined to also search for users to ban\n" +
        "`<after>` is the number of minutes after the provided useer joined to also search for users to ban\n" +
        "\n**NOTE**\n" +
        "This bot is monitored. All bans performed by this bot are logged and any attempts to use this bot without permission are reported."
    );
  } else {
    message.reply(
      "**Available Commands**\n\n" +
        "`!ban <user id> <reason>`\n" +
        "`!unban <user id> <reason>`\n" +
        "`!username <user id>`\n" +
        "`!raid <server id> <user id> <before> <after>`\n" +
        "`!servers`\n" +
        "`!help ban`\n" +
        "`!help username`\n" +
        "\n**NOTE**\n" +
        "This bot is monitored. All bans performed by this bot are logged and any attempts to use this bot without permission are reported."
    );
  }
}

export async function serversCommand(
  client: Discord.Client,
  message: Discord.Message
) {
  const servers = [];

  for (let [_, guild] of Array.from(client.guilds.cache)) {
    servers.push(guild.name);
  }

  const serversList =
    servers.length > 0 ? servers.join("\n") : "This bot is in no servers";

  message.reply(serversList);
}
