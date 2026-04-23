import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './TournamentsPage.module.css';

const TournamentsPage = () => {
    const [tournaments, setTournaments] = useState([]);
    const [newTournamentName, setNewTournamentName] = useState('');
    const [newTournamentGameType, setNewTournamentGameType] = useState('501');
    const [isCreating, setIsCreating] = useState(false); // Toggle for create mode
    const navigate = useNavigate();

    const fetchTournaments = async () => {
        try {
            const res = await axios.get('/api/tournaments');
            setTournaments(res.data);
        } catch (err) {
            toast.error('Failed to fetch tournaments.');
            console.error(err);
        }
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    const handleCreateTournament = async (e) => {
        e.preventDefault();
        if (newTournamentName.trim() === '') {
            toast.warn('Please enter a tournament name.');
            return;
        }
        try {
            const res = await axios.post('/api/tournaments', { name: newTournamentName, gameType: newTournamentGameType });
            toast.success('Tournament created successfully!');
            navigate(`/tournaments/${res.data._id}`);
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to create tournament.');
        }
    };

    const liveTournaments = tournaments.filter(t => t.status === 'active' || t.status === 'InProgress');
    const upcomingTournaments = tournaments.filter(t => t.status !== 'active' && t.status !== 'InProgress');

    return (
        <div className={styles.tournamentsContainer}>
            <header className={styles.pageHeader}>
                <h1 className={styles.header}>Tournaments</h1>
                <p className={styles.subHeader}>Join a live tournament or host your own.</p>
            </header>

            {/* LIVE TOURNAMENTS */}
            {liveTournaments.length > 0 && (
                <>
                    <h2 className={styles.sectionHeader}>Live Tournaments</h2>
                    <div className={styles.grid}>
                        {liveTournaments.map(tourney => (
                            <Link key={tourney._id} to={`/tournaments/${tourney._id}`} className={styles.tournamentCard}>
                                <div className={styles.cardStatus} data-status={tourney.status}>
                                    {tourney.status}
                                </div>
                                <h3 className={styles.tourneyName}>{tourney.name}</h3>
                                <div className={styles.tourneyInfo}>
                                    <span>🎯 {tourney.gameType || '501'}</span>
                                    <span>👥 {tourney.participants?.length || 0} Players</span>
                                </div>
                                <div className={styles.tourneyFooter}>
                                    View Bracket &rarr;
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            )}

            {/* JOIN NEW / UPCOMING */}
            <h2 className={styles.sectionHeader}>Join New</h2>
            <div className={styles.grid}>
                {/* Create New Card */}
                <div className={`${styles.card} ${styles.createCard}`}>
                    {!isCreating ? (
                        <div className={styles.createPlaceholder} onClick={() => setIsCreating(true)}>
                            <div className={styles.plusIcon}>+</div>
                            <h3>Host Tournament</h3>
                            <p>Create a new bracket and invite players</p>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateTournament} className={styles.createForm}>
                            <h3>New Tournament</h3>
                            <input
                                type="text"
                                value={newTournamentName}
                                onChange={(e) => setNewTournamentName(e.target.value)}
                                placeholder="Tournament Name"
                                className={styles.createInput}
                                autoFocus
                            />
                            <select
                                value={newTournamentGameType}
                                onChange={(e) => setNewTournamentGameType(e.target.value)}
                                className={styles.createInput}
                            >
                                <option value="501">501</option>
                                <option value="cricket">Cricket</option>
                            </select>
                            <div className={styles.formActions}>
                                <button type="submit" className={styles.createButton}>Create</button>
                                <button 
                                    type="button" 
                                    className={styles.cancelButton}
                                    onClick={() => setIsCreating(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Upcoming Tournament List */}
                {upcomingTournaments.map(tourney => (
                    <Link key={tourney._id} to={`/tournaments/${tourney._id}`} className={styles.tournamentCard}>
                        <div className={styles.cardStatus} data-status={tourney.status}>
                            {tourney.status}
                        </div>
                        <h3 className={styles.tourneyName}>{tourney.name}</h3>
                        <div className={styles.tourneyInfo}>
                            <span>🎯 {tourney.gameType || '501'}</span>
                            <span>👥 {tourney.participants?.length || 0} Players</span>
                        </div>
                        <div className={styles.tourneyFooter}>
                            View Bracket &rarr;
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default TournamentsPage;
