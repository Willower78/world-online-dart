import React from 'react';

const GameInviteNotification = ({ invite, onAccept, onDecline }) => {
    if (!invite) return null;

    return (
        <div style={styles.container}>
            <p>
                <strong>{invite.from.username}</strong> has invited you to a game of <strong>{invite.gameType}</strong>!
            </p>
            <div style={styles.buttonGroup}>
                <button onClick={onAccept} style={styles.acceptButton}>Accept</button>
                <button onClick={onDecline} style={styles.declineButton}>Decline</button>
            </div>
        </div>
    );
};

const styles = {
    container: {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '15px 25px',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        zIndex: 1000,
        textAlign: 'center',
        border: '2px solid #3498db'
    },
    buttonGroup: {
        marginTop: '10px',
        display: 'flex',
        gap: '15px',
        justifyContent: 'center'
    },
    acceptButton: {
        padding: '8px 15px',
        fontSize: '1rem',
        backgroundColor: '#2ecc71',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    },
    declineButton: {
        padding: '8px 15px',
        fontSize: '1rem',
        backgroundColor: '#c0392b',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    }
};

export default GameInviteNotification;
