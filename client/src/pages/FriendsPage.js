import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import socket from '../socket/socket';
import { toast } from 'react-toastify';
import styles from './FriendsPage.module.css';

const FriendsPage = () => {
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [challengedFriends, setChallengedFriends] = useState([]);

    const fetchData = async () => {
        try {
            const res = await axios.get('/api/friends');
            setFriends(res.data.friends || []);
            setRequests(res.data.friendRequests || []);
        } catch (err) {
            toast.error('Could not fetch friends list.');
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();

        const handleFriendStatusUpdate = ({ userId, isOnline }) => {
            setFriends(prevFriends =>
                prevFriends.map(friend =>
                    friend._id === userId ? { ...friend, isOnline } : friend
                )
            );
        };

        const handleNewFriendRequest = () => {
            toast.info("You have a new friend request!");
            fetchData(); // Refetch all data to show the new request
        };

        const handleInviteDeclined = ({ from }) => {
            // Re-enable the challenge button if the challenge is declined
            setChallengedFriends(prev => prev.filter(id => id !== from.id));
            toast.warn(`${from.username} declined your challenge.`);
        };

        socket.on('friend_status_update', handleFriendStatusUpdate);
        socket.on('friend_request_received', handleNewFriendRequest);
        socket.on('invite_declined', handleInviteDeclined);

        return () => {
            socket.off('friend_status_update', handleFriendStatusUpdate);
            socket.off('friend_request_received', handleNewFriendRequest);
            socket.off('invite_declined', handleInviteDeclined);
        };
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (searchQuery.trim() === '') return;
        try {
            const res = await axios.get(`/api/users/search?q=${searchQuery}`);
            setSearchResults(res.data);
        } catch (err) {
            toast.error('Error searching for users.');
        }
    };

    const handleSendRequest = async (recipientId) => {
        try {
            await axios.post(`/api/friends/request/${recipientId}`);
            toast.success('Friend request sent!');
            setSearchResults([]); // Clear search results after sending
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Could not send friend request.');
        }
    };

    const handleRequestResponse = async (senderId, action) => {
        try {
            await axios.post(`/api/friends/${action}/${senderId}`);
            toast.success(`Friend request ${action}ed.`);
            fetchData(); // Refetch data to update lists
        } catch (err) {
            toast.error(err.response?.data?.msg || 'An error occurred.');
        }
    };

    const handleChallenge = (friendId, gameType = '501') => { // Defaulting to 501
        socket.emit('invite_to_game', { recipientId: friendId, gameType });
        setChallengedFriends(prev => [...prev, friendId]);
        toast.info('Challenge sent!');
    };

    const UserItem = ({ user, children }) => (
        <li className={styles.userItem}>
            <div className={styles.userInfo}>
                <span className={`${styles.statusIndicator} ${user.isOnline ? styles.online : styles.offline}`}></span>
                <Link to={`/user/${user._id}`} className={styles.userLink}>
                    {user.username}
                </Link>
            </div>
            <div className={styles.actionButtons}>{children}</div>
        </li>
    );

    return (
        <div className={styles.friendsContainer}>
            <h1 className={styles.header}>Friends & Connections</h1>

            {/* Search for Users */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Find New Friends</h2>
                <form onSubmit={handleSearch} className={styles.searchForm}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by username..."
                        className={styles.searchInput}
                    />
                    <button type="submit" className={`${styles.button} ${styles.primary}`}>Search</button>
                </form>
                <ul className={styles.userList}>
                    {searchResults.map(user => (
                        <UserItem key={user._id} user={user}>
                            <button onClick={() => handleSendRequest(user._id)} className={`${styles.button} ${styles.primary}`}>
                                Add Friend
                            </button>
                        </UserItem>
                    ))}
                </ul>
            </div>

            {/* Incoming Friend Requests */}
            {requests.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Incoming Requests</h2>
                    <ul className={styles.userList}>
                        {requests.map(req => (
                            <UserItem key={req._id} user={req}>
                                <button onClick={() => handleRequestResponse(req._id, 'accept')} className={`${styles.button} ${styles.accept}`}>
                                    Accept
                                </button>
                                <button onClick={() => handleRequestResponse(req._id, 'decline')} className={`${styles.button} ${styles.decline}`}>
                                    Decline
                                </button>
                            </UserItem>
                        ))}
                    </ul>
                </div>
            )}

            {/* Friends List */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Your Friends</h2>
                {friends.length > 0 ? (
                    <ul className={styles.userList}>
                        {friends.map(friend => (
                            <UserItem key={friend._id} user={friend}>
                                {friend.isOnline && !challengedFriends.includes(friend._id) && (
                                    <button onClick={() => handleChallenge(friend._id)} className={`${styles.button} ${styles.primary}`}>
                                        Challenge
                                    </button>
                                )}
                                {challengedFriends.includes(friend._id) && (
                                    <button className={`${styles.button} ${styles.primary}`} disabled>
                                        Challenge Sent
                                    </button>
                                )}
                            </UserItem>
                        ))}
                    </ul>
                ) : (
                    <p>You haven't added any friends yet. Use the search above to find people!</p>
                )}
            </div>
        </div>
    );
};

export default FriendsPage;