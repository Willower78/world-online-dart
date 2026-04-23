import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './FederationDashboard.module.css';
import { toast } from 'react-toastify';
import Spinner from '../components/Spinner';

const FederationDashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [players, setPlayers] = useState([]);
    const [leagues, setLeagues] = useState([]);
    const [tournaments, setTournaments] = useState([]);
    
    // Modals
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
    const [showCreateTournamentModal, setShowCreateTournamentModal] = useState(false);
    
    // Forms
    const [registerData, setRegisterData] = useState({
        username: '', email: '', password: '', location: '', birthdate: ''
    });
    const [leagueData, setLeagueData] = useState({
        name: '', region: 'Scandinavian', entryFeeEuros: 10, maxPlayersPerDivision: 20
    });
    const [tournamentData, setTournamentData] = useState({
        name: '', gameType: '501', maxParticipants: 32, entryFeeGoldStars: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [playersRes, leaguesRes] = await Promise.all([
                axios.get('/api/federation/players'),
                axios.get('/api/federation/leagues')
                // axios.get('/api/federation/tournaments') // Add this if endpoint exists
            ]);
            setPlayers(playersRes.data);
            setLeagues(leaguesRes.data);
            // setTournaments(tournamentsRes.data);
        } catch (err) {
            console.error("Error fetching federation data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterChange = (e) => setRegisterData({ ...registerData, [e.target.name]: e.target.value });
    const handleLeagueChange = (e) => setLeagueData({ ...leagueData, [e.target.name]: e.target.value });
    const handleTournamentChange = (e) => setTournamentData({ ...tournamentData, [e.target.name]: e.target.value });

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/federation/players/register', registerData);
            toast.success('Player registered successfully');
            setShowRegisterModal(false);
            setRegisterData({ username: '', email: '', password: '', location: '', birthdate: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Error registering player');
        }
    };

    const handleCreateLeague = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/federation/leagues', leagueData);
            toast.success('League created successfully');
            setShowCreateLeagueModal(false);
            setLeagueData({ name: '', region: 'Scandinavian', entryFeeEuros: 10, maxPlayersPerDivision: 20 });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Error creating league');
        }
    };

    const handleCreateTournament = async (e) => {
        e.preventDefault();
        try {
            // Mapping simpler form data to schema requirements
            const payload = {
                ...tournamentData,
                category: 'Standard',
                entryFeeSilverStars: 0,
                allowedClassifications: ['Beginner', 'Amateur', 'Pro'],
                prizeDistribution: [50, 30, 20] // Default
            };
            await axios.post('/api/federation/tournaments', payload);
            toast.success('Tournament created successfully');
            setShowCreateTournamentModal(false);
            setTournamentData({ name: '', gameType: '501', maxParticipants: 32, entryFeeGoldStars: 0 });
            // fetchData(); // Refresh tournaments
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Error creating tournament');
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className={styles.dashboardContainer}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Federation Dashboard</h1>
                    <p className={styles.subtitle}>Manage your region's darts activities</p>
                </div>
                <button className={styles.actionButton} onClick={() => fetchData()}>Refresh Data</button>
            </header>

            <div className={styles.tabs}>
                <button className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={`${styles.tab} ${activeTab === 'players' ? styles.activeTab : ''}`} onClick={() => setActiveTab('players')}>Players</button>
                <button className={`${styles.tab} ${activeTab === 'leagues' ? styles.activeTab : ''}`} onClick={() => setActiveTab('leagues')}>Leagues</button>
                <button className={`${styles.tab} ${activeTab === 'tournaments' ? styles.activeTab : ''}`} onClick={() => setActiveTab('tournaments')}>Tournaments</button>
            </div>

            {activeTab === 'overview' && (
                <div className={styles.grid}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}><h3 className={styles.cardTitle}>Total Players</h3></div>
                        <div className={styles.statValue}>{players.length}</div>
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}><h3 className={styles.cardTitle}>Active Leagues</h3></div>
                        <div className={styles.statValue}>{leagues.length}</div>
                    </div>
                </div>
            )}

            {activeTab === 'players' && (
                <div className={styles.tableContainer}>
                    <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>Registered Players</h3>
                        <button className={styles.actionButton} onClick={() => setShowRegisterModal(true)}>+ Register New Player</button>
                    </div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Location</th>
                                <th>Avg 3-Dart</th>
                                <th>180s</th>
                                <th>High Out</th>
                                <th>Matches</th>
                                <th>Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map(player => (
                                <tr key={player._id}>
                                    <td>{player.username}</td>
                                    <td>{player.location || '-'}</td>
                                    <td>{player.stats?.game_501?.threeDartAverage?.toFixed(2) || '0.00'}</td>
                                    <td>{player.stats?.game_501?.oneEighties || 0}</td>
                                    <td>{player.stats?.game_501?.highOut || 0}</td>
                                    <td>{player.stats?.totalMatches || 0}</td>
                                    <td>{player.classification}</td>
                                </tr>
                            ))}
                            {players.length === 0 && <tr><td colSpan="7" style={{textAlign: 'center'}}>No players found in your region.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'leagues' && (
                <div className={styles.tableContainer}>
                    <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>My Leagues</h3>
                        <button className={styles.actionButton} onClick={() => setShowCreateLeagueModal(true)}>+ Create League</button>
                    </div>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Name</th><th>Region</th><th>Status</th><th>Divisions</th></tr>
                        </thead>
                        <tbody>
                            {leagues.map(league => (
                                <tr key={league._id}>
                                    <td>{league.name}</td>
                                    <td>{league.region}</td>
                                    <td>{league.status}</td>
                                    <td>{league.divisions?.length || 0}</td>
                                </tr>
                            ))}
                             {leagues.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center'}}>No leagues created yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'tournaments' && (
                <div className={styles.tableContainer}>
                    <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>My Tournaments</h3>
                        <button className={styles.actionButton} onClick={() => setShowCreateTournamentModal(true)}>+ Create Tournament</button>
                    </div>
                    <div style={{padding: '20px', textAlign: 'center', color: '#888'}}>
                        Tournaments list coming soon...
                    </div>
                </div>
            )}

            {/* REGISTER MODAL */}
            {showRegisterModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2 className={styles.cardTitle} style={{marginBottom: '20px'}}>Register New Player</h2>
                        <form onSubmit={handleRegisterSubmit}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Username</label>
                                <input type="text" name="username" value={registerData.username} onChange={handleRegisterChange} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Email</label>
                                <input type="email" name="email" value={registerData.email} onChange={handleRegisterChange} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Password</label>
                                <input type="password" name="password" value={registerData.password} onChange={handleRegisterChange} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Location (City/Country)</label>
                                <input type="text" name="location" value={registerData.location} onChange={handleRegisterChange} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Birthdate</label>
                                <input type="date" name="birthdate" value={registerData.birthdate} onChange={handleRegisterChange} />
                            </div>
                            <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                                <button type="submit" className={styles.actionButton} style={{flex: 1}}>Register</button>
                                <button type="button" className={styles.actionButton} style={{flex: 1, background: 'var(--bg-sidebar)'}} onClick={() => setShowRegisterModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE LEAGUE MODAL */}
            {showCreateLeagueModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2 className={styles.cardTitle} style={{marginBottom: '20px'}}>Create League</h2>
                        <form onSubmit={handleCreateLeague}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>League Name</label>
                                <input type="text" name="name" value={leagueData.name} onChange={handleLeagueChange} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Region</label>
                                <select name="region" value={leagueData.region} onChange={handleLeagueChange} className={styles.select}>
                                    <option value="Scandinavian">Scandinavian</option>
                                    <option value="British">British</option>
                                    <option value="Dutch">Dutch</option>
                                    <option value="German">German</option>
                                    <option value="American">American</option>
                                    <option value="Asian">Asian</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Entry Fee (€)</label>
                                <input type="number" name="entryFeeEuros" value={leagueData.entryFeeEuros} onChange={handleLeagueChange} />
                            </div>
                            <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                                <button type="submit" className={styles.actionButton} style={{flex: 1}}>Create</button>
                                <button type="button" className={styles.actionButton} style={{flex: 1, background: 'var(--bg-sidebar)'}} onClick={() => setShowCreateLeagueModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE TOURNAMENT MODAL */}
            {showCreateTournamentModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2 className={styles.cardTitle} style={{marginBottom: '20px'}}>Create Tournament</h2>
                        <form onSubmit={handleCreateTournament}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Tournament Name</label>
                                <input type="text" name="name" value={tournamentData.name} onChange={handleTournamentChange} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Game Type</label>
                                <select name="gameType" value={tournamentData.gameType} onChange={handleTournamentChange} className={styles.select}>
                                    <option value="501">501</option>
                                    <option value="cricket">Cricket</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Max Participants</label>
                                <input type="number" name="maxParticipants" value={tournamentData.maxParticipants} onChange={handleTournamentChange} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Entry Fee (Gold Stars)</label>
                                <input type="number" name="entryFeeGoldStars" value={tournamentData.entryFeeGoldStars} onChange={handleTournamentChange} />
                            </div>
                            <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                                <button type="submit" className={styles.actionButton} style={{flex: 1}}>Create</button>
                                <button type="button" className={styles.actionButton} style={{flex: 1, background: 'var(--bg-sidebar)'}} onClick={() => setShowCreateTournamentModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FederationDashboard;
