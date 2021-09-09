import { ServerSettings, CommunalMod } from "../src";
import dotenv from "dotenv";

dotenv.config({ path: "test/.env" });

if (
  !process.env.BOT_TOKEN ||
  !process.env.ADMIN_ID ||
  !process.env.SERVER_ID ||
  !process.env.CHANNEL_ID
) {
  process.exit(1);
}

const testServer = new ServerSettings(process.env.SERVER_ID, {
  whitelisted: true,
});
testServer.allowedChannel = process.env.CHANNEL_ID;

const mod = new CommunalMod(process.env.BOT_TOKEN, process.env.ADMIN_ID);
mod.addServer(testServer);

mod.login();
