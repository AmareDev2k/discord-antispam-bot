import os
import time
import asyncio
from datetime import timedelta
from collections import defaultdict
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
LOG_CHANNEL_ID = int(os.getenv("LOG_CHANNEL_ID", "0"))  # Optional: Channel ID to log mute events

# Configuration
SPAM_TIME_WINDOW = 15  # Seconds to track messages
MAX_CHANNELS_THRESHOLD = 3  # Trigger if user posts in >= 3 different channels within window
MAX_MESSAGES_THRESHOLD = 4  # Trigger if user sends >= 4 suspicious messages within window
MUTE_DURATION_HOURS = 5
ALLOWED_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".webp")

intents = discord.Intents.default()
intents.messages = True
intents.message_content = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

# Track user activity: {guild_id: {user_id: [(timestamp, channel_id, message_obj, is_suspicious)]}}
user_activity = defaultdict(lambda: defaultdict(list))
# Prevent duplicate punishment tasks running simultaneously for the same user
processing_users = set()

@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user} (ID: {bot.user.id})")
    print("🛡️ Anti-Spam Protection Active (Monitoring Text & Voice Channel Chats)")

def is_suspicious_message(message: discord.Message) -> bool:
    """Check if message contains @everyone/@here mention or image attachments."""
    has_everyone = message.mention_everyone or "@everyone" in message.content or "@here" in message.content
    has_image = any(
        att.filename.lower().endswith(ALLOWED_IMAGE_EXTENSIONS)
        or (att.content_type and att.content_type.startswith("image/"))
        for att in message.attachments
    )
    return has_everyone or has_image

@bot.event
async def on_message(message: discord.Message):
    # Ignore bots and DMs
    if message.author.bot or not message.guild:
        return

    # Optional: Ignore Administrators/Moderators who have manage_messages permission
    if message.author.guild_permissions.manage_messages:
        await bot.process_commands(message)
        return

    guild_id = message.guild.id
    user_id = message.author.id
    now = time.time()

    suspicious = is_suspicious_message(message)

    # Record message in sliding window
    user_History = user_activity[guild_id][user_id]
    user_History.append((now, message.channel.id, message, suspicious))

    # Clean up old entries outside the time window
    user_activity[guild_id][user_id] = [
        entry for entry in user_History if now - entry[0] <= SPAM_TIME_WINDOW
    ]
    current_history = user_activity[guild_id][user_id]

    # Filter suspicious messages (@everyone or .png/.jpg attachments)
    suspicious_msgs = [entry for entry in current_history if entry[3]]
    unique_channels = {entry[1] for entry in current_history}
    suspicious_channels = {entry[1] for entry in suspicious_msgs}

    # Trigger Condition:
    # 1. User mentions @everyone/@here immediately (even 1-2 times if unauthorized, or across channels)
    # 2. User spams images (.png/.jpg) or @everyone across multiple text/voice channels
    # 3. User sends rapid image/mention spam in a short window
    has_everyone_ping = "@everyone" in message.content or "@here" in message.content or message.mention_everyone

    is_raid_spam = (
        (has_everyone_ping and len(suspicious_msgs) >= 2) or
        (len(suspicious_channels) >= MAX_CHANNELS_THRESHOLD) or
        (len(suspicious_msgs) >= MAX_MESSAGES_THRESHOLD) or
        (has_everyone_ping and any(att.filename.lower().endswith(ALLOWED_IMAGE_EXTENSIONS) for att in message.attachments))
    )

    user_key = (guild_id, user_id)
    if is_raid_spam and user_key not in processing_users:
        processing_users.add(user_key)
        try:
            await handle_spammer(message.guild, message.author, current_history)
        finally:
            user_activity[guild_id][user_id].clear()
            processing_users.discard(user_key)

    await bot.process_commands(message)

async def handle_spammer(guild: discord.Guild, member: discord.Member, history: list):
    """Mute the user for 5 hours and purge their recent spam across all text & voice channels."""
    reason = "Automated Anti-Spam: @everyone / Image (.png/.jpg) cross-channel spam detected."

    # 1. Mute (Timeout) the user for 5 hours immediately
    mute_success = False
    try:
        duration = timedelta(hours=MUTE_DURATION_HOURS)
        await member.timeout(duration, reason=reason)
        mute_success = True
        print(f"🔇 Muted {member} ({member.id}) for {MUTE_DURATION_HOURS} hours in {member.guild.name}.")
    except discord.Forbidden:
        print(f"❌ Missing permissions to timeout {member} in {guild.name}. Check bot role hierarchy!")
    except Exception as e:
        print(f"⚠️ Error timing out {member}: {e}")

    # 2. Delete tracked spam messages immediately
    deleted_count = 0
    tracked_msg_ids = set()
    for _, _, msg, _ in history:
        try:
            await msg.delete()
            deleted_count += 1
            tracked_msg_ids.add(msg.id)
        except (discord.NotFound, discord.Forbidden):
            pass
        except Exception:
            pass

    # 3. Sweep all Text Channels and Voice Channel Text Chats for any remaining messages from this user in the last 2 minutes
    cutoff_time = discord.utils.utcnow() - timedelta(minutes=2)

    # Combine TextChannels and VoiceChannels (VoiceChannels have built-in text chat in Discord)
    all_messagable_channels = list(guild.text_channels) + list(guild.voice_channels)

    async def purge_channel(channel):
        nonlocal deleted_count
        perms = channel.permissions_for(guild.me)
        if not (perms.view_channel and perms.read_message_history and perms.manage_messages):
            return
        try:
            purged = await channel.purge(
                limit=50,
                check=lambda m: m.author.id == member.id and m.id not in tracked_msg_ids,
                after=cutoff_time,
                bulk=True
            )
            deleted_count += len(purged)
        except Exception:
            pass

    # Run channel sweep concurrently across all text & voice channels
    await asyncio.gather(*(purge_channel(ch) for ch in all_messagable_channels))

    print(f"🗑️ Deleted {deleted_count} spam messages from {member} across channels.")

    # 4. Optional Log Notification
    if LOG_CHANNEL_ID:
        log_channel = guild.get_channel(LOG_CHANNEL_ID)
        if log_channel and log_channel.permissions_for(guild.me).send_messages:
            embed = discord.Embed(
                title="🛡️ Anti-Spam Action Executed",
                color=discord.Color.red(),
                timestamp=discord.utils.utcnow()
            )
            embed.add_field(name="User", value=f"{member.mention} (`{member.id}`)", inline=True)
            embed.add_field(name="Action", value=f"{'5h Timeout (Mute)' if mute_success else 'Failed to Mute (Role Hierarchy)'}", inline=True)
            embed.add_field(name="Messages Deleted", value=f"`{deleted_count}` across Text & Voice chats", inline=True)
            embed.add_field(name="Reason", value=reason, inline=False)
            await log_channel.send(embed=embed)

if __name__ == "__main__":
    if not TOKEN or TOKEN == "your_bot_token_here":
        print("❌ ERROR: Please set your DISCORD_TOKEN in the .env file before running the bot.")
    else:
        try:
            bot.run(TOKEN)
        except discord.errors.PrivilegedIntentsRequired:
            print(
                "❌ ERROR: Discord rejected the requested privileged intents.\n"
                "   Open Discord Developer Portal -> Your Application -> Bot.\n"
                "   Under Privileged Gateway Intents, enable:\n"
                "   - Server Members Intent\n"
                "   - Message Content Intent\n"
                "   Then save the changes and run this bot again."
            )
