import * as Discord from "discord.js";
import { ServerSettings } from "./ServerSettings";
import { replaceEvilLetters } from "./utils";

const MOD_REASON = "Operation by Communal Mod:";
const MESSAGE_COLOR = 0xc2a2e9;

enum CommandType {
  BAN = 0,
  UNBAN,
}

interface PendingBans {
  ids: string[];
  commandType: CommandType;
  reason?: string;
}

interface BanOptions {
  guild?: Discord.Guild;
  message?: Discord.Message;
}

export class CommunalMod {
  private client: Discord.Client;
  private token: string;
  private servers: ServerSettings[] = [];
  private pendingBans: Map<string, PendingBans> = new Map();
  private adminId: string;

  constructor(token: string, adminId: string) {
    this.client = new Discord.Client();
    this.token = token;
    this.adminId = adminId;

    this.client.on("ready", () => {
      if (process.env.NODE_ENV != "prod") {
        console.log("Running in DEV");
      }

      console.log("Ready to moderate");
    });

    this.client.on("message", (message) => this.onMessage(message));

    this.client.on("guildBanAdd", (guild, user) =>
      this.onGuildBanAdd(guild, user)
    );

    this.client.on("guildMemberAdd", (member) =>
      this.onGuildMemberAddOrUpdate(member)
    );

    this.client.on("guildMemberUpdate", (_, member) =>
      this.onGuildMemberAddOrUpdate(member)
    );
  }

  public addServer(server: ServerSettings) {
    this.servers.push(server);
  }

  public login() {
    this.client.login(this.token);
  }

  private async banUser(
    guild: Discord.Guild,
    id: string,
    givenReason?: string,
    options?: BanOptions
  ) {
    let reason = "";
    givenReason = givenReason ? givenReason : "No reason given";

    if (!options || !options.message) {
      const server = this.servers.find(
        (server) => server.serverId === guild.id
      );
      if (server && !server.acceptAllBans) return;
    }

    if (options) {
      if (options?.guild) {
        reason = `${MOD_REASON} banned from ${options.guild.name} for reason: ${givenReason}`;
      } else if (options?.message) {
        reason = `${MOD_REASON} banned by ${options.message.author.username}#${options.message.author.discriminator} for reason: ${givenReason}`;
      }
    }

    if (process.env.NODE_ENV === "prod") {
      guild.members.ban(id, { reason, days: 7 }).catch((error) => {
        if (options && options.message) {
          this.sendError(
            options.message,
            `Was unable to ban ${id} from ${guild.name} (${guild.id})`
          );
        }
        console.log(error);
      });
    } else {
      console.log(`DEV: Banning ${id} on ${guild.name}`);
      console.log(`-> REASON: ${reason}\n`);
    }
  }

  private async unbanUser(
    guild: Discord.Guild,
    id: string,
    givenReason?: string,
    options?: BanOptions
  ) {
    let reason: string = "";
    givenReason = givenReason ? givenReason : "No reason given";

    if (options) {
      if (options?.guild) {
        reason = `${MOD_REASON} unbanned from ${options.guild.name} for reason: ${givenReason}`;
      } else if (options?.message) {
        reason = `${MOD_REASON} unbanned by ${options.message.author.username}#${options.message.author.discriminator} for reason: ${givenReason}`;
      }
    }

    if (process.env.NODE_ENV === "prod") {
      guild.members.unban(id, reason).catch((error) => {
        if (options && options.message) {
          this.sendError(
            options.message,
            `Was unable to ban ${id} from ${guild.name} (${guild.id})`
          );
        }
        console.log(error);
      });
    } else {
      console.log(`DEV: Unbanning ${id} on ${guild.name}`);
      console.log(`-> REASON: ${reason}\n`);
    }
  }

  private crossServerBan(ids: string[], reason?: string, options?: BanOptions) {
    ids.forEach((id) => {
      this.client.guilds.cache.forEach((guild) => {
        if (options && options.guild && options.guild.id === guild.id) {
          return;
        }

        this.banUser(guild, id, reason, options);
      });
    });

    if (options && options.message) {
      const response = new Discord.MessageEmbed();
      response.setTitle("**All Bans Processed**");
      response.setColor(MESSAGE_COLOR);

      options.message.reply(response);
    }
  }

  private crossServerUnban(
    ids: string[],
    reason?: string,
    options?: BanOptions
  ) {
    ids.forEach((id) => {
      this.client.guilds.cache.forEach((guild) => {
        if (options && options.guild && options.guild.id === guild.id) {
          return;
        }

        this.unbanUser(guild, id, reason, options);
      });
    });

    if (options && options.message) {
      const response = new Discord.MessageEmbed();
      response.setTitle("**All Unbans Processed**");
      response.setColor(MESSAGE_COLOR);

      options.message.reply(response);
    }
  }

