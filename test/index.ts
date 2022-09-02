import { ServerSettings, CommunalMod } from "../src";
import dotenv from "dotenv";

dotenv.config({ path: "test/.env" });

if (
  !process.env.BOT_TOKEN ||
  !process.env.ADMIN_ID ||
  !process.env.SERVER_ID ||
  !process.env.CHANNEL_ID ||
  !process.env.BANNED_WORDS ||
  !process.env.JOINNUMBER_THRESHOLD ||
  !process.env.JOINTIME_THRESHOLD ||
  !process.env.NODE_ENV ||
  !process.env.NOTIFY_ID_LIST ||
  !process.env.RAID_BAN_RADIUS ||
  !process.env.WHITELISTED_ROLES ||
  !process.env.CLIENT_ID ||
  !process.env.NFT_VERIFY_METHOD_SIGNATURE ||
  !process.env.NFT_CONTRACT ||
  !process.env.NFT_ROLE_ID ||
  !process.env.NFT_TOKEN_ID
) {
  console.log(process.env.BOT_TOKEN);
  console.log(process.env.ADMIN_ID);
  console.log(process.env.SERVER_ID);
  console.log(process.env.CHANNEL_ID);
  console.log(process.env.BANNED_WORDS);
  console.log(process.env.JOINNUMBER_THRESHOLD);
  console.log(process.env.JOINTIME_THRESHOLD);
  console.log(process.env.NODE_ENV);
  console.log(process.env.NOTIFY_ID_LIST);
  console.log(process.env.RAID_BAN_RADIUS);
  console.log(process.env.WHITELISTED_ROLES);
  console.log(process.env.CLIENT_ID);
  console.log(process.env.NFT_VERIFY_METHOD_SIGNATURE);
  console.log(process.env.NFT_CONTRACT);
  console.log(process.env.NFT_ROLE_ID);
  console.log(process.env.NFT_TOKEN_ID);
  console.log("failing");
  process.exit(1);
}

const testServer = new ServerSettings(process.env.SERVER_ID, {
  whitelisted: true, blacklist: process.env.BANNED_WORDS.split(" ")
});

console.log("banned word list loaded: " + process.env.BANNED_WORDS)
testServer.allowedChannel = process.env.CHANNEL_ID;

const mod = new CommunalMod(process.env.BOT_TOKEN, process.env.ADMIN_ID);
mod.addServer(testServer);

mod.login();
