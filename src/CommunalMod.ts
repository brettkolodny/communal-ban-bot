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

  constructor(token: string, adminId: string) {
    this.client = new Discord.Client();
    this.token = token;

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
    const description = users.map((user) => user.toString()).join(" ");

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
    const description = users.map((user) => user.toString()).join(" ");

    const response = new Discord.MessageEmbed();
    response.setTitle("**You will unban these users:**");
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

  async isWhitelisted(userId: string) {
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

    console.log("returning false");
    return false;
  }

  private async onMessage(message: Discord.Message) {
    if (message.channel.type != "dm") return;
    if (message.author.id === this.client.user!.id) return;

    if (!(await this.isWhitelisted(message.author.id))) {
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

    if (banCommandPattern.test(msgContent)) {
      this.banCommand(message);
    } else if (unbanCommandPattern.test(msgContent)) {
      this.unbanCommand(message);
    } else if (serverCommandPattern.test(msgContent)) {
      this.serverCommand(message);
    }
  }

  private async onGuildBanAdd(guild: Discord.Guild, user: Discord.User) {
    const server = this.servers.find(
      (server) => server.serverId === guild.id && server.whitelisted
    );

    if (server == undefined) {
      return;
    }

    const ban = await guild.fetchBan(user.id);

    if (!ban || (ban.reason && ban.reason.startsWith(MOD_REASON))) {
      return;
    }

    this.crossServerBan([user.id], { guild });
  }
}
