// Load and validate config

import dotenv from "dotenv";

dotenv.config({ path: "test/.env" });
assert_configuration_ok();

// Configure Moonbeam & Tanssi servers

import { ServerSettings, CommunalMod, TanssiCommunalMod } from "../src";

const moonbeamServer = new ServerSettings(process.env.MOONBEAM_SERVER_ID!, {
  whitelisted: true, 
  blacklist: process.env.MOONBEAM_BANNED_WORDS!.split(" "),
  allowedChannel: process.env.MOONBEAM_CHANNEL_ID!
});

const tanssiServer = new ServerSettings(process.env.TANSSI_SERVER_ID!, {
  whitelisted: true, 
  blacklist: process.env.TANSSI_BANNED_WORDS!.split(" "),
  allowedChannel: process.env.TANSSI_CHANNEL_ID!
});

// Run bot

const mod = new CommunalMod(process.env.MOONBEAM_BOT_TOKEN!, process.env.MOONBEAM_ADMIN_ID!);
mod.addServer(moonbeamServer);
mod.login();

const modTanssi = new TanssiCommunalMod(process.env.TANSSI_BOT_TOKEN!, process.env.TANSSI_ADMIN_ID!);
modTanssi.addServer(tanssiServer);
modTanssi.login();

console.log("This is the end");

// Support functions

function assert_configuration_ok() {
  let moonbeam_is_valid = validate_moonbeam();

  if (!moonbeam_is_valid) {
    console.log("Moonbeam config is not valid, Check env values");
    console.log(process.env);  
    process.exit(1);
  }
  
  // let tanssi_is_valid = validate_tanssi();
  
  // if (!tanssi_is_valid) {
  //   console.log("Tanssi config is not valid, Check env values");
  //   console.log(process.env);  
  //   process.exit(1);
  // }

}

function validate_moonbeam(): boolean {

  return 'MOONBEAM_BOT_TOKEN' in process.env &&
      'MOONBEAM_ADMIN_ID' in process.env &&
      'MOONBEAM_SERVER_ID' in process.env &&
      'MOONBEAM_CHANNEL_ID' in process.env &&
      'MOONBEAM_BANNED_WORDS' in process.env &&
      'MOONBEAM_JOINNUMBER_THRESHOLD' in process.env &&
      'MOONBEAM_JOINTIME_THRESHOLD' in process.env &&
      'MOONBEAM_NODE_ENV' in process.env &&
      'MOONBEAM_NOTIFY_ID_LIST' in process.env &&
      'MOONBEAM_RAID_BAN_RADIUS' in process.env &&
      'MOONBEAM_WHITELISTED_ROLES' in process.env &&
      'MOONBEAM_CLIENT_ID' in process.env;
}

function validate_tanssi(): boolean {

  return 'TANSSI_BOT_TOKEN' in process.env &&
    'TANSSI_ADMIN_ID' in process.env &&
    'TANSSI_SERVER_ID' in process.env &&
    'TANSSI_CHANNEL_ID' in process.env &&
    'TANSSI_BANNED_WORDS' in process.env &&
    'TANSSI_JOINNUMBER_THRESHOLD' in process.env &&
    'TANSSI_JOINTIME_THRESHOLD' in process.env &&
    'TANSSI_NODE_ENV' in process.env &&
    'TANSSI_NOTIFY_ID_LIST' in process.env &&
    'TANSSI_RAID_BAN_RADIUS' in process.env &&
    'TANSSI_WHITELISTED_ROLES' in process.env &&
    'TANSSI_CLIENT_ID' in process.env;

}