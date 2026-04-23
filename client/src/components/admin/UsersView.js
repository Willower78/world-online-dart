import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../../pages/AdminPage.module.css';
import { FaUserSlash, FaUserCheck } from 'react-icons/fa';

const UsersView = () => {
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [editingUserId, setEditingUserId] = useState(null);
    const [editForm, setEditForm] = useState({ role: 'player', federationRegion: '' });

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`/api/admin/users?page=${page}&limit=10`);
            setUsers(data.users);
            setPagination(data.pagination);
        } catch (err) {
            toast.error('Could not fetch users.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleToggleBan = async (userId, isBanned) => {
        try {
            await axios.put(`/api/admin/users/${userId}/ban`, { isBanned: !isBanned });
            toast.success(`User has been ${!isBanned ? 'banned' : 'unbanned'}.`);
            fetchUsers(); // Refresh list
        } catch (err) {
            toast.error('Failed to update user status.');
        }
    };

    const startEdit = (user) => {
        setEditingUserId(user._id);
        setEditForm({ role: user.role || 'player', federationRegion: user.federationRegion || '' });
    };

    const cancelEdit = () => {
        setEditingUserId(null);
        setEditForm({ role: 'player', federationRegion: '' });
    };

    const saveEdit = async (userId) => {
        try {
            await axios.put(`/api/users/admin/manage/${userId}`, editForm);
            toast.success('User updated successfully.');
            setEditingUserId(null);
            fetchUsers();
        } catch (err) {
            toast.error('Failed to update user.');
        }
    };

    const downloadCSV = () => {
        if (!users.length) return;
        const headers = ["Username", "Email", "Role", "Region", "Status"];
        const rows = users.map(u => [
            u.username, 
            u.email, 
            u.role, 
            u.federationRegion || '', 
            u.isBanned ? 'Banned' : 'Active'
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "users_list.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <p>Loading users...</p>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button className={styles.actionButton} onClick={downloadCSV}>Export List to CSV</button>
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Region (Fed)</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user._id}>
                            <td>{user.username}</td>
                            <td>{user.email}</td>
                            
                            {/* Role Column */}
                            <td>
                                {editingUserId === user._id ? (
                                    <select 
                                        className={styles.actionSelect}
                                        value={editForm.role} 
                                        onChange={e => setEditForm({...editForm, role: e.target.value})}
                                    >
                                        <option value="player">Player</option>
                                        <option value="admin">Admin</option>
                                        <option value="federation">Federation</option>
                                    </select>
                                ) : (
                                    <span className={styles.badge} style={{backgroundColor: user.role === 'admin' ? '#e74c3c' : user.role === 'federation' ? '#f39c12' : '#3498db'}}>
                                        {user.role}
                                    </span>
                                )}
                            </td>

                            {/* Region Column */}
                            <td>
                                {editingUserId === user._id && editForm.role === 'federation' ? (
                                    <input 
                                        type="text" 
                                        placeholder="City/Country"
                                        className={styles.actionSelect}
                                        value={editForm.federationRegion}
                                        onChange={e => setEditForm({...editForm, federationRegion: e.target.value})}
                                    />
                                ) : (
                                    user.federationRegion || '-'
                                )}
                            </td>

                            <td>{user.isBanned ? <span style={{color: 'var(--error-color)'}}>Banned</span> : 'Active'}</td>
                            
                            <td>
                                <div style={{display: 'flex', gap: '5px'}}>
                                    {editingUserId === user._id ? (
                                        <>
                                            <button className={`${styles.actionButton} ${styles.unbanButton}`} onClick={() => saveEdit(user._id)}>Save</button>
                                            <button className={`${styles.actionButton} ${styles.banButton}`} onClick={cancelEdit}>Cancel</button>
                                        </>
                                    ) : (
                                        <>
                                            <button className={styles.actionButton} onClick={() => startEdit(user)}>Edit</button>
                                            <button 
                                                className={`${styles.actionButton} ${user.isBanned ? styles.unbanButton : styles.banButton}`}
                                                onClick={() => handleToggleBan(user._id, user.isBanned)}
                                            >
                                                {user.isBanned ? <FaUserCheck /> : <FaUserSlash />}
                                            </button>
                                        </>
                                    )}
                                </div>
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

export default UsersView;