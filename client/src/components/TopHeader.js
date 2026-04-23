import React from 'react';
import { FaBars, FaVideo, FaExpand } from 'react-icons/fa';
import styles from './TopHeader.module.css';

const TopHeader = ({ title, onMenuClick }) => {
    return (
        <header className={styles.topHeader}>
            <button className={styles.menuButton} onClick={onMenuClick}>
                <FaBars />
            </button>
            <div className={styles.headerTitle}>{title}</div>
            <div className={styles.headerActions}>
                {/* TODO: Implement functionality for these buttons */}
                <button className={styles.iconBtn}><FaVideo /></button>
                <button className={styles.iconBtn}><FaExpand /></button>
            </div>
        </header>
    );
};

export default TopHeader;
