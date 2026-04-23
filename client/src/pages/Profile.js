import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import Spinner from '../components/Spinner';
import socket from '../socket/socket';
import TopHeader from '../components/TopHeader';
import styles from './Profile.module.css';

const Profile = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ 
        location: '', 
        birthdate: '',
        realName: '',
        nickname: '',
        address: '',
        city: '',
        country: ''
    });
    const [profilePicFile, setProfilePicFile] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [matchHistory, setMatchHistory] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const fetchProfileData = async () => {
            setLoading(true);
            try {
                const userRes = await axios.get('/api/users/me');
                const currentUser = userRes.data;
                setUser(currentUser);
                localStorage.setItem('user', JSON.stringify(currentUser));

                const matchRes = await axios.get(`/api/users/${currentUser._id}/matches`);
                setMatchHistory(matchRes.data);
                
                socket.emit('user_online', { userId: currentUser._id, username: currentUser.username });

            } catch (err) {
                console.error("Could not fetch profile data", err);
                if (err.response?.status === 401) {
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, [navigate]);

    useEffect(() => {
        if (user) {
            setFormData({
                location: user.location || '',
                birthdate: user.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : '',
                realName: user.realName || '',
                nickname: user.nickname || '',
                address: user.address || '',
                city: user.city || '',
                country: user.country || ''
            });
        }
    }, [user]);
    
    useEffect(() => {
        if (searchParams.get('payment_success')) {
            setFeedback('Thank you! Your premium membership is now active.');
            setTimeout(() => setFeedback(''), 5000);
        } else if (searchParams.get('payment_canceled')) {
            setFeedback('Your payment was canceled. You can try again anytime.');
            setTimeout(() => setFeedback(''), 5000);
        }
    }, [searchParams]);

    const handleSave = async () => {
        setFeedback('Saving...');
        try {
            if (profilePicFile) {
                const picFormData = new FormData();
                picFormData.append('profilePicture', profilePicFile);
                const picRes = await axios.post('/api/users/me/picture', picFormData);
                setUser(picRes.data);
                setProfilePicFile(null);
            }
            const res = await axios.put('/api/users/me', formData);
            const updatedUser = res.data;
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setFeedback('Profile updated successfully!');
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to save profile', err);
            setFeedback('Error: Could not save profile.');
        }
        setTimeout(() => setFeedback(''), 3000);
    };

    const handleCancel = () => {
        setIsEditing(false);
        if (user) {
            setFormData({
                location: user.location || '',
                birthdate: user.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : '',
                realName: user.realName || '',
                nickname: user.nickname || '',
                address: user.address || '',
                city: user.city || '',
                country: user.country || ''
            });
        }
    };

    const onLogout = () => {
        localStorage.clear();
        delete axios.defaults.headers.common['x-auth-token'];
        navigate('/login');
    };

    const getAge = (birthdate) => {
        if (!birthdate) return null;
        const age = new Date().getFullYear() - new Date(birthdate).getFullYear();
        return age > 0 ? age : null;
    };

    const getCalculatedLevel = (avg) => {
        if (!avg) return 'Unranked';
        if (avg >= 85) return 'Pro';
        if (avg >= 46) return 'Amateur';
        return 'Beginner';
    };

    const { onMenuClick } = useOutletContext();

    if (loading || !user) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spinner /></div>;
    }

    return (
        <>
            <TopHeader title="PROFILE" onMenuClick={onMenuClick} />
            <div className={styles.contentPadding}>
                <div className={styles.profileGrid}>
                    <div className={styles.leftColumn}>
                        {/* --- Profile Header Card --- */}
                        <div className={styles.card}>
                            <div className={styles.profileHeader}>
                                <div className={styles.avatarContainer}>
                                    <img src={`${user.profilePicture}?${new Date().getTime()}`} alt="Profile" className={styles.avatar} />
                                    {isEditing && (
                                        <div className={styles.uploadOverlay}>
                                            <input type="file" accept="image/*" onChange={(e) => setProfilePicFile(e.target.files[0])} className={styles.fileInput} />
                                            <span>📷</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className={styles.username}>{user.nickname || user.username}</h2>
                                <p className={styles.location}>{user.city && user.country ? `${user.city}, ${user.country}` : (user.location || 'Location not set')}</p>
                                <span className={`${styles.classificationBadge} ${styles[user.classification?.toLowerCase()]}`}>
                                    {user.classification || getCalculatedLevel(user.stats?.game_501?.threeDartAverage)}
                                </span>
                            </div>

                            {/* Centered Actions */}
                            <div className={styles.centeredActions}>
                                {isEditing ? (
                                    <>
                                        <button onClick={handleSave} className={`${styles.btn} ${styles.btnPrimary}`}>Save Changes</button>
                                        <button onClick={handleCancel} className={`${styles.btn} ${styles.btnSecondary}`}>Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => setIsEditing(true)} className={`${styles.btn} ${styles.btnPrimary} ${styles.wideBtn}`}>Edit Profile</button>
                                        <button onClick={onLogout} className={`${styles.btn} ${styles.btnLogout} ${styles.wideBtn}`}>Log Out</button>
                                    </>
                                )}
                            </div>
                            {feedback && <p className={styles.feedback}>{feedback}</p>}
                        </div>

                        {/* --- Stats Overview --- */}
                         <div className={styles.card}>
                            <h3 className={styles.cardTitle}>Performance Stats</h3>
                            <div className={styles.statsRow}>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Avg 3-Dart</span>
                                    <span className={styles.statValue}>{user.stats?.game_501?.threeDartAverage?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Matches</span>
                                    <span className={styles.statValue}>{user.stats?.totalMatches || 0}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Win Rate</span>
                                    <span className={styles.statValue}>
                                        {user.stats?.totalMatches > 0 
                                            ? Math.round((user.stats.wins / user.stats.totalMatches) * 100) + '%' 
                                            : '0%'}
                                    </span>
                                </div>
                            </div>
                         </div>

                        {/* --- Information Card --- */}
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>Details</h3>
                            {isEditing ? (
                                <form className={styles.editForm} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Real Name (Private)</label>
                                        <input className={styles.input} type="text" value={formData.realName} onChange={(e) => setFormData({ ...formData, realName: e.target.value })} placeholder="Full Name" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Nickname (Public)</label>
                                        <input className={styles.input} type="text" value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} placeholder="Nickname" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Address</label>
                                        <input className={styles.input} type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Street Address" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>City</label>
                                        <input className={styles.input} type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="City" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Country</label>
                                        <input className={styles.input} type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} placeholder="Country" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Birthdate</label>
                                        <input className={styles.input} type="date" value={formData.birthdate} onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })} />
                                    </div>
                                </form>
                            ) : (
                                <div className={styles.infoGrid}>
                                    <p><strong>Nickname:</strong> {user.nickname || 'N/A'}</p>
                                    <p><strong>Real Name:</strong> {user.realName || 'N/A'}</p>
                                    <p><strong>Location:</strong> {user.city && user.country ? `${user.city}, ${user.country}` : (user.location || 'N/A')}</p>
                                    <p><strong>Age:</strong> {getAge(user.birthdate) || 'N/A'}</p>
                                    <p><strong>Status:</strong> <span className={user.subscriptionStatus === 'active' ? styles.premiumText : ''}>{user.subscriptionStatus === 'active' ? 'Premium Member' : 'Standard Member'}</span></p>
                                </div>
                            )}
                            <div className={styles.centeredActions} style={{marginTop: '20px'}}>
                                <button onClick={() => navigate('/profile/calibration')} className={`${styles.btn} ${styles.btnSecondary} ${styles.wideBtn}`}>
                                    Camera Calibration
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.rightColumn}>
                        {/* --- Match History Card --- */}
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>Recent Matches</h3>
                            {matchHistory.length > 0 ? (
                                <ul className={styles.matchList}>
                                    {matchHistory.map(match => {
                                        const isWinner = match.winner._id === user._id;
                                        const opponent = isWinner ? match.loser : match.winner;
                                        return (
                                            <li key={match._id} className={styles.matchItem} onClick={() => setSelectedMatch(selectedMatch?._id === match._id ? null : match)}>
                                                <div className={styles.matchSummary}>
                                                    <div className={styles.matchResult}>
                                                        <span className={isWinner ? styles.winIndicator : styles.lossIndicator}>{isWinner ? 'W' : 'L'}</span>
                                                        <span className={styles.opponentName}>vs {opponent.username}</span>
                                                    </div>
                                                    <span className={styles.matchDate}>{new Date(match.playedAt).toLocaleDateString()}</span>
                                                </div>
                                                {selectedMatch?._id === match._id && (
                                                    <div className={styles.matchDetails}>
                                                        <p>Score: {match.finalScores[user._id]} - {match.finalScores[opponent._id]}</p>
                                                        <p>Mode: {match.gameType}</p>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p style={{textAlign: 'center', color: 'var(--text-gray)'}}>No matches played yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Profile;