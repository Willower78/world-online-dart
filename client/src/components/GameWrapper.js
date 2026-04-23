import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket/socket';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// Import game-specific components
import Game501Page from '../pages/501GamePage';
import CricketPage from '../pages/CricketPage';
import Bobs27GamePage from '../pages/Bobs27GamePage';
import Dido301GamePage from '../pages/Dido301GamePage';

const GameWrapper = () => {
    const { gameId } = useParams();
    const { user } = useAuth();
    const [game, setGame] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) {
            toast.error("You must be logged in to play a game.");
            return;
        }

        const handleGameStateUpdate = (updatedGame) => {
            setGame(updatedGame);
            setError('');
        };

        const handleGameError = (errorMessage) => {
            setError(errorMessage.message || 'An unknown error occurred.');
            toast.error(errorMessage.message || 'An unknown error occurred.');
        };
        
        socket.on('game_state_update', handleGameStateUpdate);
        socket.on('game_start', handleGameStateUpdate);
        socket.on('game_error', handleGameError);
        
        console.log(`Attempting to join game: ${gameId}`);
        socket.emit('join_game', { gameId, userId: user?._id });

        return () => {
            console.log(`Leaving game: ${gameId}`);
            socket.emit('leave_game', { gameId, userId: user?._id });
            socket.off('game_state_update', handleGameStateUpdate);
            socket.off('game_start', handleGameStateUpdate);
            socket.off('game_error', handleGameError);
        };
    }, [gameId, user]);

    if (error) {
        return <div className="game-container error-message"><h2>Error</h2><p>{error}</p></div>;
    }

    if (!game) {
        return <div className="game-container"><h2>Laddar spel...</h2></div>;
    }

    switch (game.gameType) {
        case '501':
            return <Game501Page game={game} />;
        case 'cricket':
            return <CricketPage game={game} />;
        case 'bobs_27':
            return <Bobs27GamePage game={game} />;
        case '301_dido':
            return <Dido301GamePage game={game} />;
        default:
            return <div className="game-container error-message"><h2>Okänd speltyp</h2><p>Speltyp {game.gameType} stöds inte.</p></div>;
    }
};

export default GameWrapper;
