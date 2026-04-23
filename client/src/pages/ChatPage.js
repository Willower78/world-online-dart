import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import socket from '../socket/socket';
import styles from './ChatPage.module.css';

const ChatPage = () => {
    const { friendId } = useParams();
    const location = useLocation();
    const friendName = location.state?.friendName;
    const currentUser = JSON.parse(localStorage.getItem('user'));

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const chatEndRef = useRef(null);

    useEffect(() => {
        const myId = currentUser?._id;
        if (!myId) return;

        const fetchHistory = async () => {
            try {
                const res = await axios.get(`/api/chat/${friendId}`);
                const formattedMessages = res.data.map(msg => ({
                    _id: msg._id,
                    senderId: msg.sender,
                    content: msg.content,
                    timestamp: msg.createdAt
                }));
                setMessages(formattedMessages);
            } catch (err) {
                console.error("Could not fetch chat history", err);
            }
        };
        fetchHistory();

        const handleReceiveMessage = (messageData) => {
            const isFromMeToFriend = messageData.senderId === myId && messageData.recipientId === friendId;
            const isFromFriendToMe = messageData.senderId === friendId && messageData.recipientId === myId;

            if (isFromMeToFriend || isFromFriendToMe) {
                setMessages(prevMessages => [...prevMessages, messageData]);
            }
        };

        socket.on('receive_private_message', handleReceiveMessage);

        return () => {
            socket.off('receive_private_message', handleReceiveMessage);
        };
    }, [friendId, currentUser?._id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        socket.emit('send_private_message', {
            recipientId: friendId,
            content: newMessage
        });

        setNewMessage('');
    };

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>
                Chat with <Link to={`/user/${friendId}`} className={styles.profileLink}>{friendName || 'Friend'}</Link>
            </h1>
            <Link to="/friends" className={styles.backLink}>← Back to Friends</Link>

            <div className={styles.chatWindow}>
                {messages.map((msg) => (
                    <div key={msg._id} className={msg.senderId === currentUser._id ? styles.myMessage : styles.friendMessage}>
                        <p className={styles.messageContent}>{msg.content}</p>
                        <span className={styles.timestamp}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className={styles.form}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className={styles.input}
                />
                <button type="submit" className={styles.button}>Send</button>
            </form>
        </div>
    );
};

export default ChatPage;
