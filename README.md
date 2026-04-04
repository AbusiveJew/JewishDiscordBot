start the bot
powershell : node index.js


the bot includes server protecting features and much more

1. Discord application (Developer Portal)
Create an application and a Bot user.
Copy the bot token → goes in .env as BOT_TOKEN (never commit it).
Under Privileged Gateway Intents, turn on at least:
Message Content Intent (commands read message text).
Server Members Intent (member-related features).
Generate an invite URL with permissions the bot needs (moderation, channels, roles, etc.—often people use Administrator while testing, then tighten later).
2. Environment file (required)
Copy .env.example → .env and fill in:

Variable	Required?	What it’s for
BOT_TOKEN
Yes
Bot login token from the portal.
OWNER_USERNAME
Yes*
Your Discord username (lowercase match), same field the API uses as user.username—the account that can run owner commands.
PREFIX
No
Command prefix; default is $ if omitted.
AUTHORIZED_USERNAMES
No
Comma-separated extra usernames (optional @), same username matching as owner.
*Technically the code falls back to a default owner name if unset, but for a real server you should set OWNER_USERNAME to the real owner’s username.

3. Machine / project
Install Node.js (LTS is fine).
In the repo folder: npm install
Start: node index.js (or npm start if you add a script later).
4. In-server setup (after the bot is online)
These are not secrets; they’re usually configured in Discord (and saved to JSON on disk):

Ticket system — open/closed category IDs (via the bot’s setup flow / channel pickers).
Mod/audit logs channel — log channel set through the bot.
Protection (anti-spam, anti-link, etc.) — toggles/settings via bot commands.
Autorole — role chosen via bot so autorole.json gets a roleId.
Optional: a role named root — used so staff can see new ticket channels if that role exists.
5. Files that stay local / generated
.env — secrets only; should stay out of git (already in .gitignore).
blacklist.json — local data; gitignored; starts empty if missing.
