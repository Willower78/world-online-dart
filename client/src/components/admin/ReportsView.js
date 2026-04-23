import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../../pages/AdminPage.module.css'; // Reuse styles

const ReportsView = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Open'); // 'Open', 'UnderReview', 'Resolved'

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/reports');
            setReports(res.data);
        } catch (err) {
            toast.error('Failed to fetch reports.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleStatusChange = async (reportId, newStatus) => {
        try {
            const res = await axios.put(`/api/reports/${reportId}`, { status: newStatus });
            toast.success('Report status updated.');
            setReports(reports.map(r => r._id === reportId ? res.data : r));
        } catch (err) {
            toast.error('Failed to update report status.');
        }
    };

    const filteredReports = reports.filter(r => filter === 'All' || r.status === filter);

    return (
        <div className={styles.viewContainer}>
            <h2>Player Reports & Assistance Requests</h2>
            
            <div className={styles.filters}>
                <button onClick={() => setFilter('Open')} className={filter === 'Open' ? styles.activeFilter : ''}>Open</button>
                <button onClick={() => setFilter('UnderReview')} className={filter === 'UnderReview' ? styles.activeFilter : ''}>Under Review</button>
                <button onClick={() => setFilter('Resolved')} className={filter === 'Resolved' ? styles.activeFilter : ''}>Resolved</button>
                <button onClick={() => setFilter('All')} className={filter === 'All' ? styles.activeFilter : ''}>All</button>
            </div>

            {loading ? <p>Loading reports...</p> : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Reporter</th>
                            <th>Reported</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReports.map(report => (
                            <tr key={report._id}>
                                <td>{new Date(report.createdAt).toLocaleString()}</td>
                                <td><span className={`${styles.badge} ${styles[report.type.toLowerCase()]}`}>{report.type}</span></td>
                                <td>{report.reporter?.username || 'N/A'}</td>
                                <td>{report.reported?.username || 'N/A'}</td>
                                <td className={styles.reasonCell}>{report.reason || 'No reason provided.'}</td>
                                <td>{report.status}</td>
                                <td>
                                    <select 
                                        value={report.status} 
                                        onChange={(e) => handleStatusChange(report._id, e.target.value)}
                                        className={styles.actionSelect}
                                    >
                                        <option value="Open">Open</option>
                                        <option value="UnderReview">Under Review</option>
                                        <option value="Resolved">Resolved</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ReportsView;
