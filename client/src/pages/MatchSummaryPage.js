import React, { useEffect } from 'react';
import { useLocation, useNavigate, Link, Navigate } from 'react-router-dom';
import styles from './MatchSummaryPage.module.css';

const MatchSummaryPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const game = location.state?.game;

    useEffect(() => {
        if (!game) {
            // Om någon navigerar hit direkt utan speldata, skicka dem till profilen.
            navigate('/profile');
        }
    }, [game, navigate]);

    if (!game) {
        return <Navigate to="/profile" />;
    }

    const { players, gameState } = game;
    const winner = players.find(p => p.id === gameState.winner);
    const loser = players.find(p => p.id !== gameState.winner);

    const calculateStats = (playerId) => {
        if (!gameState.throwHistory || !gameState.throwHistory[playerId]) {
            return { average: 'N/A', dartsThrown: 'N/A', highestScore: 'N/A' };
        }
        const throws = gameState.throwHistory[playerId];
        const totalPoints = throws.reduce((sum, p) => sum + p, 0);
        const dartsThrown = throws.length * 3;
        const average = dartsThrown > 0 ? ((totalPoints / dartsThrown) * 3).toFixed(2) : '0.00';
        const highestScore = throws.length > 0 ? Math.max(...throws) : 'N/A';

        return { average, dartsThrown, highestScore };
    };

    const winnerStats = calculateStats(winner.id);
    const loserStats = calculateStats(loser.id);

    const StatRow = ({ label, value }) => (
        <tr>
            <td>{label}</td>
            <td>{value}</td>
        </tr>
    );

    const PlayerStatsCard = ({ player, stats, isWinner }) => (
        <div className={`${styles.playerCard} ${isWinner ? styles.winner : ''}`}>
            <h3 className={styles.playerName}>{player.username}</h3>
            <table className={styles.statsTable}>
                <tbody>
                    <StatRow label="Final Score" value={gameState.scores[player.id]} />
                    <StatRow label="3-Dart Average" value={stats.average} />
                    <StatRow label="Darts Thrown" value={stats.dartsThrown} />
                    <StatRow label="Highest Score" value={stats.highestScore} />
                </tbody>
            </table>
        </div>
    );

    return (
        <div className={styles.summaryContainer}>
            <h1 className={styles.title}>Match Over</h1>
            <p className={styles.winnerBanner}>
                Congratulations, <span className={styles.winnerName}>{winner.username}</span>!
            </p>

            <div className={styles.statsGrid}>
                <PlayerStatsCard player={winner} stats={winnerStats} isWinner={true} />
                <PlayerStatsCard player={loser} stats={loserStats} isWinner={false} />
            </div>

            <div className={styles.buttonContainer}>
                <Link to="/profile" className={styles.homeButton}>
                    Back to Profile
                </Link>
            </div>
        </div>
    );
};

export default MatchSummaryPage;