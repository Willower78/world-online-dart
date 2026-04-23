import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import useFrameSubmission from '../hooks/useFrameSubmission';
import { useLocalMedia } from '../hooks/useLocalMedia';

import '../pages/GamePage.css'; // This CSS file will be shared by game pages

const Game501Page = ({ game }) => {
    const { user } = useAuth();
    const [calibration, setCalibration] = React.useState(null); 
    React.useEffect(() => {
        const fetchCalibrationData = async () => {
            const dummyCalibration = { "some": "data" };
            setCalibration(dummyCalibration);
            console.log("Dummy calibration data set. Frame submission is now active on your turn.");
        };
        if(user?._id) {
            fetchCalibrationData();
        }
    }, [user?._id]);

    const { localStream, localVideoRef } = useLocalMedia();
    
    const isMyTurn = game?.gameState?.currentPlayerId === user?._id;

    useFrameSubmission(localVideoRef, calibration, isMyTurn);

    const { gameState, players } = game;
    const player1 = players.find(p => String(p.id) === String(game.players[0].id));
    const player2 = players.find(p => String(p.id) === String(game.players[1].id));

    return (
        <div className="game-container">
            <header className="game-header">
                <h1>501</h1>
                <p className={`turn-indicator ${isMyTurn ? 'my-turn' : ''}`}>
                    {gameState.lastMessage}
                </p>
                {gameState.winner && <h2 className="winner-announcement">Vinnare: {players.find(p => p.id === gameState.winner).username}!</h2>}
            </header>

            <main className="game-main">
                <div className="player-panel">
                    <h2>{player1?.username || 'Spelare 1'}</h2>
                    <p className="score" key={gameState.scores[player1?.id]}>{gameState.scores[player1?.id]}</p>
                </div>

                <div className="video-feed-container">
                    <h3>Din Kamera</h3>
                    <video ref={localVideoRef} autoPlay playsInline muted />
                    <p className="turn-indicator-light" style={{color: isMyTurn ? 'lightgreen' : 'gray'}}>
                        {isMyTurn ? "AI-poängräkning aktiv" : "Väntar på motståndare..."}
                    </p>
                </div>

                <div className="player-panel">
                    <h2>{player2?.username || 'Spelare 2'}</h2>
                    <p className="score" key={gameState.scores[player2?.id]}>{gameState.scores[player2?.id]}</p>
                </div>
            </main>
        </div>
    );
};

export default Game501Page;