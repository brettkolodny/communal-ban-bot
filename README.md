# communal-ban-bot

The purpose of this bot is to propogate bans that originate on whitelisted servers to all other servers the bot is on. 

For tightknit communities that have the same community guidelines this can greatly decrease both the amount of work individual servrs need to do and also the time it takes to respond to scams.

**Note**: Instances of this bot are monitored and unauthorized use of it is reported.

## Commands

- `!ban <id> <reason>`
  
  - Bans the user with the given ID and inserts the given reason into the ban. The reason field is optional.
  
  - The command will prompt you for confirmation of the ban and link the user you are trying to ban.
  
  - If you do not have the ban privilege on any of the whitelisted servers the admin will be notified that you tried to use the bot.

- `!help`
  
  - Lists the available commands.

- `!servers`

  - Lists all of the servers the bot is on.
  
## Running

1. Clone the repo and install the dependencies with `yarn`.

2. Set your `TOKEN`, and `ADMIN` environment variables.
  
  - `TOKEN` is the secret token for the bot and `ADMIN` is the user ID for the Admin of this bot.
  
3. Run the bot with `yarn start`.
  
