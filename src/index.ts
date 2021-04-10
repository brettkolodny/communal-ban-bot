import * as Discord from "discord.js";
import { whitelist } from "./whitelist";

type ID = string;

interface RecentUser {
  id: ID;
  timeJoined: Date;
}

enum CommandType {
  BAN,
  UNBAN,
}

interface Command {
  banIds: ID[];
  reason: string;
  type: CommandType;
}

type BanSource = Discord.Message | Discord.Guild;

const BOT_BAN_REASON = "Communal Mod: User was banned from";

const client = new Discord.Client();
const admin = new Discord.User(client, { id: process.env.ADMIN });

const pendingCommands: Map<ID, Command> = new Map();

const recentJoins: Map<ID, RecentUser[]> = new Map();

for (const server of whitelist) {
  recentJoins.set(server, []);
}

function getUsersJoinedAt(
  guildId: ID,
  time: Date,
  min: number,
  max: number
): ID[] {
  let minDate = new Date(time.getTime());
  minDate.setMinutes(minDate.getMinutes() - min);

  let maxDate = new Date(time.getTime());
  maxDate.setMinutes(maxDate.getMinutes() + max);

  let banIds = recentJoins
    .get(guildId)
    ?.filter(
      ({ id: id, timeJoined: timeJoined }) =>
        minDate <= timeJoined && timeJoined <= maxDate
    )
    .map(({ id: id }) => id);

  return banIds ? banIds : [];
}

function banUser(banId: ID, reason: string, source: BanSource): void {
  client.guilds.cache
    .filter(
      (guild) =>
        (source instanceof Discord.Guild && source.id != guild.id) ||
        source instanceof Discord.Message
    )
    .forEach((guild) => {
      guild.members
        .ban(banId, {
          days: 1,
          reason: `${BOT_BAN_REASON} ${
            source instanceof Discord.Message
              ? `command by ${source.author.username}<${source.author.id}>`
              : `${source.name}`
          } Reason: ${reason}`,
        })
        .catch((error) => {
          console.log(`Error: ${error.code}`);

          if (source instanceof Discord.Message) {
            const user = new Discord.User(client, { id: banId });
            source.reply(
              `There was an error banning ${user.toString()} from ${guild.name}`
            );
          }
        });
    });
}

function unbanUser(banId: ID, reason: string, message: Discord.Message) {
  reason = `Communal Mod: User was unbanned from command by ${message.author.username}<${message.author.id}> Reason: ${reason}`;
  client.guilds.cache.forEach((guild) => {
    message.reply(`Unbanning ${banId} from ${guild.name}`);
    console.log(`Unbanning ${banId} from ${guild.name}`);

    guild.members.unban(banId, reason).catch((error) => {
      message.reply(`There was an error unbanning from ${guild.name}`);
      console.log(`Error: ${error.code}`);
    });
  });
}

async function banByUsername(banId: ID, message: Discord.Message) {
  const replyMessage = await message.reply("Banning users by username...");
  let numUsersBanned = 0;

  client.guilds.cache.forEach(async (guild) => {
    let user = await new Discord.User(client, { id: banId }).fetch();

    let users = await guild.members
      .fetch({ query: user.username, limit: 1000, force: true })
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
      banUser(user.id, "Banned for username", message);
      numUsersBanned++;
    });
  });

  replyMessage.edit(`Total bans: ${++numUsersBanned}`);
}

async function isWhitelisted(userId: ID) {
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

client.on("guildMemberAdd", (member) => {
  if (recentJoins.has(member.guild.id)) {
    const joins = recentJoins.get(member.guild.id) as RecentUser[];
    joins.push({
      id: member.id,
      timeJoined: member.joinedAt ? member.joinedAt : new Date(),
    });

    if (joins.length > 1000) {
      joins.slice(-500);
    }
  }
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
            banByUsername(banIds[0], message);
          } else {
            const replyMessage = await message.reply("Banning user(s)");
            banIds.forEach((banId) => {
              banUser(banId, reason, message);
            });
            replyMessage.edit("User(s) banned");
          }
          break;
        case CommandType.UNBAN:
          banIds.forEach((banId) => {
            unbanUser(banId, reason, message);
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
    if (!(await isWhitelisted(senderId))) {
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

    message.reply(
      `Are you sure you want to ban ${usersToBan}?\ntype [y]es to confirm or anything else to cancel.`
    );

    return;
  } else if (command == "!raid") {
    if (!(await isWhitelisted(senderId))) {
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

    let startTime: number;
    let endTime: number;
    try {
      startTime = parseInt(start);
      endTime = parseInt(end);
    } catch {
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
      const time = guild.member(banId)?.joinedAt;

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

    let banIds = getUsersJoinedAt(guildId, joinTime, startTime, endTime);

    pendingCommands.set(senderId, {
      banIds,
      reason: "Banned during raid",
      type: CommandType.BAN,
    });

    let usersToBan = "";

    for (const id of banIds) {
      usersToBan += ` ${new Discord.User(client, { id: id }).toString()}`;
    }

    message.reply(`Are you sure you want to ban${usersToBan}?`);
  } else if (command == "!username") {
    if (!(await isWhitelisted(senderId))) {
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
  } else if (command == "!unban") {
    if (!(await isWhitelisted(senderId))) {
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

    message.reply(
      `Are you sure you want to unban ${usersToBan}?\ntype [y]es to confirm or anything else to cancel.`
    );

    return;
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
    } else if (args[0] == "unban") {
      message.reply(
        "\n**Useage**\n" +
          "To use the command, send this bot a direct message with the format: ```!ban <user id> <reason>```\n" +
          "You can give one or more `<user id>`\n" +
          "`<reason>` is optional.\n\n" +
          "A users's ID can be obtained by turning on `Developer Mode` at `Settings -> Appearances -> Advanced -> Developer Mode`\n" +
          "After that, you can right click a user and click `Copy ID` to get their unique ID.\n" +
          "\n**NOTE**\n" +
          "This bot is monitored. All bans performed by this bot are logged and any attempts to use this pot without permission are reported."
      );
    } else {
      message.reply(
        "**Available Commands**\n\n" +
          "`!ban <user id> <reason>`\n" +
          "`!unban <user id> <reason>\n" +
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
  if (
    banReason &&
    banReason.slice(0, BOT_BAN_REASON.length) == BOT_BAN_REASON
  ) {
    return;
  }

  banUser(user.id, banReason ? banReason : "No reason given", guild);
});

client.login(process.env.TOKEN).catch(() => {
  console.log("Error logging in");
  process.exit(1);
});
