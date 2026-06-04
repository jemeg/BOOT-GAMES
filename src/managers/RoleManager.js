/**
 * RoleManager
 * Handles role distribution according to the official rules.
 *
 *   4  players → 1 Killer, 1 Doctor, 1 Detective, 1 Citizen
 *   5–6 players → 1 Killer, 1 Doctor, 1 Detective, remaining Citizens
 *   7–10 players → 2 Killers, 1 Doctor, 1 Detective, remaining Citizens
 */

const { Role } = require('../utils/constants');
const { shuffle } = require('../utils/helpers');

class RoleManager {
  /**
   * Assigns a role to every player in the list (in place).
   * @param {import('../models/Player')[]} players
   */
  static assignRoles(players) {
    const count = players.length;
    if (count < 4) {
      throw new Error('Cannot assign roles: need at least 4 players.');
    }

    /** @type {string[]} */
    let rolePool = [];

    if (count === 4) {
      rolePool = [Role.KILLER, Role.DOCTOR, Role.DETECTIVE, Role.CITIZEN];
    } else if (count >= 5 && count <= 6) {
      rolePool = [Role.KILLER, Role.DOCTOR, Role.DETECTIVE];
      for (let i = 0; i < count - 3; i++) rolePool.push(Role.CITIZEN);
    } else if (count >= 7 && count <= 10) {
      rolePool = [Role.KILLER, Role.KILLER, Role.DOCTOR, Role.DETECTIVE];
      for (let i = 0; i < count - 4; i++) rolePool.push(Role.CITIZEN);
    } else {
      // Fallback for unexpected sizes - mirror 7-10 rules.
      rolePool = [Role.KILLER, Role.KILLER, Role.DOCTOR, Role.DETECTIVE];
      for (let i = 0; i < count - 4; i++) rolePool.push(Role.CITIZEN);
    }

    const shuffled = shuffle(rolePool);
    players.forEach((player, index) => {
      player.setRole(shuffled[index]);
    });
  }

  /**
   * Returns a count of each role across the given player list.
   * @param {import('../models/Player')[]} players
   * @returns {Object<string, number>}
   */
  static countRoles(players) {
    const counts = {
      [Role.KILLER]: 0,
      [Role.DOCTOR]: 0,
      [Role.DETECTIVE]: 0,
      [Role.CITIZEN]: 0
    };
    for (const player of players) {
      if (counts[player.role] !== undefined) {
        counts[player.role]++;
      }
    }
    return counts;
  }
}

module.exports = RoleManager;
