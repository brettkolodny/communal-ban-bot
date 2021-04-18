import * as Discord from "discord.js";

export const pendingCommands: Map<ID, Command> = new Map();

export type ID = string;

export interface RecentUser {
  id: ID;
  timeJoined: Date;
}

export enum CommandType {
  BAN,
  UNBAN,
}

export interface Command {
  banIds: ID[];
  reason: string;
  type: CommandType;
}

export type BanSource = Discord.Message | Discord.Guild;
