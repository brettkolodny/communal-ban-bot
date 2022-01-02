# communal-ban-bot

The purpose of this bot is to propogate bans that originate on whitelisted servers to all other servers the bot is on.

For tightknit communities that have the same community guidelines this can greatly decrease both the amount of work individual servers need to do and also the time it takes to respond to scams.

**Note**: Instances of this bot are monitored and unauthorized use of it is reported.

## Commands

### Ban

- `!ban [--username] <ids> [--reason <reason>]`

   #### Example:
   ```
   !ban --username 872764606693642270 --reason scam
   ```

  - Bans the user with the given IDs and inserts the given reason into the ban. The reason field is optional.

  - If the `--username` flag is given it will ban all users with the same usernames as the users with the IDs you provided.
### Unban
- `!unban <id> [--reason <reason>]`

  - Unbans the user with the given ID and inserts the given reason into the unban. The reason field is optional.

### Raid
- `!raid --user <user id> --before <time before> --after <time after>`
   
   #### Example:
   ```
   !raid --user 872776790370836501 --before 0 --after 1
   ```

  - Bans all users in the server given from `<server id>` that joined at the same time as `<user id>`.

    - `<time before>` is the number of minutes before `<user id>` joined to include in the raid.

    - `<time after>` is the number of minutes after `<user id>` joined to include in the raid.

  - If you do not have the ban privilege on any of the whitelisted servers the admin will be notified that you tried to use the bot.

### Servers
- `!servers`

  - Lists all of the servers the bot is on.

## Setup

To set up your own Communal Mod all you have to do is define some servers and add them to an instance of the CommunalMod.

```js
// The ServerSettings constructor takes a server, 
// and an optional boolean for whether the server is whitelisted in the bot.
const server1 = new ServerSettings("server id here", true);

// Set optional username blacklist for a server.
server1.setBlacklist(["Scammer", "Real Airdrop", "Won't Steal Seed Phrase"]);

// The CommunalMod constructor takes a discord bot token, and the ID of the bot's admin.
const communalMod = new CommunalMod("bot token", "admin id here");

// Add the servers to the CommunalMod
communalMod.addServer(server1);

// Start the bot
communalMod.login()
```

## Environmental Variables

To run the test bot create a `.env` file with like the following:

```
BOT_TOKEN=<your bot secret token>
ADMIN_ID=<discord admin id for the person in charge of the box>
SERVER_ID=<discord server id>
CHANNEL_ID=<discord channel id>
BANNED_WORDS=<banned words in user names, delimited by space> 

Example: "hello world test"

JOINTIME_THRESHOLD=<the time period in seconds to count consecutive joins> 

Example: "30" 

JOINNUMBER_THRESHOLD=<threshold number of joins before the raid alert is triggered> 

Example: "3"

NODE_ENV=<set to 'prod' or 'test'> 

Example: "prod"

NOTIFY_ID_LIST=<ID's of people or roles to notify during a raid, delimited by space, Role ID's must be preceded by '&'> 

Example: "123231233 122312332 &232132323 &1232323233"

RAID_BAN_RADIUS=<time around the joining time of the user ID in the raid command to ban in minutes> 

Example: "1"

WHITELISTED_ROLES=<Role ID's to be excluded from name checking, delimited by space>

Examples: "123231233 122312332"

```

Then run `yarn start:dev` to start the bot.

## Tip The Author

Kusama: `G9UkyTC7C35TjKxcjKRjTHGhaXodUMSM5uAfM5b8Z2gEuUF`

Polkadot: `1yrUupBDQhkYArLViHHuTtHRCBKAZTTU6PUcFpiDUF58wes`
