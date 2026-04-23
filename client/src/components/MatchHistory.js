import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';

const MatchHistory = ({ userId, currentUser }) => {
    const [matchHistory, setMatchHistory] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!userId) return;

        const fetchMatchHistory = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await axios.get(`/api/users/${userId}/matches`);
                setMatchHistory(res.data);
            } catch (err) {
                console.error("Could not fetch match history", err);
                setError("Failed to load match history.");
            } finally {
                setLoading(false);
            }
        };

        fetchMatchHistory();
    }, [userId]);

    if (loading) {
        return <div style={styles.card}><Spinner /></div>;
    }

    if (error) {
        return <div style={{...styles.card, color: '#e74c3c'}}>{error}</div>;
    }

    return (
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>Match History</h3>
            {matchHistory.length > 0 ? (
                <ul style={styles.matchList}>
                    {matchHistory.map(match => {
                        const isWinner = match.winner._id === userId;
                        const opponent = isWinner ? match.loser : match.winner;
                        const myThrows = match.throwHistory ? match.throwHistory[userId] : [];
                        const opponentThrows = opponent && match.throwHistory ? match.throwHistory[opponent._id] : [];
                        const average = myThrows.length > 0 ? (myThrows.reduce((a, b) => a + b, 0) / myThrows.length).toFixed(1) : 'N/A';

                        return (
                            <li key={match._id} style={styles.matchItem} onClick={() => setSelectedMatch(selectedMatch?._id === match._id ? null : match)}>
                                <div style={styles.matchSummary}>
                                    <span style={isWinner ? styles.win : styles.loss}>
                                        {isWinner ? 'WIN' : 'LOSS'}
                                    </span>
                                    vs <Link to={`/user/${opponent._id}`} style={styles.playerLink} onClick={(e) => e.stopPropagation()}>
                                        {opponent.username}
                                    </Link>
                                    <span style={styles.matchDate}>{new Date(match.playedAt).toLocaleDateString()}</span>
                                </div>
                                {selectedMatch?._id === match._id && (
                                    <div style={styles.matchDetails}>
                                        <h4>Match Details ({match.gameType})</h4>
                                        <p><strong>Your Throws:</strong> {myThrows.join(', ')}</p>
                                        <p><strong>Opponent's Throws:</strong> {opponentThrows.join(', ')}</p>
                                        <p><strong>Your Average:</strong> {average}</p>
                                        <p>
                                            <strong>Final Score:</strong> {currentUser.username} ({match.finalScores[userId]}) - {opponent.username} ({match.finalScores[opponent._id]})
                                        </p>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p>No recent matches found.</p>
            )}
        </div>
    );
};

// Styles copied from Profile.js
const styles = {
    card: { backgroundColor: '#333333', border: '1px solid #444', borderRadius: '8px', padding: '20px', margin: '20px 0', width: '100%', maxWidth: '600px', boxSizing: 'border-box' },
    cardTitle: { margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' },
    matchList: { listStyle: 'none', padding: 0, margin: 0 },
    matchItem: { backgroundColor: '#444', padding: '10px 15px', borderRadius: '5px', marginBottom: '10px', cursor: 'pointer', transition: 'background-color 0.2s' },
    matchSummary: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    win: { color: '#2ecc71', fontWeight: 'bold' },
    loss: { color: '#e74c3c', fontWeight: 'bold' },
    matchDate: { fontSize: '0.8rem', color: '#999' },
    matchDetails: { marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #555', fontSize: '0.9rem', lineHeight: '1.6' },
    playerLink: { color: '#3498db', textDecoration: 'none', fontWeight: 'normal' }
};

export default MatchHistory;