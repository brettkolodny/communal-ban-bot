import * as Discord from "discord.js";
import { ServerSettings } from "./ServerSettings";
const { Routes } = require('discord-api-types/v9');
const fs = require('node:fs');
const { REST } = require('@discordjs/rest');

const MOD_REASON = "Operation by Communal Mod:";
const MESSAGE_COLOR = 0xc2a2e9;
const startTime = new Date();
let lastJoinTime = startTime
let consecutiveJoins = 0
let activeRaid = false
const adminChannelId = process.env.CHANNEL_ID
const jointime_threshold = process.env.JOINTIME_THRESHOLD
const joinnumber_threshold = process.env.JOINNUMBER_THRESHOLD
const notify_id_array = process.env.NOTIFY_ID_LIST!.split(" ")
const raid_ban_radius = process.env.RAID_BAN_RADIUS
const whitelisted_roles = process.env.WHITELISTED_ROLES!.split(" ")
const client_id = process.env.CLIENT_ID
const guild_id = process.env.SERVER_ID

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

      const commands = [];
      const commandFiles = fs.readdirSync('./src/commands').filter((file: string) => file.endsWith('.js'));

      // Place your client and guild ids here
      const clientId = client_id;
      const guildId = guild_id;

      for (const file of commandFiles) {
        const command = require(`./src/commands/${file}`);
        commands.push(command.data.toJSON());
      }

      const rest = new REST({ version: '9' }).setToken(token);

      (async () => {
        try {
          console.log('Started refreshing application (/) commands.');

          await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
          );

          console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
          console.error(error);
        }
      })();

      console.log("Ready to moderate");
    });

    this.client.on("message", (message) => this.onMessage(message));

    this.client.on("guildBanAdd", (guild, user) =>
    {
      if (user instanceof Discord.User){
        this.onGuildBanAdd(guild, user)
      }
    }
    );  

    this.client.on("guildMemberAdd", (member) =>
      this.onGuildMemberAdd(member)
  );

    this.client.on("guildMemberUpdate", (_, member) =>
    {
      if (member instanceof Discord.User) {
        this.onGuildMemberUpdate(member)
      }
    }
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
      const server = this.servers.find((server) => server.serverId === guild.id);
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
    userId: string,
    before: string,
    after: string
  ) {
    let guild = this.client.guilds.cache.find((guild) => guild.id === process.env.SERVER_ID!);

    if (!guild) {
      this.sendError(message, "This bot is not on the given server");
      return;
    }

    if (!await this.userIsModOfGuild(message.author.id, guild)) {
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

  async userIsModOfGuild(userId: string, guild: string | Discord.Guild): Promise<boolean> {
    if (typeof(guild) === "string") {
      const guildInstance = this.client.guilds.cache.find(g => g.id === guild);
      if (!guildInstance) return false;
      guild = guildInstance
    }

    try {
      const member = await guild.members.fetch(userId);
      if (member && member.hasPermission(Discord.Permissions.FLAGS.BAN_MEMBERS)) return true;
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
    const raidCommandPattern =
      /\s*!raid\s+--user\s+(\d{18})\s+--before\s+(\d+)\s+--after\s+(\d+)\s*/;

    if (banCommandPattern.test(msgContent)) {
      this.banCommand(message);
    } else if (unbanCommandPattern.test(msgContent)) {
      this.unbanCommand(message);
    } else if (serverCommandPattern.test(msgContent)) {
      this.serverCommand(message);
    } else if (raidCommandPattern.test(msgContent)) {
      const raidCommandExec = raidCommandPattern.exec(msgContent);
      if (raidCommandExec) {
        const [_, user, before, after] = raidCommandExec;
        this.raidCommand(message, user, before, after);
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

  private async onGuildMemberAdd(member: Discord.GuildMember) {

    this.RaidCheck(member.guild.id, member.id);
    this.checkName(member)
  }

  private async onGuildMemberUpdate(member: Discord.GuildMember){
    this.checkName(member)
  }

  private async checkName(member: Discord.GuildMember){

    const server = this.servers.find(
      (server) => server.serverId === member.guild.id
    );

    let guild = this.client.guilds.cache.find((guild) => guild.id === process.env.SERVER_ID!);

    if (!server) {
      console.log("Cannot find server.")
      return;
    }

    if (!guild) {
      console.log("This bot is not on the given server")
      return;
    }

    if (server.whitelist.includes(member.user.id) 
        || await this.userIsModOfGuild(member.id, guild
        || member.roles.cache.some(role => whitelisted_roles.includes(role.id)))) {
      return;
    }

    const username = member.user.username.toLowerCase();
    const servername = member.displayName.toLowerCase();

    for (const word of server.blacklist) {
      if (username.includes(word) || servername.includes(word)) {
        member
          .ban({ days: 7, reason: `${MOD_REASON} Username or server display name includes a word from the blacklist.` })
          .catch((error) => {
            console.log(error);
          });
      }
    }

  }

  private async RaidCheck(serverId: string, memberID: string) {

    const adminChannel = this.getChannel(serverId, adminChannelId!)
    const currentTime = new Date();
    const elapsedTime = currentTime.getTime() - lastJoinTime.getTime()
  
    //console.log(jointime_threshold)
    //console.log(joinnumber_threshold)
    console.log(`current time = ` + currentTime.getTime())
  
    const timeDiff = elapsedTime / 1000;
  
    // get seconds
    const seconds = Math.round(timeDiff);
    console.log(`elapsed time = ` + seconds + " seconds");
  
    if (seconds < +jointime_threshold!) {
      consecutiveJoins++
      console.log(`I saw a consectutive join`)
  
      if (consecutiveJoins > +joinnumber_threshold! && !activeRaid) {
        activeRaid = true
        console.log(`I saw more than ` + joinnumber_threshold! + ` consecutive joins!`)

        let message_text = `Possible Raid Alert: ` + joinnumber_threshold! + ` accounts or more accounts joined in ` + jointime_threshold! + ` seconds`

        notify_id_array.forEach(function (item, index) {
          message_text += '<@'+ item + '>';
        });
        adminChannel.send(message_text)
        //adminChannel.send(`Possible Raid Alert: ` + joinnumber_threshold! + ` accounts or more accounts joined in ` + jointime_threshold! + `seconds <@&748920690106826894> <@&748920030074372217>`)
        //adminChannel.send(`A MASS DM SPAMBOT MIGHT BE JOINING OUR SERVER! <@831914514064474172> <@382638955411013636> <@823601445689491496> <@&748920690106826894> <@&748920030074372217>`)
        adminChannel.send(`Can someone please monitor the arrivals-lounge channel and use the raid command to ban these accounts? The user that joined last has the ID: `+ "`" + memberID + "`" +`.`)
        adminChannel.send(`The raid command format is: `)
        adminChannel.send("```" + "!raid --user "+ memberID +" --before " +raid_ban_radius!+ " --after " + raid_ban_radius! +"```")
        
      }
    } else {
      console.log(`Re-setting join detector` + consecutiveJoins)
      consecutiveJoins = 0
      activeRaid = false
    }
  
    lastJoinTime = currentTime
  
    return
  }

  private getChannel(serverId: string, channelId: string) {
    const server = this.client.guilds.cache.get(serverId)
    if (server === undefined) throw new Error(`Bot not joined to server.`)
    const channel = server.channels.cache.find(channel => channel.id === channelId)
    //console.log("Channel id is: "+ channelId)
    if (!(channel instanceof Discord.TextChannel)) throw new Error(`Join log channel is not a text channel.`)
    return channel
  }
}
