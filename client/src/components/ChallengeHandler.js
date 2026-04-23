import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import socket from '../socket/socket';

const ChallengeToast = ({ from, closeToast }) => {
    const handleAccept = () => {
        socket.emit('accept_challenge', { challengerId: from.id });
        closeToast();
    };

    const handleDecline = () => {
        socket.emit('decline_challenge', { challengerId: from.id });
        closeToast();
    };

    return (
        <div>
            <p><strong>{from.username}</strong> has challenged you to a game!</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '10px' }}>
                <button onClick={handleAccept} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px' }}>
                    Accept
                </button>
                <button onClick={handleDecline} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px' }}>
                    Decline
                </button>
            </div>
        </div>
    );
};

const ChallengeHandler = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleIncomingChallenge = ({ from }) => {
            toast(<ChallengeToast from={from} />, {
                autoClose: false, // Keep the toast open until the user responds
                closeOnClick: false,
                draggable: false,
            });
        };

        const handleChallengeDeclined = ({ from }) => {
            toast.warn(`${from.username} declined your challenge.`);
        };

        const handleStartGame = ({ game }) => {
            toast.dismiss(); // Close any open challenge toasts
            navigate('/game/501', { state: { game } });
        };

        socket.on('incoming_challenge', handleIncomingChallenge);
        socket.on('challenge_declined', handleChallengeDeclined);
        socket.on('start_game', handleStartGame);

        return () => {
            socket.off('incoming_challenge', handleIncomingChallenge);
            socket.off('challenge_declined', handleChallengeDeclined);
            socket.off('start_game', handleStartGame);
        };
    }, [navigate]);

    return null; // This component does not render anything
};

export default ChallengeHandler;