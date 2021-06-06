import * as Discord from "discord.js";
import ServerSettings from "./ServerSettings";

const MOD_REASON = "Operation by Communal Mod:";
const MESSAGE_COLOR = 0xc2a2e9;

enum CommandType {
  BAN = 0,
  UNBAN,
}

interface PendingBans {
  ids: string[];
  commandType: CommandType;
}

interface BanOptions {
  guild?: Discord.Guild;
  message?: Discord.Message;
}

export default class CommunalMod {
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
    options?: BanOptions
  ) {
    let reason: string = "";

    if (options) {
      if (options?.guild) {
        reason = `${MOD_REASON} banned from ${options.guild.name}`;
      } else if (options?.message) {
        reason = `${MOD_REASON} banned by ${options.message.author.username}#${options.message.author.discriminator}`;
      }
    }

    if (process.env.NODE_ENV === "prod") {
      try {
        guild.members.ban(id, { reason, days: 7 });
      } catch (error) {
        if (options && options.message) {
          this.sendError(
            options.message,
            `Was unable to ban ${id} from ${guild.name} (${guild.id})`
          );
        }
        console.log(error);
      }
    } else {
      console.log(`DEV: Banning ${id} on ${guild.name}`);
      console.log(`-> REASON: ${reason}\n`);
    }
  }

  private async unbanUser(
    guild: Discord.Guild,
    id: string,
    options?: BanOptions
  ) {
    let reason: string = "";

    if (options) {
      if (options?.guild) {
        reason = `${MOD_REASON} unbanned from ${options.guild.name}`;
      } else if (options?.message) {
        reason = `${MOD_REASON} unbanned by ${options.message.author.username}#${options.message.author.discriminator}`;
      }
    }

    if (process.env.NODE_ENV === "prod") {
      try {
        guild.members.unban(id, reason);
      } catch (error) {
        if (options && options.message) {
          this.sendError(
            options.message,
            `Was unable to ban ${id} from ${guild.name} (${guild.id})`
          );
        }
        console.log(error);
      }
    } else {
      console.log(`DEV: Banning ${id} on ${guild.name}`);
      console.log(`-> REASON: ${reason}\n`);
    }
  }

  private crossServerBan(ids: string[], options?: BanOptions) {
    ids.forEach((id) => {
      this.client.guilds.cache.forEach((guild) => {
        if (options && options.guild && options.guild.id === guild.id) {
          return;
        }

        this.banUser(guild, id, options);
      });
    });

    if (options && options.message) {
      const response = new Discord.MessageEmbed();
      response.setTitle("**All Bans Processed**");
      response.setColor(MESSAGE_COLOR);

      options.message.reply(response);
    }
  }

  private crossServerUnban(ids: string[], options?: BanOptions) {
    ids.forEach((id) => {
      this.client.guilds.cache.forEach((guild) => {
        if (options && options.guild && options.guild.id === guild.id) {
          return;
        }

        this.unbanUser(guild, id, options);
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
      ids = Array.from(
        (
          await guild.members.fetch({
            query: user.username,
            limit: 500,
            force: true,
          })
        ).map((member) => member.id)
      );
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

    let ids = message.content.match(idPattern);
    if (!ids) {
      this.sendError(message, "One or more IDs required");
      return;
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
        users.push(user);
      } catch {}
    }

    this.pendingBans.set(message.author.id, {
      ids,
      commandType: CommandType.BAN,
    });

    let description = users.map((user) => user.toString()).join(" ");
    description = description.length < 2000 ? description : `Too many users to show, you will ban ${users.length} users.`;

    const response = new Discord.MessageEmbed();
    response.setTitle("**You will ban these users:**");
    response.setDescription(description);
    response.setFooter("Types [y]es to confirm or anything else to cancel");
    response.setColor(MESSAGE_COLOR);

    message.reply(response);
  }

  private async unbanCommand(message: Discord.Message) {
    const idPattern = /\d{18}/g;

    const ids = message.content.match(idPattern);
    if (!ids) {
      this.sendError(message, "One or more IDs required");
      return;
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
    });

    let description = users.map((user) => user.toString()).join(" ");
    description = description.length < 2000 ? description : `Too many users to show, you will unban ${users.length} users.`;

    const response = new Discord.MessageEmbed();
    response.setTitle("**You will unban these users:**");
    response.setDescription(description);
    response.setFooter("Types [y]es to confirm or anything else to cancel");
    response.setColor(MESSAGE_COLOR);

    message.reply(response);
  }

  private async raidCommand(message: Discord.Message, serverId: string, userId: string, before: string, after: string) {
    const beforeTime = parseInt(before);
    const afterTime = parseInt(after);

    let member: Discord.GuildMember;
    let guild = this.client.guilds.cache.find((guild) => guild.id === serverId);

    if (!guild) {
      this.sendError(message, "This bot is not on the given server");
      return;
    }

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

    const ids = allUsers.filter(member => member.joinedAt! >= minDate && member.joinedAt! <= maxDate).map(member => member.id);

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
    description = description.length < 2000 ? description : `Too many users to show, you will ban ${users.length} users.`;

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

  async userIsWhitelisted(userId: string) {
    const botGuilds = Array.from(this.client.guilds.cache);

    for (let [id, guild] of botGuilds) {
      for (let serverSettings of this.servers) {
        if (serverSettings.serverId === id && serverSettings.whitelisted) {
          const member = await guild.members.fetch(userId);
          if (
            member &&
            member.hasPermission(Discord.Permissions.FLAGS.BAN_MEMBERS)
          ) {
            return true;
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
      }
      const dmChannel = admin.dmChannel;

      if (dmChannel) {
        const response = new Discord.MessageEmbed();
        response.setTitle("**Unauthorized Bot Usage**");
        response.setDescription(
          `Non-whitelisted user ${user ? user : userId} attempted to use this bot`
        );
        response.setColor(0xff0000);

        dmChannel.send(response);
      }
    });

    return false;
  }

  private async onMessage(message: Discord.Message) {
    if (message.channel.type != "dm") return;
    if (message.author.id === this.client.user!.id) return;

    if (!(await this.userIsWhitelisted(message.author.id))) {
      this.sendError(
        message,
        "You are not permitted to use this bot.\nThe admin has been notified"
      );

      return;
    }

    const msgContent = message.content.toLowerCase();

    const pendingBans = this.pendingBans.get(message.author.id);
    if (pendingBans) {
      if (/\s*(yes|y)\s*/g.test(msgContent)) {
        const { ids, commandType } = pendingBans;
        if (commandType == CommandType.BAN) {
          this.crossServerBan(ids, { message });
        } else if (commandType == CommandType.UNBAN) {
          this.crossServerUnban(ids, { message });
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

    const banCommandPattern = /\s*!ban (--username\s+)?(\d{18}\s*)+/g;
    const serverCommandPattern = /\s*!servers\s*/g;
    const unbanCommandPattern = /\s*!unban (\d{18}\s*)+/g;
    const raidCommandPattern = /\s*!raid\s+--server\s+(\d{18})\s+--user\s+(\d{18})\s+--before\s+(\d+)\s+--after\s+(\d+)\s*/;

    if (banCommandPattern.test(msgContent)) {
      this.banCommand(message);
    } else if (unbanCommandPattern.test(msgContent)) {
      this.unbanCommand(message);
    } else if (serverCommandPattern.test(msgContent)) {
      this.serverCommand(message);
    } else if (raidCommandPattern.test(msgContent)) {
      const raidCommandExec = raidCommandPattern.exec(msgContent);
      if (raidCommandExec) {
        const [_, server, user, before, after] = raidCommandExec;
        this.raidCommand(message, server, user, before, after);
      }
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

    this.crossServerBan([user.id], { guild });
  }

  private async onGuildMemberAddOrUpdate(member: Discord.GuildMember) {
    const server = this.servers.find(
      (server) => server.serverId === member.guild.id
    );

    if (!server) {
      return;
    }

    for (const word of server.blacklist) {
      if (member.user.username.includes(word)) {
        member
          .ban({ days: 7, reason: "Username on Communal Mod server blacklist" })
          .catch((error) => {
            console.log(error);
          });
      }
    }
  }
}
