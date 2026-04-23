import React from 'react';
import styles from '../pages/Profile.module.css';

const ProfileHeader = ({ user, isEditing, onFileChange }) => {
    return (
        <div className={styles.profileHeader}>
            <img 
                src={`${user.profilePicture}?${new Date().getTime()}`} 
                alt="Profile" 
                className={styles.avatar} 
            />
            {isEditing && (
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={onFileChange} 
                    className={styles.fileInput} 
                />
            )}
        </div>
    );
};

export default ProfileHeader;
