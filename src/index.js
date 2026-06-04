/**
 * Main Bot Entry Point
 * Wires up Discord client, loads commands and events, registers slash
 * commands, and starts the bot.
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes
} = require('discord.js');

const config = require('./config');
const GameManager = require('./managers/GameManager');
const BotManager = require('./managers/BotManager');
const NightManager = require('./managers/NightManager');
const VoteManager = require('./managers/VoteManager');

// ─────────────────────────────────────────────────────────────────────────────
// Client setup
// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User
  ]
});

/** @type {Collection<string, import('discord.js').ApplicationCommand>} */
client.commands = new Collection();

/** @type {GameManager} */
client.gameManager = new GameManager();

/** @type {NightManager}  Wired up so interactionCreate can dispatch to it. */
client.nightManager = client.gameManager.nightManager;

/** @type {VoteManager}  Wired up so interactionCreate can dispatch to it. */
client.voteManager = client.gameManager.voteManager;

/** @type {BotManager}  Optional - remove this line + the file to disable bots. */
client.botManager = new BotManager();

// ─────────────────────────────────────────────────────────────────────────────
// Command loader
// ─────────────────────────────────────────────────────────────────────────────

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`  ↳ Loaded command: /${command.data.name}`);
  } else {
    console.warn(`  ⚠️  ${file} is missing "data" or "execute".`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event loader
// ─────────────────────────────────────────────────────────────────────────────

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (!event.name || typeof event.execute !== 'function') {
    console.warn(`  ⚠️  ${file} is missing "name" or "execute".`);
    continue;
  }
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`  ↳ Loaded event: ${event.name}${event.once ? ' (once)' : ''}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slash command registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers all loaded slash commands either globally or to a single guild
 * (guild registration is instant, useful for development).
 */
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(config.TOKEN);
  const body = client.commands.map((cmd) => cmd.data.toJSON());

  try {
    console.log(`\n📡  Registering ${body.length} slash command(s)...`);

    if (config.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
        { body }
      );
      console.log(`✅  Registered ${body.length} guild command(s) to ${config.GUILD_ID}.`);
    } else {
      await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body });
      console.log(`✅  Registered ${body.length} global command(s) (may take up to 1 hour to appear).`);
    }
  } catch (err) {
    console.error('❌  Failed to register slash commands:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

if (!config.TOKEN) {
  console.error('❌  No TOKEN found in environment. Please configure your .env file.');
  process.exit(1);
}

if (!config.CLIENT_ID) {
  console.error('❌  No CLIENT_ID found in environment. Please configure your .env file.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal HTTP health-check server (satisfies Render's port scan when this
// service is hosted as a Web Service instead of a Background Worker).
// Remove this block if you switch the service type to Background Worker.
// ─────────────────────────────────────────────────────────────────────────────

const http = require('http');
const HEALTH_PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('🎭 Mafia Bot is running!\n');
  })
  .listen(HEALTH_PORT, () => {
    console.log(`🌐 Health-check server listening on port ${HEALTH_PORT}`);
  });

client
  .login(config.TOKEN)
  .then(() => registerSlashCommands())
  .catch((err) => {
    console.error('❌  Failed to login:', err);
    process.exit(1);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n👋  Received SIGINT. Shutting down...');
  for (const game of client.gameManager.games.values()) {
    game.cleanup();
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋  Received SIGTERM. Shutting down...');
  for (const game of client.gameManager.games.values()) {
    game.cleanup();
  }
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
