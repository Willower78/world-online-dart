import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket/socket';
import styles from './GamePage.module.css'; // Re-using GamePage styles for now
import VideoPlayer from '../components/VideoPlayer';
import { useWebRTC } from '../hooks/useWebRTC';

const SpectatePage = () => {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const [game, setGame] = useState(null);

    // For spectating, we don't send a local stream.
    const { remoteStreams } = useWebRTC(gameId, null);

    useEffect(() => {
        // We need to tell the server we want to spectate this game
        socket.emit('spectate_game', { gameId });

        const handleGameStateUpdate = (updatedGameState) => {
            setGame(prevGame => ({ ...prevGame, gameState: updatedGameState }));
        };
        
        const handleInitialState = (initialGame) => {
            setGame(initialGame);
        };

        const handleGameNotFound = () => {
            alert('Game not found or has ended.');
            navigate('/lobby');
        };

        const handleUnauthorized = (data) => {
            alert(data.message);
            navigate('/premium');
        };

        socket.on('game_state_update', handleGameStateUpdate);
        socket.on('initial_spectate_state', handleInitialState);
        socket.on('game_not_found', handleGameNotFound);
        socket.on('unauthorized', handleUnauthorized);

        return () => {
            socket.off('game_state_update', handleGameStateUpdate);
            socket.off('initial_spectate_state', handleInitialState);
            socket.off('game_not_found', handleGameNotFound);
            socket.off('unauthorized', handleUnauthorized);
            socket.emit('leave_spectate', { gameId });
        };
    }, [gameId, navigate]);

    if (!game || !game.gameState) {
        return <div>Loading game to spectate...</div>;
    }

    const player1 = game.players[0];
    const player2 = game.players[1];
    const isPlayer1Turn = game.gameState.currentPlayerId === player1.id;
    
    const player1Stream = remoteStreams[player1.userId];
    const player2Stream = remoteStreams[player2.userId];

    return (
        <div className={styles.gameContainer}>
            {/* We will show player 1 in the small window and player 2 in the large one */}
            <div className={styles.myCameraArea}>
                {player1Stream ? <VideoPlayer stream={player1Stream} muted={true} /> : <div className={styles.noVideo}>{player1.username}</div>}
            </div>

            <div className={styles.opponentCameraArea}>
                {player2Stream ? <VideoPlayer stream={player2Stream} muted={false} /> : <div className={styles.noVideo}>{player2.username}</div>}
            </div>

            <div className={styles.scoreboard}>
                <div className={`${styles.playerScore} ${isPlayer1Turn ? styles.activeTurn : ''}`}>
                    <span className={styles.playerName}>{player1.username}</span>
                    <span className={styles.score}>{game.gameState.scores[player1.id]}</span>
                </div>
                <div className={styles.divider}></div>
                <div className={`${styles.playerScore} ${!isPlayer1Turn ? styles.activeTurn : ''}`}>
                    <span className={styles.playerName}>{player2.username}</span>
                    <span className={styles.score}>{game.gameState.scores[player2.id]}</span>
                </div>
            </div>

            {/* No input section for spectators */}
            <div className={styles.inputSection} style={{ visibility: 'hidden' }}></div>
            <div className={styles.actionSection} style={{ visibility: 'hidden' }}></div>
            
            <div className={styles.statusBar}>
                {game.gameState.winner
                    ? `${game.players.find(p => p.id === game.gameState.winner).username} VANN!`
                    : game.gameState.lastMessage || `Det är ${game.players.find(p => p.id === game.gameState.currentPlayerId).username}s tur`
                }
            </div>
        </div>
    );
};

export default SpectatePage;
