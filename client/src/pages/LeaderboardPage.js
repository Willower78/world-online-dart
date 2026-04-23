import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Spinner from '../components/Spinner';
import styles from './LeaderboardPage.module.css';

const LeaderboardPage = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await axios.get('/api/users/leaderboard');
                setLeaderboard(res.data);
            } catch (err) {
                console.error('Could not fetch leaderboard', err);
                setError('Failed to load leaderboard.');
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    if (loading) return <div className={styles.leaderboardContainer}><Spinner /></div>;
    if (error) return <div className={styles.leaderboardContainer}><p>{error}</p></div>;

    return (
        <div className={styles.leaderboardContainer}>
            <h1 className={styles.header}>Leaderboard</h1>
            <p className={styles.subtitle}>Top players by total wins</p>

            <table className={styles.leaderboardTable}>
                <thead className={styles.tableHead}>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th style={{ textAlign: 'right' }}>Wins</th>
                    </tr>
                </thead>
                <tbody className={styles.tableBody}>
                    {leaderboard.map((player, index) => (
                        <tr key={player.userId}>
                            <td data-label="Rank" className={styles.rank}>{index + 1}</td>
                            <td data-label="Player">
                                <Link to={`/user/${player.userId}`} className={styles.playerLink}>
                                    {player.username}
                                </Link>
                            </td>
                            <td data-label="Wins" className={styles.wins}>{player.wins}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default LeaderboardPage;