import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../../pages/AdminPage.module.css';
import { FaTrash, FaRobot } from 'react-icons/fa';

const TournamentsView = () => {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTournaments = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get('/api/tournaments/admin/all');
            setTournaments(data);
        } catch (err) {
            toast.error('Could not fetch tournaments.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTournaments();
    }, [fetchTournaments]);

    const handleDelete = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete the tournament "${name}"?`)) {
            try {
                await axios.delete(`/api/tournaments/${id}`);
                toast.success(`Tournament "${name}" deleted.`);
                fetchTournaments();
            } catch (err) {
                toast.error('Failed to delete tournament.');
            }
        }
    };

    const handleFill = async (id) => {
        try {
            const { data } = await axios.post(`/api/tournaments/admin/${id}/fill`);
            toast.success(data.msg);
            fetchTournaments();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to fill tournament.');
        }
    };

    if (loading) return <p>Loading tournaments...</p>;

    return (
        <table className={styles.table}>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Game Type</th>
                    <th>Status</th>
                    <th>Players</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {tournaments.map(t => (
                    <tr key={t._id}>
                        <td>{t.name}</td>
                        <td>{t.gameType}</td>
                        <td>{t.status}</td>
                        <td>{t.participants.length} / {t.maxParticipants}</td>
                        <td>
                            {t.status === 'pending' && (
                                <button className={`${styles.actionButton} ${styles.fillButton}`} onClick={() => handleFill(t._id)}>
                                    <FaRobot /> Fill
                                </button>
                            )}
                            <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={() => handleDelete(t._id, t.name)}>
                                <FaTrash /> Delete
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default TournamentsView;