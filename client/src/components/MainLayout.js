import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import styles from './MainLayout.module.css';
import socket from '../socket/socket';
import GameInviteNotification from './GameInviteNotification';

const MainLayout = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [invite, setInvite] = useState(null);
    const navigate = useNavigate();

    const toggleSidebar = () => {
        setSidebarOpen(!isSidebarOpen);
    };

    useEffect(() => {
        const handleReceiveInvite = (data) => {
            setInvite(data);
        };

        const handleInviteCancelled = () => {
            setInvite(null);
        };

        const handleGameStart = (game) => {
             console.log('Game started (Global Listener), navigating to:', game.gameId);
             navigate(`/game/${game.gameId}`);
             setInvite(null); // Clear invite if it exists
        };

        socket.on('receive_game_invite', handleReceiveInvite);
        socket.on('invite_cancelled', handleInviteCancelled);
        socket.on('game_start', handleGameStart); 

        return () => {
            socket.off('receive_game_invite', handleReceiveInvite);
            socket.off('invite_cancelled', handleInviteCancelled);
            socket.off('game_start', handleGameStart);
        };
    }, [navigate]);

    const handleAccept = () => {
        if (invite) {
            socket.emit('accept_game_invite', { inviteId: invite.inviteId });
            // Don't clear invite immediately, wait for game_start to ensure connection? 
            // Or clear it now. Let's clear it now.
            setInvite(null);
        }
    };

    const handleDecline = () => {
        if (invite) {
            socket.emit('decline_game_invite', { inviteId: invite.inviteId });
            setInvite(null);
        }
    };

    return (
        <div className={styles.appContainer}>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className={styles.mainContent}>
                <GameInviteNotification 
                    invite={invite} 
                    onAccept={handleAccept} 
                    onDecline={handleDecline} 
                />
                {/* We pass the toggle function to children via Outlet's context prop */}
                <Outlet context={{ onMenuClick: toggleSidebar }} />
            </main>
            {isSidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}
        </div>
    );
};

export default MainLayout;

