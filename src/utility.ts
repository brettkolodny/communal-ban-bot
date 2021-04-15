import * as Discord from "discord.js";
import { ID } from "./types";
import { whitelist } from "./whitelist";
import axios, { AxiosRequestConfig } from "axios";
import { BanSource } from "./types";

const BOT_BAN_REASON = "Communal Mod: User was banned from";

export async function isWhitelisted(client: Discord.Client, userId: ID) {
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

export async function getUsersJoinedAt(
  client: Discord.Client,
  guildId: ID,
  time: Date,
  min: number,
  max: number
): Promise<ID[]> {
  const config: AxiosRequestConfig = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${client.token}`,
    },
  };

  let users: [ID, Date][] = [];

  let highestId: ID | null = null;
  while (true) {
    try {
      const endpoint = highestId
        ? `https://discord.com/api/v8/guilds/${guildId}/members?limit=1000&after=${highestId}`
        : `https://discord.com/api/v8/guilds/${guildId}/members?limit=1000`;

      await new Promise((resolve) => setTimeout(resolve, 1000));
      const res = await axios.get(endpoint, config);

      if (res.status != 200) continue;

      users = users.concat(
        (res.data as Array<any>).map((value) => {
          const joinedAt = new Date(value["joined_at"]);
          joinedAt.setMilliseconds(0);
          const id: string = value["user"]["id"];

          return [id, joinedAt];
        })
      );

      if (res.data.length < 1000) {
        break;
      }

      highestId = users[users.length - 1][0];
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  let minDate = new Date(time.getTime());
  minDate.setMinutes(minDate.getMinutes() - min);

  let maxDate = new Date(time.getTime());
  maxDate.setMinutes(maxDate.getMinutes() + max);

  return users
    .filter(([_, timeJoined]) => {
      if (minDate <= timeJoined && timeJoined <= maxDate) {
        return true;
      } else {
        return false;
      }
    })
    .map(([id, _]) => {
      return id;
    });
}

export function banUser(
  client: Discord.Client,
  banId: ID,
  reason: string,
  source: BanSource
): void {
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

export function unbanUser(
  client: Discord.Client,
  banId: ID,
  reason: string,
  message: Discord.Message
) {
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

export async function banByUsername(
  client: Discord.Client,
  banId: ID,
  message: Discord.Message
) {
  await message.reply("Banning users by username...");

  let numUsersBanned = 0;
  const replyMessage = await message.reply(`Total bans: ${numUsersBanned}`);

  client.guilds.cache.forEach(async (guild) => {
    let user = await new Discord.User(client, { id: banId }).fetch();

    let users = await guild.members
      .fetch({ query: user.username, limit: 500, force: true })
      .catch((error) => {
        console.log(error)
      });

    if (!users || users.size == 0) {
      message.reply(`No users with that username in ${guild.name}`);
      return;
    }

    users.forEach((user) => {
      banUser(client, user.id, "Banned for username", message);
      replyMessage.edit(`Total bans: ${++numUsersBanned}`);
    });
  });
}
