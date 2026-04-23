import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaUser } from 'react-icons/fa6';
import styles from './Inbox.module.css';
import { useAuth } from '../context/AuthContext';

const Inbox = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const res = await axios.get('/api/chat/conversations', {
                    headers: { 'x-auth-token': token }
                });
                setConversations(res.data);
            } catch (err) {
                console.error('Error fetching inbox:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, []);

    const getOtherParticipant = (participants) => {
        if (!user) return participants[0];
        return participants.find(p => p._id !== user._id) || participants[0];
    };
    
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return <div className={styles.container}>Loading messages...</div>;

    return (
        <div className={styles.container}>
            <h2 className={styles.header}>Inbox</h2>
            <div className={styles.list}>
                {conversations.length === 0 ? (
                    <div className={styles.empty}>No messages yet.</div>
                ) : (
                    conversations.map(conv => {
                         const otherUser = getOtherParticipant(conv.participants);
                         
                         return (
                            <div 
                                key={conv._id} 
                                className={styles.item}
                                onClick={() => navigate(`/chat/${otherUser._id}`)} 
                            >
                                <div className={styles.avatar}>
                                    {otherUser.profilePicture && !otherUser.profilePicture.includes('default') ? (
                                        <img src={otherUser.profilePicture} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
                                    ) : (
                                        <FaUser />
                                    )}
                                </div>
                                <div className={styles.content}>
                                    <div className={styles.topRow}>
                                        <span className={styles.names}>
                                             {otherUser.username}
                                        </span>
                                        <span className={styles.date}>{formatDate(conv.lastMessageDate)}</span>
                                    </div>
                                    <div className={styles.messagePreview}>
                                        {conv.lastMessage}
                                    </div>
                                </div>
                            </div>
                         );
                    })
                )}
            </div>
        </div>
    );
};

export default Inbox;
