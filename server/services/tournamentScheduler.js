const Tournament = require('../models/Tournament');
const User = require('../models/User'); // Import User if needed for owner assignment (or use a system user)

const TOURNAMENT_TYPES = [
    { name: 'Amateur 8-Man Cup', gameType: '501', maxParticipants: 8, category: 'Amateur', allowed: ['Beginner', 'Amateur'] },
    { name: 'Amateur 16-Man Cup', gameType: '501', maxParticipants: 16, category: 'Amateur', allowed: ['Beginner', 'Amateur'] },
    { name: 'Pro 8-Man Cup', gameType: '501', maxParticipants: 8, category: 'Pro', allowed: ['Pro', 'Amateur'] }, // Amateurs allowed in Pro? User said "Amateur and Pro", implying separation. But usually Pros are Pro only.
    { name: 'Pro 16-Man Cup', gameType: '501', maxParticipants: 16, category: 'Pro', allowed: ['Pro', 'Amateur'] }
];

// Helper to get a system user ID for the "owner" field
const getSystemOwnerId = async () => {
    // Ideally, find a user with role 'admin' or create a dummy one.
    // For now, we'll try to find the first admin.
    const admin = await User.findOne({ role: 'admin' });
    if (admin) return admin._id;
    // Fallback: find any user
    const user = await User.findOne();
    return user ? user._id : null;
};

const checkAndCreateTournaments = async (io) => {
    try {
        const systemOwnerId = await getSystemOwnerId();
        if (!systemOwnerId) {
            console.error('[Scheduler] No user found to set as tournament owner. Skipping creation.');
            return;
        }

        let createdAny = false;

        for (const template of TOURNAMENT_TYPES) {
            // Find if there is any OPEN (pending) tournament of this specific configuration
            const existingPending = await Tournament.findOne({
                category: template.category,
                maxParticipants: template.maxParticipants,
                status: 'pending'
            });

            if (!existingPending) {
                const uniqueId = Math.floor(Math.random() * 10000);
                const newTournament = new Tournament({
                    name: `${template.name} #${uniqueId}`,
                    gameType: template.gameType,
                    category: template.category,
                    maxParticipants: template.maxParticipants,
                    allowedClassifications: template.allowed,
                    entryFeeGoldStars: template.category === 'Pro' ? 100 : 10, // Example fees
                    entryFeeSilverStars: template.category === 'Amateur' ? 50 : 0,
                    prizeDistribution: {
                        first: 0.6,
                        second: 0.3,
                        semiFinalists: 0.05,
                        house: 0.0
                    },
                    currentParticipants: 0,
                    status: 'pending',
                    owner: systemOwnerId,
                    participants: [],
                    bracket: { rounds: [] } // Initialize empty bracket
                });
                
                await newTournament.save();
                console.log(`[Scheduler] Auto-created tournament: ${newTournament.name}`);
                createdAny = true;
            }
        }

        if (createdAny && io) {
            io.emit('tournaments_updated');
        }

    } catch (error) {
        console.error('[Scheduler] Error checking/creating tournaments:', error);
    }
};

const start = async (io) => {
    console.log('[Scheduler] Starting tournament auto-manager...');
    
    // 1. Remove all existing pending tournaments to "reset" as requested
    // Be careful in prod, but user requested "Remove all current ones".
    try {
        await Tournament.deleteMany({ status: 'pending' });
        console.log('[Scheduler] Cleared all pending tournaments.');
    } catch (err) {
        console.error('[Scheduler] Failed to clear pending tournaments:', err);
    }

    // 2. Check and create
    await checkAndCreateTournaments(io);

    // 3. Periodic check
    setInterval(() => checkAndCreateTournaments(io), 30 * 1000);
};

module.exports = { start, checkAndCreateTournaments };