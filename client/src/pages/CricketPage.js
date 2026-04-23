import React, { useState, useEffect } from 'react';
import socket from '../socket/socket';
import { toast } from 'react-toastify';
import styles from './CricketPage.module.css';

import { useLocalMedia } from '../hooks/useLocalMedia';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoPlayer from '../components/VideoPlayer';
import { useAuth } from '../context/AuthContext';

const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25];

const CricketPage = ({ game: initialGame }) => {
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

    const handleThrow = (number, multiplier) => {
        if (!isMyTurn) {
            toast.warn("It's not your turn!");
            return;
        }
        socket.emit('submit_cricket_throw', {
            gameId: game.gameId,
            target: number,
            multiplier: multiplier
        });
    };

    if (!game || !game.gameState || !me || !opponent) {
        return <div>Laddar Cricket-spel...</div>;
    }

    const renderMark = (count) => {
        if (count === 1) return '/';
        if (count === 2) return 'X';
        if (count >= 3) return '◎';
        return '';
    };

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
                    <div className={`${styles.playerHeader} ${isMyTurn ? styles.activePlayer : ''}`}>
                        <h2>{me.username}</h2>
                        <p className={styles.playerScore}>{game.gameState.scores[me.id]}</p>
                    </div>
                    <div className={styles.marksColumn}>
                        {CRICKET_NUMBERS.map(num => (
                            <div key={`me-${num}`} className={styles.markCell}>
                                {renderMark(game.gameState.hits[me.id][num])}
                            </div>
                        ))}
                    </div>
                    <div className={styles.numberColumn}>
                        {CRICKET_NUMBERS.map(num => (
                            <div key={num} className={styles.numberCell}>{num === 25 ? 'Bull' : num}</div>
                        ))}
                    </div>
                    <div className={styles.marksColumn}>
                        {CRICKET_NUMBERS.map(num => (
                            <div key={`opp-${num}`} className={styles.markCell}>
                                {renderMark(game.gameState.hits[opponent.id][num])}
                            </div>
                        ))}
                    </div>
                    <div className={`${styles.playerHeader} ${!isMyTurn ? styles.activePlayer : ''}`}>
                        <h2>{opponent.username}</h2>
                        <p className={styles.playerScore}>{game.gameState.scores[opponent.id]}</p>
                    </div>
                </div>

                {game.gameState.winner ? (
                    <div className={styles.winnerBanner}>
                        <h2>VINNARE: {game.players.find(p => p.id === game.gameState.winner)?.username}</h2>
                    </div>
                ) : (
                    <div className={styles.inputSection}>
                        <h4>{isMyTurn ? "Din tur" : `Väntar på ${opponent.username}...`}</h4>
                        <div className={styles.buttonGrid}>
                             {CRICKET_NUMBERS.map(num => (
                                <div key={`btn-group-${num}`} className={styles.throwGroup}>
                                    <span>{num === 25 ? "Bull" : num}</span>
                                    <button disabled={!isMyTurn} onClick={() => handleThrow(num, 1)}>Singel</button>
                                    <button disabled={!isMyTurn} onClick={() => handleThrow(num, 2)}>Dubbel</button>
                                    {num !== 25 && <button disabled={!isMyTurn} onClick={() => handleThrow(num, 3)}>Trippel</button>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
             <div className={styles.statusBar}>
                {game.gameState.lastMessage}
            </div>
        </div>
    );
};

export default CricketPage;