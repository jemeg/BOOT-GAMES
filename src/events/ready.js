/**
 * ready event
 * Fired once when the bot has finished logging in.
 */

const { ActivityType } = require('discord.js');

module.exports = {
  // `clientReady` is the new name in discord.js v15; `ready` is kept for v14.
  name: 'clientReady',
  once: true,

  /**
   * @param {import('discord.js').Client} client
   */
  execute(client) {
    if (!client.user) {
      console.error('Client user is undefined on ready event.');
      return;
    }

    console.log('──────────────────────────────────────────');
    console.log(`✅  Logged in as: ${client.user.tag}`);
    console.log(`🤖  ID:           ${client.user.id}`);
    console.log(`🌐  Guilds:       ${client.guilds.cache.size}`);
    console.log(`👥  Users:        ${client.users.cache.size}`);
    console.log('──────────────────────────────────────────');

    client.user.setPresence({
      status: 'online',
      activities: [
        {
          name: 'Mafia / Killer',
          type: ActivityType.Playing
        }
      ]
    });
  }
};
