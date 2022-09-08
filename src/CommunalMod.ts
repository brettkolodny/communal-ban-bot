import * as Discord from "discord.js";
import { Intents } from "discord.js";
import { ServerSettings } from "./ServerSettings";
import { ethers } from 'ethers';
import { SlashCommandSubcommandGroupBuilder } from "@discordjs/builders";
const { SlashCommandBuilder } = require('@discordjs/builders');
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
const NFT_verify_method_signature = process.env.NFT_VERIFY_METHOD_SIGNATURE
const NFT_contract = process.env.NFT_CONTRACT
const NFT_role_ID = process.env.NFT_ROLE_ID
const NFT_token_ID = process.env.NFT_TOKEN_ID


const providerRPC = {
  moonbeam: {
    name: 'moonbeam',
    rpc: 'https://rpc.api.moonbeam.network',
    chainId: 1284, // 0x507 in hex,
  },
};

const jsonrpcprovider = new ethers.providers.JsonRpcProvider(
  providerRPC.moonbeam.rpc,
  {
    chainId: providerRPC.moonbeam.chainId,
    name: providerRPC.moonbeam.name,
  }
)

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
    this.client = new Discord.Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_BANS, Intents.FLAGS.DIRECT_MESSAGES]
    });
    this.token = token;
    this.adminId = adminId;

    this.client.on("ready", () => {
      if (process.env.NODE_ENV != "prod") {
        console.log("Running in DEV");
      }


      const commands = [];

      const command_data = new SlashCommandBuilder()
        .setName('verifynft')
        .setDescription('Verify the ownership of your Moonbuilder Club NFT')
        .addStringOption((option: { setName: (arg0: string) => { (): any; new(): any; setDescription: { (arg0: string): { (): any; new(): any; setRequired: { (arg0: boolean): any; new(): any; }; }; new(): any; }; }; }) =>
          option.setName('address')
            .setDescription('The wallet that holds the Moonbuilder Club NFT')
            .setRequired(true))
        .addStringOption((option: { setName: (arg0: string) => { (): any; new(): any; setDescription: { (arg0: string): { (): any; new(): any; setRequired: { (arg0: boolean): any; new(): any; }; }; new(): any; }; }; }) =>
          option.setName('signature')
            .setDescription('The hexadecimal signed message of your Discord account name tag')
            .setRequired(true))

      const command_data2 = new SlashCommandBuilder()
        .setName('verifyhelp')
        .setDescription('Instructions for how to verify the ownership of your Moonbuilder Club NFT')

      commands.push(command_data.toJSON());
      commands.push(command_data2.toJSON());

      const rest = new REST({ version: '9' }).setToken(token);

      (async () => {
        try {
          console.log('Started refreshing application (/) commands.');


          await rest.put(
            Routes.applicationGuildCommands(client_id, guild_id),
            { body: commands },
          );

          console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
          console.error(error);
        }
      })();

      console.log("Ready to moderate");
    });

    this.client.on('interactionCreate', async interaction => {

      if (!interaction.isCommand()) return;


      // Verify NFT command logic
      if (interaction.commandName === 'verifynft') {
        //Input checking

        var signature = interaction.options.getString('signature');
        var wallet = interaction.options.getString('address');
        const plaintext = interaction.user.tag;
        var address = '';

        // if signature not prefixe by 0x, add 0x
        if (signature?.indexOf('0x') != 0){
          signature = '0x' + signature
        }
        // Check address formatting
        try {
          wallet = ethers.utils.getAddress(wallet!)
        }
        catch (err) {
          interaction.reply({ content: 'Address provided is not a valid H160 address.', ephemeral: true })
          return
        }
        //console.log(plaintext)
        //console.log(interaction.options.getString('signature'))
        try {
          address = ethers.utils.verifyMessage(plaintext, signature);
        }
        catch(err) {
          interaction.reply({ content: 'Signature provided is not a valid ECSDA signature.', ephemeral: true })
          return
        }
        //console.log(address)
        //console.log(wallet!)
        if (address.toLowerCase() === wallet!.toLowerCase()) {

          // Form the RPC request to check for NFT balance
          var request = {
                  "to" : NFT_contract,
                  //We generate the request payload here for the "balanceOf" method
                  "data": NFT_verify_method_signature + '000000000000000000000000' + address.substring(2) + '000000000000000000000000000000000000000000000000000000000000000' + NFT_token_ID
           }; 

          var response;

          try {
            response = await jsonrpcprovider.send("eth_call", [request, "latest"]); 
          }
          catch (err){
            console.log("RPC request failed.")
            interaction.reply({ content: 'Failed to verify on-chain, please try again later.', ephemeral: true })
            return
          }

          if (Number(response) > 0) {
            const member = await interaction.guild?.members.fetch(interaction.user.id)
            var role = interaction.guild?.roles.cache.find(r => r.id === NFT_role_ID);
            member?.roles.add(role!)
            interaction.reply({ content: 'Congratulations! Your Moonbuilder NFT has been verified and you now have the Moonbuilder-pioneer role and all the associated access!', ephemeral: true })
          } else
          {
            interaction.reply({ content: 'Your signature matches, but your wallet address does not have the Moonbuilder NFT. If you believe this is a mistake, please contact an admin.', ephemeral: true })
          }
        }
        else {
          interaction.reply({ content: 'Your signature does not match with the provided address.', ephemeral: true })
          return
        }
      }
      
      //Process the Verify Help command
      if (interaction.commandName === 'verifyhelp') {
          let embed = new Discord.MessageEmbed()
            .setTitle("How to Verify Your Moonbuilder Club NFT")
            .setDescription("To verify your Moonbuilder Social Club NFT, you need to generate a signed message with the same wallet address that you have the Moonbuilder Badge NFT token on. \n\n The signing can be done on [Moonscan's Verified Signature Page](https://moonscan.io/verifiedSignatures). For more detailed instructions on generating the signed message, please check the [tutorial](https://docs.google.com/document/d/1OctlbjKPu8tMZYTrYoBfQ9mC27IbJ1hruLPu_EvftX8/edit?usp=sharing) here. \n\n The message you need to sign is your Discord account tag, which is: \n\n " + "```" + interaction.user.tag + "```" +"\n\n "+"After you have created the signed message, you can proceed to use the `/verifynft` bot slash command to verify your ownership and receive the Moonbuilder Club role.");
          interaction.reply({ embeds: [embed] })
      }
    });

    this.client.on("messageCreate", (message) => this.onMessage(message));

    this.client.on("guildBanAdd", async (ban) =>
    {
        this.onGuildBanAdd(ban.guild, ban.user)

    });  

    this.client.on("guildMemberAdd", (member) =>
      this.onGuildMemberAdd(member)
  );

    this.client.on("guildMemberUpdate", (_, member) =>
    {
        this.onGuildMemberUpdate(member)
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

      options.message.reply({ embeds: [response]});
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

      options.message.reply({embeds: [response]});
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

    message.reply({embeds: [response]});
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
  
      message.reply({ embeds: [response] });
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

    message.reply({ embeds: [response] });
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

    message.reply({ embeds: [response] });
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

    message.reply({ embeds: [response] });
  }

  private sendError(message: Discord.Message, error: string) {
    const response = new Discord.MessageEmbed();
    response.setTitle("**Error**");
    response.setDescription(error);
    response.setColor(0xff0000);
    message.reply({ embeds: [response] });
  }

  async userIsModOfGuild(userId: string, guild: string | Discord.Guild): Promise<boolean> {
    if (typeof(guild) === "string") {
      const guildInstance = this.client.guilds.cache.find(g => g.id === guild);
      if (!guildInstance) return false;
      guild = guildInstance
    }

    try {
      const member = await guild.members.fetch(userId);
      if (member && member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) return true;
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
              member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)
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

        dmChannel.send({ embeds: [response] });
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
        message.reply({ embeds: [response] });
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

      message.reply({ embeds: [response] });
    }
  }

  private async onGuildBanAdd(guild: Discord.Guild, user: Discord.User) {
    const server = this.servers.find( 
      (server) => server.serverId === guild.id && server.whitelisted
    );

    if (!server) {
      return;
    }

    const ban = await guild.bans.fetch(user.id);

    if (!ban || (ban.reason && ban.reason.startsWith(MOD_REASON))) {
      return;
    }

    this.crossServerBan([user.id], ban.reason!, { guild });
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
