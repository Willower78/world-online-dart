import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../../pages/AdminPage.module.css';
import { FaGift, FaPaperPlane } from 'react-icons/fa';

const RewardsView = () => {
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [newReward, setNewReward] = useState({
        userId: '',
        amount: '',
        description: ''
    });

    const fetchRewards = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get('/api/admin/rewards');
            setRewards(data.rewards);
        } catch (err) {
            toast.error('Could not fetch rewards.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            // Hämta bara första sidan av användare för att fylla dropdown
            const { data } = await axios.get('/api/admin/users?limit=100');
            setUsers(data.users);
            if (data.users.length > 0) {
                setNewReward(prev => ({ ...prev, userId: data.users[0]._id }));
            }
        } catch (err) {
            toast.error('Could not fetch users for reward form.');
        }
    }, []);

    useEffect(() => {
        fetchRewards();
        fetchUsers();
    }, [fetchRewards, fetchUsers]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewReward(prev => ({ ...prev, [name]: value }));
    };

    const handleGrantReward = async (e) => {
        e.preventDefault();
        if (!newReward.userId || !newReward.amount || !newReward.description) {
            return toast.warn('Please fill out all fields.');
        }
        try {
            await axios.post('/api/admin/rewards', newReward);
            toast.success('Reward granted successfully!');
            setNewReward({ userId: users[0]?._id || '', amount: '', description: '' });
            fetchRewards();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to grant reward.');
        }
    };

    if (loading) return <p>Loading rewards...</p>;

    return (
        <div>
            <div className={styles.formSection}>
                <h3><FaGift /> Grant New Reward</h3>
                <form onSubmit={handleGrantReward} className={styles.grantForm}>
                    <select name="userId" value={newReward.userId} onChange={handleInputChange}>
                        {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                    </select>
                    <input 
                        type="number"
                        name="amount"
                        placeholder="Amount"
                        value={newReward.amount}
                        onChange={handleInputChange}
                    />
                    <input 
                        type="text"
                        name="description"
                        placeholder="Description (e.g., Weekly bonus)"
                        value={newReward.description}
                        onChange={handleInputChange}
                    />
                    <button type="submit" className={`${styles.actionButton} ${styles.grantButton}`}>
                        <FaPaperPlane /> Grant
                    </button>
                </form>
            </div>

            <h3 style={{marginTop: '40px'}}>Reward History</h3>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    {rewards.map(reward => (
                        <tr key={reward._id}>
                            <td>{reward.userId?.username || 'N/A'}</td>
                            <td>{reward.type}</td>
                            <td>{reward.amount}</td>
                            <td>{reward.description}</td>
                            <td>{new Date(reward.createdAt).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RewardsView;
