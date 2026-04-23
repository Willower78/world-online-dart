import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import socket from '../socket/socket';
import MainLayout from '../components/MainLayout';
import Spinner from '../components/Spinner';
import styles from './MyMatchesPage.module.css';

const MyMatchesPage = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const currentUser = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                setLoading(true);
                const res = await axios.get('/api/users/me/matches/scheduled');
                setMatches(res.data);
            } catch (err) {
                setError('Failed to load your scheduled matches.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();

        const handleMatchUpdate = (updatedMatchData) => {
            setMatches(prevMatches => prevMatches.map(m => 
                m.matchId === updatedMatchData.matchId ? { ...m, ...updatedMatchData } : m
            ));
        };

        const handleToast = ({ type, message }) => {
            toast[type](message);
        };

        socket.on('league_match_update', handleMatchUpdate);
        socket.on('toast_message', handleToast);

        return () => {
            socket.off('league_match_update', handleMatchUpdate);
            socket.off('toast_message', handleToast);
        };
    }, []);

    const openScheduler = (match) => {
        setSelectedMatch(match);
        setIsSchedulerOpen(true);
    };

    const handleProposeTime = (proposedDate) => {
        if (!selectedMatch || !proposedDate) return;
        socket.emit('propose_league_match_time', {
            leagueId: selectedMatch.leagueId,
            matchId: selectedMatch.matchId,
            proposedDate,
        });
        setIsSchedulerOpen(false);
    };

    const handleAcceptTime = (match) => {
        socket.emit('accept_league_match_time', {
            leagueId: match.leagueId,
            matchId: match.matchId,
        });
    };

    const handleStartMatch = (match) => {
        if (window.confirm(`Are you ready to start your match against ${match.opponent.username}?`)) {
            socket.emit('start_league_match', {
                leagueId: match.leagueId,
                matchId: match.matchId,
            });
        }
    };

    const MatchCard = ({ match }) => {
        // We need to know who proposed the time to show 'Accept' correctly.
        // The backend doesn't provide this yet. We'll assume if a date is proposed,
        // the current user is the one who needs to act. This is a simplification.
        const canAccept = match.proposedDate && match.status !== 'Confirmed';

        return (
            <div className={styles.matchCard}>
                                    <div className={styles.opponentInfo}>
                                        <img 
                                            src={match.opponent.profilePicture ? `${match.opponent.profilePicture}` : '/default-avatar.png'} 
                                            alt={match.opponent.username} 
                                            className={styles.opponentAvatar} 
                                        />
                                        <span className={styles.opponentName}>{match.opponent.username}</span>
                                    </div>
                <div className={styles.matchActions}>
                    {match.status === 'Confirmed' ? (
                        <div className={styles.timeInfo}>
                            <p><strong>Confirmed:</strong> {new Date(match.matchDate).toLocaleString()}</p>
                            <button onClick={() => handleStartMatch(match)} className={styles.startMatchButton}>Start Match</button>
                        </div>
                    ) : canAccept ? (
                        <div className={styles.timeInfo}>
                             <p>Proposed: {new Date(match.proposedDate).toLocaleString()}</p>
                            <button onClick={() => handleAcceptTime(match)} className={styles.actionButton}>Accept Time</button>
                        </div>
                    ) : (
                         <button onClick={() => openScheduler(match)} className={styles.actionButton}>Schedule Time</button>
                    )}
                    <button className={styles.chatButton}>Chat</button>
                </div>
            </div>
        );
    };
    
    const SchedulerModal = () => {
        const [date, setDate] = useState('');
        return (
            <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                    <h3>Propose a time for your match</h3>
                    <input 
                        type="datetime-local" 
                        onChange={e => setDate(e.target.value)}
                        className={styles.dateInput}
                    />
                    <div className={styles.modalActions}>
                        <button onClick={() => handleProposeTime(date)} className={styles.actionButton}>Propose</button>
                        <button onClick={() => setIsSchedulerOpen(false)} className={styles.cancelButton}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <MainLayout>
            {isSchedulerOpen && <SchedulerModal />}
            <div className={styles.container}>
                <h1 className={styles.title}>My Scheduled Matches</h1>
                {loading && <Spinner />}
                {error && <p className={styles.error}>{error}</p>}
                {!loading && !error && (
                    <div className={styles.matchesList}>
                        {matches.length > 0 ? (
                            matches.map(match => <MatchCard key={match.matchId} match={match} />)
                        ) : (
                            <p className={styles.noMatches}>You have no upcoming league matches scheduled.</p>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default MyMatchesPage;
