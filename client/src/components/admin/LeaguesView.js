import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../../pages/AdminPage.module.css'; // Reuse styles from AdminPage

const LeaguesView = () => {
    const [leagues, setLeagues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        region: 'Scandinavian',
        entryFeeEuros: 10,
        perGameFeeSilverStars: 1,
        maxPlayersPerDivision: 20,
    });

    const fetchLeagues = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/leagues');
            setLeagues(res.data);
        } catch (err) {
            toast.error('Failed to fetch leagues.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeagues();
    }, []);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateLeague = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/admin/leagues', formData);
            toast.success(res.data.msg || 'League created successfully!');
            fetchLeagues(); // Refresh the list
            // Reset form
            setFormData({
                name: '', region: 'Scandinavian', entryFeeEuros: 10,
                perGameFeeSilverStars: 1, maxPlayersPerDivision: 20
            });
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to create league.');
        }
    };

    const handleGenerateSchedule = async (leagueId) => {
        if (!window.confirm('Are you sure you want to generate the schedule? This will start the league and prevent new players from joining.')) return;
        try {
            const res = await axios.post(`/api/admin/leagues/${leagueId}/generate-schedule`);
            toast.success(res.data.msg || 'Schedule generation initiated!');
            fetchLeagues(); // Refresh to show status change
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to generate schedule.');
        }
    };

    return (
        <div className={styles.viewContainer}>
            <h2>Manage Leagues</h2>
            
            <div className={styles.card}>
                <h3>Create New League</h3>
                <form onSubmit={handleCreateLeague} className={styles.formGrid}>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="League Name" required />
                    <select name="region" value={formData.region} onChange={handleInputChange}>
                        <option>Scandinavian</option>
                        <option>British</option>
                        <option>Dutch</option>
                        <option>German</option>
                        <option>Asian</option>
                        <option>American</option>
                    </select>
                    <input type="number" name="entryFeeEuros" value={formData.entryFeeEuros} onChange={handleInputChange} placeholder="Entry Fee (EUR)" required />
                    <input type="number" name="perGameFeeSilverStars" value={formData.perGameFeeSilverStars} onChange={handleInputChange} placeholder="Fee (Silver Stars)" required />
                    <button type="submit">Create League</button>
                </form>
            </div>

            <div className={styles.card}>
                <h3>Existing Leagues</h3>
                {loading ? <p>Loading leagues...</p> : (
                    <ul className={styles.list}>
                        {leagues.map(league => (
                            <li key={league._id} className={styles.listItem}>
                                <span>{league.name} ({league.region}) - <strong>{league.status}</strong></span>
                                {league.status === 'Recruiting' && (
                                    <button onClick={() => handleGenerateSchedule(league._id)} className={styles.actionButton}>
                                        Generate Schedule
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default LeaguesView;
