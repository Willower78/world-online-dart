import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../../pages/AdminPage.module.css';
import { FaTrash } from 'react-icons/fa';

const MatchesView = () => {
    const [matches, setMatches] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetchMatches = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`/api/admin/matches?page=${page}&limit=10`);
            setMatches(data.matches);
            setPagination(data.pagination);
        } catch (err) {
            toast.error('Could not fetch matches.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const handleDelete = async (id) => {
        if (window.confirm(`Are you sure you want to delete this match record?`)) {
            try {
                await axios.delete(`/api/admin/matches/${id}`);
                toast.success('Match record deleted.');
                fetchMatches();
            } catch (err) {
                toast.error('Failed to delete match record.');
            }
        }
    };

    if (loading) return <p>Loading matches...</p>;

    return (
        <div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Game Type</th>
                        <th>Winner</th>
                        <th>Loser</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {matches.map(match => (
                        <tr key={match._id}>
                            <td>{match.gameType}</td>
                            <td>{match.winner?.username || 'N/A'}</td>
                            <td>{match.loser?.username || 'N/A'}</td>
                            <td>{new Date(match.createdAt).toLocaleString()}</td>
                            <td>
                                <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={() => handleDelete(match._id)}>
                                    <FaTrash /> Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {pagination && (
                <div className={styles.pagination}>
                    <span>Page {pagination.page} of {pagination.pages}</span>
                    <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</button>
                    <button onClick={() => setPage(p => p + 1)} disabled={page === pagination.pages}>Next</button>
                </div>
            )}
        </div>
    );
};

export default MatchesView;