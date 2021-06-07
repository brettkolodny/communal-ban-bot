# communal-ban-bot

The purpose of this bot is to propogate bans that originate on whitelisted servers to all other servers the bot is on.

For tightknit communities that have the same community guidelines this can greatly decrease both the amount of work individual servers need to do and also the time it takes to respond to scams.

**Note**: Instances of this bot are monitored and unauthorized use of it is reported.

## Commands

- `!ban [--username] <ids> <reason>`

  - Bans the user with the given IDs and inserts the given reason into the ban. The reason field is optional.

  - If the `--username` flag is given it will ban all users with the same usernames as the users with the IDs you provided.

- `!unban <id> <reason>`

  - Unbans the user with the given ID and inserts the given reason into the unban. The reason field is optional.

- `!raid --server <server id> --user <user id> --before <time before> --after <time after>`

  - Bans all users in the server given from `<server id>` that joined at the same time as `<user id>`.

    - `<time before>` is the number of minutes before `<user id>` joined to include in the raid.

    - `<time after>` is the number of minutes after `<user id>` joined to include in the raid.

  - If you do not have the ban privilege on any of the whitelisted servers the admin will be notified that you tried to use the bot.

- `!servers`

  - Lists all of the servers the bot is on.
