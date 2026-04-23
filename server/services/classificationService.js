const User = require('../models/User');
const Match = require('../models/Match');

const CLASSIFICATION_THRESHOLDS = {
  BEGINNER_MAX: 40,
  AMATEUR_MIN: 41,
  AMATEUR_MAX: 65,
  PRO_MIN: 66,
};

const PLACEMENT_GAMES_REQUIRED = 3;
const PROMOTION_DEMOTION_GAME_WINDOW = 20; // Number of recent games to consider for re-classification

/**
 * Calculates a user's new average score based on their entire match history.
 * NOTE: This could become slow with many matches. A more optimized approach
 * would be to store a running average and total score on the User model.
 * For now, this direct calculation is more accurate.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<number>} - The new average score.
 */
async function calculateAverageScore(userId) {
    // This assumes the Match model has a structure where we can get scores for a user.
    // Let's assume a schema like: Match.scores = [{ player: userId, score: 101, darts: 3 }]
    const matches = await Match.find({ 'scores.player': userId, status: 'completed' }).select('scores').lean();
    
    let totalScore = 0;
    let totalDarts = 0;

    matches.forEach(match => {
        match.scores.forEach(s => {
            if (s.player.toString() === userId.toString()) {
                totalScore += s.score;
                totalDarts += s.darts; // Assumes 'darts' field exists per score entry
            }
        });
    });

    if (totalDarts === 0) return 0;
    return (totalScore / totalDarts) * 3; // Standard 3-dart average
}

/**
 * Determines a user's classification based on their average score.
 * @param {number} averageScore - The user's average score.
 * @returns {string} - The classification ('Beginner', 'Amateur', 'Pro').
 */
function getClassificationFromAverage(averageScore) {
  if (averageScore >= CLASSIFICATION_THRESHOLDS.PRO_MIN) {
    return 'Pro';
  } else if (averageScore >= CLASSIFICATION_THRESHOLDS.AMATEUR_MIN) {
    return 'Amateur';
  } else {
    return 'Beginner';
  }
}

/**
 * Updates a player's stats and classification after a match is completed.
 * This should be called from a post-match hook.
 * @param {string} userId - The ID of the user to update.
 */
async function updatePlayerStats(userId) {
  const user = await User.findById(userId);
  if (!user) {
    console.error(`User not found for classification update: ${userId}`);
    return;
  }

  // Recalculate the user's overall average score from their match history.
  const newAverage = await calculateAverageScore(userId);
  user.averageScore = newAverage;

  // Handle initial placement
  if (user.classification === 'Unranked') {
    user.placementGamesPlayed += 1;
    if (user.placementGamesPlayed >= PLACEMENT_GAMES_REQUIRED) {
      user.classification = getClassificationFromAverage(newAverage);
      console.log(`User ${user.username} has been classified as ${user.classification}`);
    }
  }
  // Handle promotion/demotion for ranked players
  else {
    // To implement promotion/demotion over the last 20 games, we'd need to calculate
    // the average of only those games. For now, we'll re-classify based on the overall average.
    // A more advanced implementation would be added here.
    const currentClassification = user.classification;
    const newClassification = getClassificationFromAverage(newAverage);

    if (currentClassification !== newClassification) {
        user.classification = newClassification;
        console.log(`User ${user.username} has been re-classified from ${currentClassification} to ${newClassification}`);
    }
  }

  await user.save();
}

module.exports = {
  updatePlayerStats,
  calculateAverageScore, // Exporting for potential use elsewhere
};