  private async getUserIdsByName(
    message: Discord.Message,
    guildId: string,
    userId: string
  ): Promise<string[]> {
    let ids: string[] = [];

    let guild: Discord.Guild;
    try {
      guild = await this.client.guilds.fetch(guildId);
    } catch (error) {
      console.log(error);
      this.sendError(message, `Could not retrieve server with ID: ${guildId}`);
      return ids;
    }

    let user: Discord.User;
    try {
      user = await this.client.users.fetch(userId);
    } catch (error) {
      console.log(error);
      this.sendError(
        message,
        `Could not retrieve username of user with ID: ${userId}`
      );
      return ids;
    }

    try {
      const givenUsername = user.username.trim().toLowerCase();
      ids = (await guild.members.fetch())
        .filter(
          (member) =>
            member.user.username.trim().toLowerCase() === givenUsername
        )
        .map((member) => member.id);
    } catch (error) {
      console.log(error);
      this.sendError(
        message,
        `Could not retrieve users from server with ID: ${guildId}`
      );
    }

    return ids;
  }

  private serverCommand(message: Discord.Message) {
    const guildNames: string[] = [];

    for (const [_, guild] of this.client.guilds.cache) {
      guildNames.push(guild.name);
    }

    const description = guildNames.map((name) => `- ${name}`).join("\n");
    const response = new Discord.MessageEmbed();
    response.setTitle("Servers");
    response.setDescription(description);
    response.setColor(MESSAGE_COLOR);

    message.reply(response);
  }

  private async banCommand(message: Discord.Message) {
    const idPattern = /\d{18}/g;
    const usernamePattern = /--username\s*/g;
    const reasonPattern = /--reason\s*.*/g;

    let modServers: Discord.Guild[] = [];

    for (const [_, guild] of this.client.guilds.cache) {
      if (await this.userIsModOfGuild(message.author.id, guild)) {
        modServers.push(guild);
      }
    }

    let ids = message.content.match(idPattern);
    if (!ids) {
      this.sendError(message, "One or more IDs required");
      return;
    }

    let reason: string | undefined = undefined;
    if (reasonPattern.test(message.content)) {
      const reasonMatch = message.content.match(reasonPattern);

      if (reasonMatch) {
        reason = reasonMatch[0].split(" ").slice(1).join(" ");
      }
    }

    const users: Discord.User[] = [];

    if (usernamePattern.test(message.content)) {
      let newIds: string[] = [];
      for (const id of ids) {
        for (const server of this.servers) {
          newIds = ids.concat(
            await this.getUserIdsByName(message, server.serverId, id)
          );
        }
      }

      ids = newIds;
    }

    for (const id of ids) {
      try {
        const user = await this.client.users.fetch(id);

        let canBan = false;
        for (const guild of modServers) {
          try {
            const member = await guild.members.fetch(user);

            if (member) {
              users.push(user);
              canBan = true;
              break;
            }
          } catch {}
        }

        if (!canBan) {
          this.sendError(message, `You do not have permission to ban ${user}`);
        }
      } catch {}
    }

    if (users.length == 0) {
      const response = new Discord.MessageEmbed();
      response.setTitle("**No users to ban**");
      response.setColor(MESSAGE_COLOR);

      message.reply(response);
      return;
    }

    this.pendingBans.set(message.author.id, {
      ids,
      commandType: CommandType.BAN,
      reason,
    });

    let description = users.map((user) => user.toString()).join(" ");
    description =
      description.length < 2000
        ? description
        : `Too many users to show, you will ban ${users.length} users.`;

    const response = new Discord.MessageEmbed();
    response.setTitle("**You will ban these users:**");
    response.setDescription(description);
    response.setFooter("Types [y]es to confirm or anything else to cancel");
    response.setColor(MESSAGE_COLOR);

    message.reply(response);
  }

