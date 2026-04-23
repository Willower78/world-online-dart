import React, { useState, useEffect } from 'react';
import socket from '../socket/socket';
import { toast } from 'react-toastify';
import styles from './Dido301GamePage.module.css';

import { useLocalMedia } from '../hooks/useLocalMedia';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoPlayer from '../components/VideoPlayer';
import { useAuth } from '../context/AuthContext';

const Dido301GamePage = ({ game: initialGame }) => {
    const [game, setGame] = useState(initialGame);
    const { user } = useAuth();

    const { localStream } = useLocalMedia();
    const { remoteStreams } = useWebRTC(game?.gameId, localStream);
    const me = game?.players.find(p => p.id === user?._id);
    const opponent = game?.players.find(p => p.id !== user?._id);
    const isMyTurn = game?.gameState.currentPlayerId === user?._id;
    const opponentStream = opponent ? remoteStreams[opponent.userId] : null;

    useEffect(() => {
        const handleGameStateUpdate = (updatedGame) => {
            setGame(updatedGame);
        };
        
        socket.on('game_state_update', handleGameStateUpdate);

        return () => {
            socket.off('game_state_update', handleGameStateUpdate);
        };
    }, [initialGame, user?._id]);

    const handleThrow = (score, segment) => {
        if (!isMyTurn) {
            toast.warn("Det är inte din tur!");
            return;
        }
        console.log(`Manually submitting throw for 301 DIDO: ${segment} for ${score}`);
        toast.info("Manuell inmatning stöds inte för 301 DIDO (AI-driven).");
    };

    if (!game || !game.gameState || !me || !opponent) {
        return <div>Laddar 301 DIDO-spel...</div>;
    }

    const { gameState } = game;

    return (
        <div className={styles.gameContainer}>
            <div className={styles.myCameraArea}>
                {localStream ? <VideoPlayer stream={localStream} muted={true} /> : <div className={styles.noVideo}>Din Kamera</div>}
            </div>

            <div className={styles.opponentCameraArea}>
                {opponentStream ? <VideoPlayer stream={opponentStream} muted={false} /> : <div className={styles.noVideo}>Väntar på motståndare...</div>}
            </div>
            
            <div className={styles.centerColumn}>
                <div className={styles.scoreboard}>
                    <div className={`${styles.playerPanel} ${isMyTurn ? styles.activePlayer : ''}`}>
                        <h2>{me.username}</h2>
                        <p className={styles.playerScore}>{gameState.scores[me.id]}</p>
                        <p className={styles.playerStatus}>
                            {gameState.isIn[me.id] ? 'Inne i spelet' : 'Behöver dubbel in'}
                        </p>
                    </div>
                    <div className={`${styles.playerPanel} ${!isMyTurn ? styles.activePlayer : ''}`}>
                        <h2>{opponent.username}</h2>
                        <p className={styles.playerScore}>{gameState.scores[opponent.id]}</p>
                        <p className={styles.playerStatus}>
                            {gameState.isIn[opponent.id] ? 'Inne i spelet' : 'Behöver dubbel in'}
                        </p>
                    </div>
                </div>

                {gameState.winner ? (
                    <div className={styles.winnerBanner}>
                        <h2>VINNARE: {game.players.find(p => p.id === gameState.winner)?.username}</h2>
                    </div>
                ) : (
                    <div className={styles.inputSection}>
                        <h4>{isMyTurn ? "Din tur" : `Väntar på ${opponent.username}...`}</h4>
                        <p>AI-poängräkning aktiv. Sikta för att komma in/ut med dubbel.</p>
                    </div>
                )}
            </div>
             <div className={styles.statusBar}>
                {game.gameState.lastMessage}
            </div>
        </div>
    );
};

export default Dido301GamePage;