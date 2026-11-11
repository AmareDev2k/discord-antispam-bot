# Privacy Policy

**Last updated:** November 11, 2026

This Privacy Policy explains how the Discord anti-spam bot ("the Bot")
processes information when it is installed in or used by a Discord server.

## 1. Information the Bot Processes

To detect spam and perform moderation actions, the Bot may temporarily process:

- Discord user ID, username, and server membership information.
- Message content needed to detect `@everyone` and `@here`.
- Attachment names, content types, and message attachment metadata.
- Message IDs, channel IDs, guild IDs, and message timestamps.
- Recent message activity used to measure spam frequency and channel spread.

The Bot does not require passwords, payment information, or direct messages.
Do not place sensitive information in messages sent to a server using the Bot.

## 2. How Information Is Used

Information is used only to:

- Detect configured anti-spam patterns.
- Apply timeouts to suspected spammers.
- Delete messages identified as spam.
- Find recent messages from the same user during cleanup.
- Send a moderation summary to the configured `LOG_CHANNEL_ID` channel.

The moderation summary may include the user's Discord mention and ID, whether
the timeout succeeded, the number of deleted messages, and the detection
reason.

## 3. Retention and Storage

The Bot keeps recent activity in memory while it is running so it can evaluate
the configured spam window. Activity is cleared after the window or after a
moderation action is completed.

The Bot does not intentionally maintain a separate database of message
content. Discord may independently retain messages and audit records under
Discord's own policies and systems. Server administrators should review their
hosting, logging, and backup configuration for any additional data retention.

## 4. Sharing

The Bot does not sell personal information. Information may be visible to:

- Server administrators and staff who can access the configured moderation-log
  channel.
- Discord and its services as necessary for the Bot to operate through the
  Discord API.
- Hosting or infrastructure providers used by the server owner to run the Bot,
  if applicable.

## 5. Your Choices

Server administrators can stop processing by removing the Bot or setting
`LOG_CHANNEL_ID=0` to disable moderation-log messages. Users who have questions
about moderation records should contact the relevant server administrator.

## 6. Children's Privacy

The Bot is not intended to independently collect information from children.
Use of Discord is subject to Discord's own age requirements and policies.

## 7. Security

Reasonable measures should be used to protect the Bot token, environment
configuration, hosting account, and moderation-log channel. Never commit a
real `DISCORD_TOKEN` to source control or share it publicly.

## 8. Changes to This Policy

This Privacy Policy may be updated when the Bot's behavior or applicable
requirements change. The updated version will include a new "Last updated"
date.

## 9. Contact

For privacy questions or requests, contact:

**supunaravinda2004@gmail.com**
