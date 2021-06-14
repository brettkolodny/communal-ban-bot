# communal-ban-bot

The purpose of this bot is to propogate bans that originate on whitelisted servers to all other servers the bot is on.

For tightknit communities that have the same community guidelines this can greatly decrease both the amount of work individual servers need to do and also the time it takes to respond to scams.

**Note**: Instances of this bot are monitored and unauthorized use of it is reported.

## Commands

- `!ban [--username] <ids> [--reason <reason>]`

  - Bans the user with the given IDs and inserts the given reason into the ban. The reason field is optional.

  - If the `--username` flag is given it will ban all users with the same usernames as the users with the IDs you provided.

- `!unban <id> [--reason <reason>]`

  - Unbans the user with the given ID and inserts the given reason into the unban. The reason field is optional.

- `!raid --server <server id> --user <user id> --before <time before> --after <time after>`

  - Bans all users in the server given from `<server id>` that joined at the same time as `<user id>`.

    - `<time before>` is the number of minutes before `<user id>` joined to include in the raid.

    - `<time after>` is the number of minutes after `<user id>` joined to include in the raid.

  - If you do not have the ban privilege on any of the whitelisted servers the admin will be notified that you tried to use the bot.

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
