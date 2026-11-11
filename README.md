# 🛡️ Discord Automated Anti-Spam Bot (@everyone & Image Attachment Protection)

This bot automatically detects users who spam `@everyone` / `@here` and/or image attachments (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) across **Text Channels** and **Voice Channel Text Chats**.

### ⚡ What It Does Automatically:
1. **Detects Raid / Cross-Channel Spam**: Monitors both regular text channels and built-in voice channel text chats.
2. **Instant 5-Hour Mute (Timeout)**: Immediately applies a 5-hour Discord native timeout so the user cannot send messages, upload images, or speak in voice channels.
3. **Global Spam Cleanup**: Deletes the triggering messages and sweeps all text and voice channels to bulk-delete any spam sent by that user in the last 2 minutes.
4. **Moderation Log**: Optionally sends a clean summary embed to your staff log channel.

---

## 📂 Included Versions
You have **both Python and Node.js** implementations included in this folder. Pick whichever runtime you prefer:
- **Python (`bot.py`)** — Uses `discord.py`
- **Node.js (`index.js`)** — Uses `discord.js v14`

---

## 🚀 Step 1: Discord Developer Portal Setup (CRITICAL)

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Go to the **Bot** tab on the left menu:
   - Click **Reset Token** and copy your Bot Token.
   - Scroll down to **Privileged Gateway Intents** and enable:
     - ✅ **Server Members Intent** *(Required to identify and timeout members)*
     - ✅ **Message Content Intent** *(Required to read `@everyone` and attachments!)*
   - Click **Save Changes**.
   - **Presence Intent is not required** by this bot.
3. Go to **OAuth2 -> URL Generator**:
   - Under **Scopes**, check: `bot`
   - Under **Bot Permissions**, check:
     - `Moderate Members` *(Required to mute/timeout users for 5 hours)*
     - `Manage Messages` *(Required to delete spam messages)*
     - `View Channels` & `Read Message History` *(Required to sweep text & voice chats)*
     - `Send Messages` & `Embed Links` *(For moderation logs)*
   - Copy the generated URL at the bottom, paste it into your browser, and invite the bot to your server.
4. **IMPORTANT — Role Hierarchy**:
   - In your Discord Server, go to **Server Settings -> Roles**.
   - Drag the **Bot's Role** near the **top of the role list** (above regular member roles). Discord only allows a bot to timeout users whose highest role is below the bot's highest role!

If the bot prints `PrivilegedIntentsRequired`, return to the **Bot** page and
confirm both required intents are enabled for the same application whose token
is in `.env`, then save and restart the bot.

---

## ⚙️ Step 2: Configure `.env`

1. Rename `.env.example` to `.env`
2. In Discord, enable **Developer Mode** under **User Settings -> Advanced**.
3. Right-click the staff moderation-log text channel and choose **Copy Channel ID**.
4. Paste your token and the copied channel ID inside `.env`:
   ```env
   DISCORD_TOKEN=your_actual_discord_bot_token_here
   LOG_CHANNEL_ID=your_log_channel_id
   ANNOUNCEMENT_CHANNEL_ID=your_announcement_channel_id
   ```
   `LOG_CHANNEL_ID` is the text channel where the bot sends a moderation embed after
   detecting and handling spam. The embed reports the user, timeout result, deleted
   message count, and detection reason. The bot needs **View Channel**, **Send Messages**,
   and **Embed Links** permissions in that channel.

   If you do not want moderation logs, leave `LOG_CHANNEL_ID=0`.
   `ANNOUNCEMENT_CHANNEL_ID` is the channel where the bot posts a detailed,
   one-time explanation of its anti-spam behavior. Both implementations check for
   the bot-authored announcement title before posting, so restarting the bot does
   not create duplicate announcements.

---

## 🐍 Option A: Run with Python (Recommended)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the bot
python bot.py
```

---

## 🟩 Option B: Run with Node.js

```bash
# 1. Install dependencies
npm install

# 2. Run the bot
npm start
```

---

## 🛠️ Customizing Sensitivity
Open `bot.py` (or `index.js`) and adjust the constants at the top if needed:
- `SPAM_TIME_WINDOW = 15` (Seconds to track user messages)
- `MAX_CHANNELS_THRESHOLD = 3` (Number of different text/voice channels before triggering)
- `MAX_MESSAGES_THRESHOLD = 4` (Number of image/`@everyone` messages before triggering)
- `MUTE_DURATION_HOURS = 5` (Timeout duration in hours)

## 📄 Policies

- [Terms of Service](Terms%20of%20Service.md)
- [Privacy Policy](Privacy%20Policy.md)