  private async unbanCommand(message: Discord.Message) {
    const idPattern = /\d{18}/g;
    const reasonPattern = /--reason\s*.*/g;

    const ids = message.content.match(idPattern);
    if (!ids) {
      this.sendError(message, "One or more IDs required");
      return;
    }

    let reason: string | undefined = undefined;
    if (reasonPattern.test(message.content)) {
      const reasonMatch = message.content.match(reasonPattern);

      if (reasonMatch) {
        reason = reasonMatch[0].split(" ").slice(1).join(" ");
      }
    }

    const users: Discord.User[] = [];

    for (const id of ids) {
      try {
        const user = await this.client.users.fetch(id);
        users.push(user);
      } catch (error) {
        this.sendError(message, `Unable to fetch user with ID: ${id}`);
        console.log(error);
      }
    }

    this.pendingBans.set(message.author.id, {
      ids,
      commandType: CommandType.UNBAN,
      reason,
    });

    let description = users.map((user) => user.toString()).join(" ");
    description =
      description.length < 2000
        ? description
        : `Too many users to show, you will unban ${users.length} users.`;

    const response = new Discord.MessageEmbed();
    response.setTitle("**You will unban these users:**");
    response.setDescription(description);
    response.setFooter("Types [y]es to confirm or anything else to cancel");
    response.setColor(MESSAGE_COLOR);

    message.reply(response);
  }

  private async raidCommand(
    message: Discord.Message,
    serverId: string,
    userId: string,
    before: string,
    after: string
  ) {
    let guild = this.client.guilds.cache.find((guild) => guild.id === serverId);

    if (!guild) {
      this.sendError(message, "This bot is not on the given server");
      return;
    }

    if (!(await this.userIsModOfGuild(message.author.id, guild))) {
      this.sendError(message, `You are not a moderator of ${guild.name}`);
      return;
    }

    const beforeTime = parseInt(before);
    const afterTime = parseInt(after);

    let member: Discord.GuildMember;

    try {
      member = await guild.members.fetch(userId);
    } catch (error) {
      console.log(error);
      this.sendError(message, "Could not retrieve given user");
      return;
    }

    const memberJoinTime = member!.joinedAt;

    if (!memberJoinTime) {
      this.sendError(message, "Could not retrieve given user's join time");
      return;
    }

    let minDate = new Date(memberJoinTime.getTime());
    minDate.setMinutes(minDate.getMinutes() - beforeTime);

    let maxDate = new Date(memberJoinTime.getTime());
    maxDate.setMinutes(maxDate.getMinutes() + afterTime);

    const allUsers = await guild.members.fetch();

    const ids = allUsers
      .filter(
        (member) => member.joinedAt! >= minDate && member.joinedAt! <= maxDate
      )
      .map((member) => member.id);

    const users: Discord.User[] = [];

    for (const id of ids) {
      try {
        const user = await this.client.users.fetch(id);
        users.push(user);
      } catch (error) {
        this.sendError(message, `Unable to fetch user with ID: ${id}`);
        console.log(error);
      }
    }

    this.pendingBans.set(message.author.id, {
      ids,
      commandType: CommandType.BAN,
    });

    let description = users.map((user) => user.toString()).join(" ");
    description =
      description.length < 2000
        ? description
        : `Too many users to show, you will ban ${users.length} users.`;

    const response = new Discord.MessageEmbed();
    response.setTitle("**You will ban these users:**");
    response.setDescription(description);
    response.setFooter("Types [y]es to confirm or anything else to cancel");
    response.setColor(MESSAGE_COLOR);

    message.reply(response);
  }

  private sendError(message: Discord.Message, error: string) {
    const response = new Discord.MessageEmbed();
    response.setTitle("**Error**");
    response.setDescription(error);
    response.setColor(0xff0000);
    message.reply(response);
  }

  async userIsModOfGuild(
    userId: string,
    guild: string | Discord.Guild
  ): Promise<boolean> {
    if (typeof guild === "string") {
      const guildInstance = this.client.guilds.cache.find(
        (g) => g.id === guild
      );
      if (!guildInstance) return false;
      guild = guildInstance;
    }

    try {
      const member = await guild.members.fetch(userId);
      if (member && member.hasPermission(Discord.Permissions.FLAGS.BAN_MEMBERS))
        return true;
    } catch {}

    return false;
  }

  async userIsWhitelisted(userId: string) {
    const botGuilds = Array.from(this.client.guilds.cache);

    for (let [id, guild] of botGuilds) {
      for (let serverSettings of this.servers) {
        if (serverSettings.serverId === id && serverSettings.whitelisted) {
          try {
            const member = await guild.members.fetch(userId);
            if (
              member &&
              member.hasPermission(Discord.Permissions.FLAGS.BAN_MEMBERS)
            ) {
              return true;
            }
          } catch (error) {
            console.log(error);
          }
        }
      }
    }

    this.client.users.fetch(this.adminId).then(async (admin) => {
      let user: Discord.User | null = null;

      try {
        user = await this.client.users.fetch(userId);
      } catch (error) {
        console.log(error);
        console.log("Could not DM Admin");
      }
      const dmChannel = admin.dmChannel;

      if (dmChannel) {
        const response = new Discord.MessageEmbed();
        response.setTitle("**Unauthorized Bot Usage**");
        response.setDescription(
          `Non-whitelisted user ${
            user ? user : userId
          } attempted to use this bot`
        );
        response.setColor(0xff0000);

        dmChannel.send(response);
      }
    });

    return false;
  }

