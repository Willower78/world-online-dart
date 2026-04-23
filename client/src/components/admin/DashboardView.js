import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../../pages/AdminPage.module.css'; // Återanvänd stilen från huvudsidan

const DashboardView = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const { data } = await axios.get('/api/admin/stats');
                setStats(data);
            } catch (err) {
                toast.error('Could not fetch admin stats.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <p>Loading statistics...</p>;
    if (!stats) return <p>Could not load statistics.</p>;

    const handleUpgradeAll = async () => {
        if (window.confirm('Are you sure you want to upgrade ALL users to premium? This cannot be undone.')) {
            try {
                const { data } = await axios.post('/api/admin/upgrade-all-users');
                toast.success(data.msg || 'All users upgraded successfully!');
            } catch (err) {
                toast.error(err.response?.data?.msg || 'An error occurred.');
            }
        }
    };

    return (
        <>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}><h3>Total Users</h3><p>{stats.users.total}</p></div>
                <div className={styles.statCard}><h3>Active Users (7d)</h3><p>{stats.users.active}</p></div>
                <div className={styles.statCard}><h3>Total Matches</h3><p>{stats.matches.total}</p></div>
                <div className={styles.statCard}><h3>Total Tournaments</h3><p>{stats.tournaments.total}</p></div>
                <div className={styles.statCard}><h3>Total Rewards</h3><p>{stats.rewards.total}</p></div>
            </div>
            <div className={styles.actionsCard}>
                <h3>Admin Actions</h3>
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    <div style={{flex: 1, minWidth: '200px'}}>
                        <button onClick={handleUpgradeAll} className={styles.actionButton}>
                            Upgrade All Users to Premium
                        </button>
                        <p style={{fontSize: '0.8rem', color: '#aaa', marginTop: '5px'}}>Sets subscription status of every user to 'active'.</p>
                    </div>
                    <div style={{flex: 1, minWidth: '200px'}}>
                         <button onClick={async () => {
                             if(window.confirm('Create default leagues?')) {
                                 try {
                                     const { data } = await axios.post('/api/admin/seed-leagues');
                                     toast.success(data.msg);
                                 } catch(err) { toast.error('Failed to seed leagues'); }
                             }
                         }} className={styles.actionButton} style={{background: 'var(--accent-green)', color: 'black'}}>
                            Seed Default Leagues
                        </button>
                        <p style={{fontSize: '0.8rem', color: '#aaa', marginTop: '5px'}}>Creates the 5 default WOD leagues if they don't exist.</p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DashboardView;
