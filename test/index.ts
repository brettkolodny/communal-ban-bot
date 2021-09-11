import { ServerSettings, CommunalMod } from "../src";
import dotenv from "dotenv";

dotenv.config({ path: "test/.env" });

if (
  !process.env.BOT_TOKEN ||
  !process.env.ADMIN_ID ||
  !process.env.SERVER2_ID ||
  !process.env.SERVER1_ID ||
  !process.env.CHANNEL_ID
) {
  process.exit(1);
}

const testServer = new ServerSettings(process.env.SERVER1_ID, {
  whitelisted: true
});
testServer.allowedChannel = process.env.CHANNEL_ID;

const testServer2 = new ServerSettings(process.env.SERVER2_ID, { whitelisted: true });

const mod = new CommunalMod(process.env.BOT_TOKEN, process.env.ADMIN_ID);
mod.addServer(testServer);
mod.addServer(testServer2);

mod.login();
