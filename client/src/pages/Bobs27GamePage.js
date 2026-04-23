import React, { useState, useEffect } from 'react';
import socket from '../socket/socket';
import { toast } from 'react-toastify';
import styles from './Bobs27GamePage.module.css';

import { useLocalMedia } from '../hooks/useLocalMedia';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoPlayer from '../components/VideoPlayer';
import { useAuth } from '../context/AuthContext';

const Bobs27GamePage = ({ game: initialGame }) => {
    const [game, setGame] = useState(initialGame);
    const { user } = useAuth();

    const { localStream } = useLocalMedia();
    const { remoteStreams } = useWebRTC(game?.gameId, localStream);
    const me = game?.players.find(p => p.id === user?._id);
    const isMyTurn = game?.gameState.currentPlayerId === user?._id;

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
        console.log(`Manually submitting throw for Bobs 27: ${segment} for ${score}`);
        toast.info("Manuell inmatning stöds inte för Bob's 27 (AI-driven).");
    };


    if (!game || !game.gameState || !me) {
        return <div>Laddar Bob's 27-spel...</div>;
    }

    const { gameState } = game;

    return (
        <div className={styles.gameContainer}>
            <div className={styles.myCameraArea}>
                {localStream ? <VideoPlayer stream={localStream} muted={true} /> : <div className={styles.noVideo}>Din Kamera</div>}
            </div>

            <div className={styles.opponentCameraArea}>
                {Object.keys(remoteStreams).length > 0 ? <VideoPlayer stream={Object.values(remoteStreams)[0]} muted={false} /> : <div className={styles.noVideo}>Ingen motståndare</div>}
            </div>
            
            <div className={styles.centerColumn}>
                <div className={styles.scoreboard}>
                    <div className={`${styles.playerHeader} ${isMyTurn ? styles.activePlayer : ''}`}>
                        <h2>{me.username}</h2>
                        <p className={styles.playerScore}>Poäng: {gameState.score}</p>
                        <p className={styles.currentTarget}>Mål: D{gameState.currentTarget === 25 ? 'BULL' : gameState.currentTarget}</p>
                    </div>
                </div>

                {gameState.winner ? (
                    <div className={styles.winnerBanner}>
                        {gameState.winner === 'player_lost' ? (
                            <h2>SPEL SLUT: Du förlorade!</h2>
                        ) : (
                            <h2>Bob's 27 AVKLARAT!</h2>
                        )}
                        <p>{gameState.lastMessage}</p>
                    </div>
                ) : (
                    <div className={styles.inputSection}>
                        <h4>{isMyTurn ? "Din tur" : "Väntar..."}</h4>
                        <p>AI-poängräkning aktiv. Sikta på D{gameState.currentTarget === 25 ? 'BULL' : gameState.currentTarget}</p>
                    </div>
                )}
            </div>
             <div className={styles.statusBar}>
                {game.gameState.lastMessage}
            </div>
        </div>
    );
};

export default Bobs27GamePage;