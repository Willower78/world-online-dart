const League = require('../models/League');
const User = require('../models/User');
const economyService = require('./economyService');

/**
 * Creates a new league. (Admin only)
 * @param {string} adminId - The ID of the admin creating the league.
 * @param {object} leagueData - Data for the new league (name, region, etc.).
 * @returns {Promise<League|null>} The created league object or null on error.
 */
async function createLeague(adminId, leagueData) {
  try {
    // TODO: Add check to ensure user is an admin
    const newLeague = new League({
      ...leagueData,
      createdBy: adminId,
    });
    await newLeague.save();
    console.log(`League "${newLeague.name}" created by admin ${adminId}.`);
    return newLeague;
  } catch (error) {
    console.error('Error creating league:', error);
    return null;
  }
}

/**
 * Allows a user to join an active league.
 * @param {string} userId - The ID of the user joining.
 * @param {string} leagueId - The ID of the league to join.
 * @returns {Promise<boolean>} True if the user successfully joined a division.
 */
async function joinLeague(userId, leagueId) {
  const user = await User.findById(userId);
  const league = await League.findById(leagueId);

  if (!user || !league) {
    console.error('User or League not found.');
    return false;
  }

  // 1. Check requirements
  if (user.placementGamesPlayed < 3) {
    console.error('User has not completed the required placement games.');
    return false;
  }
  if (league.status !== 'Recruiting') {
    console.error('This league is not currently recruiting players.');
    return false;
  }

  try {
    // 2. Charge entry fee (assuming entryFeeEuros needs to be paid in stars)
    // This logic may need to be adjusted if paying with real money directly.
    const goldStarsCost = league.entryFeeEuros; // 1 EUR = 1 Gold Star
    const spent = await economyService.spendStars(userId, goldStarsCost, 0);
    if (!spent) {
      console.error('Failed to charge entry fee in stars.');
      return false;
    }

    // 3. Add user to a division with space
    let divisionToJoin = league.divisions.find(d => d.players.length < league.maxPlayersPerDivision);
    
    if (!divisionToJoin) {
      // Or create a new division if the league structure allows
      console.error('No divisions with available space.');
      // TODO: refund stars if no space is found.
      return false;
    }

    divisionToJoin.players.push(userId);
    await league.save();

    console.log(`User ${user.username} successfully joined division ${divisionToJoin.divisionNumber} of league ${league.name}.`);
    return true;
  } catch (error) {
    console.error(`Error joining league for user ${userId}:`, error);
    // TODO: Implement refund logic if any step fails.
    return false;
  }
}

/**
 * Generates a round-robin schedule for all divisions in a league.
 * @param {string} leagueId - The ID of the league to generate schedules for.
 */
async function generateSchedules(leagueId) {
  const league = await League.findById(leagueId);
  if (!league || league.status !== 'Recruiting') {
    console.error('League not found or not in recruiting phase.');
    return;
  }

  console.log(`Generating schedules for league: ${league.name}`);

  for (const division of league.divisions) {
    let players = [...division.players.map(p => p.toString())];

    // Initialize standings for all players in the division
    division.standings = players.map(playerId => ({
      player: playerId,
      wins: 0,
      losses: 0,
      points: 0
    }));

    // Add a dummy player if there's an odd number of players
    if (players.length % 2 !== 0) {
      players.push(null); // "bye" player
    }

    const numPlayers = players.length;
    const numRounds = numPlayers - 1;
    const half = numPlayers / 2;
    const schedule = [];

    const playerIndexes = players.map((_, i) => i);

    for (let week = 0; week < numRounds; week++) {
      for (let i = 0; i < half; i++) {
        const player1Id = players[playerIndexes[i]];
        const player2Id = players[playerIndexes[numPlayers - 1 - i]];

        // Skip matches against the "bye" player
        if (player1Id !== null && player2Id !== null) {
          schedule.push({
            week: week + 1,
            player1: player1Id,
            player2: player2Id,
            status: 'Scheduled',
          });
        }
      }

      // Rotate players, keeping the first one fixed
      const last = playerIndexes.pop();
      playerIndexes.splice(1, 0, last);
    }
    division.schedule = schedule;
    console.log(`-- Generated schedule for Division ${division.divisionNumber} with ${schedule.length} matches over ${numRounds} weeks.`);
  }

  league.status = 'InProgress';
  await league.save();
  console.log(`League "${league.name}" is now In Progress.`);
}

/**
 * Reports the result of a league match.
 * @param {string} reportingUserId - The ID of the user reporting the result.
 * @param {string} leagueMatchId - The ID of the match being reported.
 * @param {string} winnerId - The ID of the winning player.
 * @returns {Promise<boolean>} True if the result was recorded successfully.
 */
async function reportMatchResult(reportingUserId, leagueMatchId, winnerId) {
  // 1. Find the league and match
  // 2. Validate that the reporting user is one of the match participants
  // 3. Charge both players the per-game fee using economyService.spendStars()
  // 4. Update the match object with the winner and set status to 'Completed'
  // 5. Update the division standings with new win/loss records and points.
  // This is a placeholder for the implementation.
  console.log(`User ${reportingUserId} reported winner of match ${leagueMatchId} as ${winnerId}.`);
  return true;
}


module.exports = {
  createLeague,
  joinLeague,
  generateSchedules,
  reportMatchResult,
};
