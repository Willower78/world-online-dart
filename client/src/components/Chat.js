import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import socket from '../socket/socket';
import styles from './Chat.module.css';

const Chat = ({ roomName, currentUser }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    // Funktion för att auto-scrolla till botten
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (!roomName) return;

        const handleReceiveMessage = (messageData) => {
            setMessages(prevMessages => [...prevMessages, messageData]);
        };

        socket.on('receive-chat-message', handleReceiveMessage);

        return () => {
            socket.off('receive-chat-message', handleReceiveMessage);
        };
    }, [roomName]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;

        const messageData = {
            userId: currentUser._id,
            message: newMessage,
            username: currentUser.username,
            timestamp: new Date()
        };

        // Lägg till meddelandet lokalt direkt för en snabbare upplevelse
        setMessages(prevMessages => [...prevMessages, messageData]);

        // Skicka meddelandet till servern
        socket.emit('send-chat-message', {
            roomName,
            message: newMessage,
            username: currentUser.username
        });

        setNewMessage('');
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.messagesList}>
                {messages.map((msg, index) => (
                    <div key={index} className={styles.messageItem}>
                        <Link to={`/user/${msg.userId}`} className={styles.userLink}>
                            <strong style={{ color: msg.username === currentUser.username ? '#2ecc71' : '#3498db' }}>
                                {msg.username}:
                            </strong>
                        </Link>
                        {' '}{msg.message}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className={styles.chatForm}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className={styles.chatInput}
                />
                <button type="submit" className={styles.sendButton}>Send</button>
            </form>
        </div>
    );
};

export default Chat;