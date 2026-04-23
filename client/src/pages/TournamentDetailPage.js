import React, { useState, useEffect } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import socket from '../socket/socket';
import TopHeader from '../components/TopHeader';
import styles from './TournamentDetailPage.module.css';

const TournamentDetailPage = () => {
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    // Safety check: useOutletContext can be null if not provided
    const outletContext = useOutletContext();
    const onMenuClick = outletContext?.onMenuClick || (() => {});

    const fetchTournament = async () => {
        try {
            const res = await axios.get(`/api/tournaments/${id}`);
            setTournament(res.data);
        } catch (err) {
            toast.error('Could not fetch tournament details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTournament();

        const handleTournamentUpdate = ({ tournamentId }) => {
            if (tournamentId === id) {
                console.log("Tournament update received, refetching...");
                fetchTournament();
            }
        };

        socket.on('tournament_updated', handleTournamentUpdate);

        return () => {
            socket.off('tournament_updated', handleTournamentUpdate);
        };
    }, [id]);

    const handleJoin = async () => {
        try {
            await axios.post(`/api/tournaments/${id}/join`);
            toast.success('Successfully joined the tournament!');
            fetchTournament();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to join tournament.');
        }
    };

    const handleStart = async () => {
        try {
            await axios.post(`/api/tournaments/${id}/start`);
            toast.success('The tournament has started!');
            fetchTournament();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to start tournament.');
        }
    };

    const handleStartMatch = (matchId) => {
        if (!matchId) {
            toast.error("Cannot start match: Match ID is missing.");
            return;
        }
        socket.emit('start_tournament_match', {
            tournamentId: id,
            matchId: matchId
        });
    };

    if (loading) {
        return (
            <>
                <TopHeader title="TOURNAMENT" onMenuClick={onMenuClick} />
                <div className={styles.detailContainer}>Loading tournament...</div>
            </>
        );
    }

    if (!tournament) {
        return (
            <>
                <TopHeader title="TOURNAMENT" onMenuClick={onMenuClick} />
                <div className={styles.detailContainer}>Tournament not found.</div>
            </>
        );
    }

    const isPlayerInTournament = tournament.participants?.some(p => p._id === currentUser?._id);
    const isOwner = tournament.owner === currentUser?._id;

    return (
        <>
            <TopHeader title={tournament.name || "TOURNAMENT"} onMenuClick={onMenuClick} />
            <div className={styles.detailContainer}>
                <div className={styles.header}>
                    <h1>{tournament.name}</h1>
                    <p>{tournament.participants?.length || 0} Players - Status: <strong>{tournament.status}</strong></p>
                    <div className={styles.actionButtons}>
                        {tournament.status === 'pending' && !isPlayerInTournament && (
                            <button onClick={handleJoin} className={`${styles.actionButton} ${styles.joinButton}`}>Join Tournament</button>
                        )}
                        {tournament.status === 'pending' && isOwner && (
                            <button onClick={handleStart} className={`${styles.actionButton} ${styles.startButton}`}>Start Tournament</button>
                        )}
                    </div>
                </div>

                {/* NYTT: Lista över deltagare */}
                {tournament.status === 'pending' && (
                    <div className={styles.participantsContainer}>
                        <h2 className={styles.participantsTitle}>Participants ({tournament.participants?.length || 0} / {tournament.maxParticipants})</h2>
                        <ul className={styles.participantsList}>
                            {tournament.participants?.map(player => (
                                <li key={player._id}>
                                    <Link to={`/user/${player._id}`} className={styles.playerLink}>{player.username}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className={styles.bracketContainer}>
                    {tournament.bracket?.rounds?.map((round, roundIndex) => (
                        <div key={roundIndex} className={styles.round}>
                            <h3 className={styles.roundTitle}>Round {roundIndex + 1}</h3>
                            {round.map((match, matchIndex) => {
                                const isMatchPlayer = match.players.some(p => p && p._id === currentUser?._id);

                                return (
                                    <div key={`${roundIndex}-${match.matchId || matchIndex}`} className={styles.match}>
                                        <div className={`${styles.player} ${match.winner === match.players[0]?._id ? styles.winner : ''}`}>
                                            {match.players[0] ? (
                                                <Link to={`/user/${match.players[0]._id}`} className={styles.playerLink}>{match.players[0].username}</Link>
                                            ) : 'TBD'}
                                        </div>
                                        <div className={`${styles.player} ${match.winner === match.players[1]?._id ? styles.winner : ''}`}>
                                            {match.players[1] ? (
                                                <Link to={`/user/${match.players[1]._id}`} className={styles.playerLink}>{match.players[1].username}</Link>
                                            ) : 'TBD'}
                                        </div>
                                        
                                        {/* NYTT: Knapp för att starta match */}
                                        {isMatchPlayer && tournament.status === 'active' && !match.winner && (
                                            <button 
                                                onClick={() => handleStartMatch(match.matchId)} 
                                                className={styles.startMatchButton}
                                            >
                                                Start Match
                                            </button>
                                        )}

                                        {match.status === 'in_progress' && (
                                            <Link to={`/spectate/${match.gameId}`} className={styles.spectateLink}>
                                                Spectate
                                            </Link>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};
export default TournamentDetailPage;