  private async onMessage(message: Discord.Message) {
    if (message.author.id === this.client.user!.id) return;

    const pendingBans = this.pendingBans.get(message.author.id);

    if (message.guild) {
      const server = this.servers.find((server) => {
        if (message.guild?.id && message.guild.id === server.serverId) {
          return server.allowedChannel === message.channel.id;
        }

        return false;
      });

      if (!server) return;
      if (!pendingBans && !message.content.startsWith("!")) return;
    }

    if (!(await this.userIsWhitelisted(message.author.id))) {
      this.sendError(
        message,
        "You are not permitted to use this bot.\nThe admin has been notified"
      );

      return;
    }

    const msgContent = message.content.toLowerCase();

    if (pendingBans) {
      if (/\s*(yes|y)\s*/g.test(msgContent)) {
        const { ids, commandType, reason } = pendingBans;
        if (commandType == CommandType.BAN) {
          this.crossServerBan(ids, reason, { message });
        } else if (commandType == CommandType.UNBAN) {
          this.crossServerUnban(ids, reason, { message });
        }
      } else {
        const response = new Discord.MessageEmbed();
        response.setTitle("**Canceling Command**");
        response.setColor(MESSAGE_COLOR);
        message.reply(response);
      }

      this.pendingBans.delete(message.author.id);
      return;
    }

    const banCommandPattern =
      /\s*!ban (--username\s+)?(\d{18}\s*)+(--reason\s*.*)?/g;
    const serverCommandPattern = /\s*!servers\s*/g;
    const unbanCommandPattern = /\s*!unban (\d{18}\s*)+/g;

    let raidCommandPattern =
      /\s*!raid\s+--server\s+(\d{18})\s+--user\s+(\d{18})\s+--before\s+(\d+)\s+--after\s+(\d+)\s*/;

    if (message.channel.type != "dm") {
      raidCommandPattern =
        /\s*!raid\s+--user\s+(\d{18})\s+--before\s+(\d+)\s+--after\s+(\d+)\s*/;
    }

    if (banCommandPattern.test(msgContent)) {
      this.banCommand(message);
    } else if (unbanCommandPattern.test(msgContent)) {
      this.unbanCommand(message);
    } else if (serverCommandPattern.test(msgContent)) {
      this.serverCommand(message);
    } else if (raidCommandPattern.test(msgContent)) {
      const raidCommandExec = raidCommandPattern.exec(msgContent);
      if (raidCommandExec) {
        if (message.channel.type === "dm") {
          const [_, server, user, before, after] = raidCommandExec;
          this.raidCommand(message, server, user, before, after);
        } else {
          const [_, user, before, after] = raidCommandExec;
          this.raidCommand(
            message,
            message.channel.guild.id,
            user,
            before,
            after
          );
        }
      }
    } else {
      const response = new Discord.MessageEmbed();
      response.setTitle("**Invalid Command**");
      response.setDescription(
        `This command does not match any known commands.
        Please visit the [repo](https://github.com/brettkolodny/communal-ban-bot) for more information on bot usage.`
      );
      response.setColor(0xff0000);

      message.reply(response);
    }
  }

  private async onGuildBanAdd(guild: Discord.Guild, user: Discord.User) {
    const server = this.servers.find(
      (server) => server.serverId === guild.id && server.whitelisted
    );

    if (!server) {
      return;
    }

    const ban = await guild.fetchBan(user.id);

    if (!ban || (ban.reason && ban.reason.startsWith(MOD_REASON))) {
      return;
    }

    this.crossServerBan([user.id], ban.reason, { guild });
  }

  private async onGuildMemberAddOrUpdate(member: Discord.GuildMember) {
    const server = this.servers.find(
      (server) => server.serverId === member.guild.id
    );

    if (!server) {
      return;
    }

    if (server.whitelist.includes(member.user.id)) {
      return;
    }

    const username = member.user.username.toLowerCase();
    for (const word of server.blacklist) {
      const sanitizedUsername = replaceEvilLetters(username);
      if (sanitizedUsername.includes(word.toLowerCase())) {
        console.log(
          `Banning ${username} from ${server.serverId} due to blacklist`
        );

        if (process.env.NODE_ENV === "prod") {
          member
            .ban({ days: 7, reason: `${MOD_REASON} Username on blacklistcd` })
            .catch((error) => {
              console.log(error);
            });
        }

        break;
      }
    }
  }
}
