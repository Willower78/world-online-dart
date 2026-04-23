import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../pages/Profile.module.css';

const ProfileNav = ({ user, onLogout }) => {
    return (
        <div className={styles.mainNav}>
            {user && user.subscriptionStatus !== 'active' && (
                <Link to="/premium" className={styles.premiumButton}>Go Premium</Link>
            )}
            {user && user.isAdmin && (
                <Link to="/admin" className={styles.adminButton}>Admin</Link>
            )}
            <Link to="/leaderboard" className={`${styles.friendsButton} ${styles.leaderboardButton}`}>Leaderboard</Link>
            <Link to="/tournaments" className={styles.tournamentsButton}>Tournaments</Link>
            <Link to="/lobby" className={styles.playButton}>Find Game</Link>
            <Link to="/feed" className={styles.feedButton}>Feed</Link>
            <Link to="/friends" className={styles.friendsButton}>Friends</Link>
            <button onClick={onLogout} className={styles.logoutButton}>
                Logout
            </button>
        </div>
    );
};

export default ProfileNav;
