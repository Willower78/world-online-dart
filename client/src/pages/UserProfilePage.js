import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Spinner from '../components/Spinner';
import TopHeader from '../components/TopHeader';
import { useOutletContext } from 'react-router-dom';
import styles from './UserProfilePage.module.css';

const UserProfilePage = () => {
    const { userId } = useParams();
    const { onMenuClick } = useOutletContext();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [matchHistory, setMatchHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [loggedInUser] = useState(() => JSON.parse(localStorage.getItem('user')) || null);


    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                setLoading(true);
                const userRes = await axios.get(`/api/users/${userId}`);
                setUser(userRes.data);

                const statsRes = await axios.get(`/api/stats/user/${userId}`);
                setStats(statsRes.data);

                const matchesRes = await axios.get(`/api/stats/matches/${userId}`);
                setMatchHistory(matchesRes.data.matches);

            } catch (err) {
                console.error(err);
                setError('Could not load user profile data.');
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [userId]);

    const handleAddFriend = async () => {
        try {
            await axios.post(`/api/friends/request/${userId}`);
            alert('Friend request sent!');
        } catch (err) {
            alert(err.response?.data?.msg || 'Could not send friend request.');
        }
    };

    const getAge = (birthdate) => {
        if (!birthdate) return 'Not specified';
        const age = new Date().getFullYear() - new Date(birthdate).getFullYear();
        return age > 0 ? age : 'Not specified';
    };

    if (loading) {
        return (
            <>
                <TopHeader title="Loading Profile..." onMenuClick={onMenuClick} />
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner /></div>
            </>
        );
    }

    if (error) {
         return (
            <>
                <TopHeader title="Error" onMenuClick={onMenuClick} />
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent-red)' }}>{error}</div>
            </>
        );
    }
    
    if (!user) {
         return (
            <>
                <TopHeader title="Not Found" onMenuClick={onMenuClick} />
                <div style={{ textAlign: 'center', padding: '2rem' }}>User not found.</div>
            </>
        );
    }

    // Determine if the viewed user is already a friend
    const isFriend = loggedInUser?.friends?.includes(userId);

    return (
        <>
            <TopHeader title={user.username.toUpperCase()} onMenuClick={onMenuClick} />
            <div className={styles.contentPadding}>
                <div className={styles.profileGrid}>
                    <div className={styles.leftColumn}>
                        {/* --- Profile Header Card --- */}
                        <div className={styles.card}>
                            <div className={styles.profileHeader}>
                                <div className={styles.avatarContainer}>
                                    <img src={`${user.profilePicture}`} alt="Profile" className={styles.avatar} />
                                </div>
                                <div className={styles.userInfo}>
                                    <h2 className={styles.username}>{user.username}</h2>
                                    <p className={styles.memberSince}>Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            {loggedInUser && loggedInUser._id !== userId && !isFriend && (
                                <div className={styles.buttonGroup}>
                                    <button onClick={handleAddFriend} className={`${styles.btn} ${styles.btnPrimary}`}>Add Friend</button>
                                </div>
                            )}
                        </div>

                        {/* --- Profile Info Card --- */}
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>Information</h3>
                             <div className={styles.infoGrid}>
                                <p><strong>Email:</strong> {user.email}</p>
                                <p><strong>Location:</strong> {user.location || 'Not specified'}</p>
                                <p><strong>Classification:</strong> <span className={styles.classificationBadge}>{user.classification || 'Unranked'}</span></p>
                                <p><strong>Avg Throw (501):</strong> {stats?.game_501?.threeDartAverage?.toFixed(2) || '0.00'}</p>
                                <p><strong>Status:</strong> <span className={user.subscriptionStatus === 'active' ? styles.premiumText : ''}>{user.subscriptionStatus === 'active' ? 'Premium' : 'Standard'}</span></p>
                            </div>
                        </div>

                        {/* --- Stats Card --- */}
                        {stats && (
                             <div className={styles.card}>
                                <h3 className={styles.cardTitle}>Statistics</h3>
                                <div className={styles.infoGrid}>
                                    <p><strong>Total Matches:</strong> {stats.totalMatches}</p>
                                    <p><strong>Wins:</strong> {stats.wins}</p>
                                    <p><strong>Losses:</strong> {stats.losses}</p>
                                    <p><strong>Win Rate:</strong> {stats.winRate}%</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.rightColumn}>
                        {/* --- Match History Card --- */}
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>Match History</h3>
                            {matchHistory.length > 0 ? (
                                <ul className={styles.matchList}>
                                    {matchHistory.map(match => {
                                        const isWinner = match.winner?._id === userId;
                                        const opponent = match.players.find(p => p._id !== userId);
                                        return (
                                            <li key={match._id} className={styles.matchItem}>
                                                <div className={styles.matchSummary}>
                                                    <span className={isWinner ? styles.win : styles.loss}>{isWinner ? 'WIN' : 'LOSS'}</span>
                                                    <span>vs {opponent ? <Link to={`/user/${opponent._id}`}>{opponent.username}</Link> : 'N/A'}</span>
                                                    <span className={styles.matchDate}>{new Date(match.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p>No matches played yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserProfilePage;