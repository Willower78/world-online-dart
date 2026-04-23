import React from 'react';
import styles from '../pages/Profile.module.css';

const ProfileForm = ({ formData, onFormChange }) => {
    return (
        <div className={styles.editForm}>
            <label className={styles.label}>Location:</label>
            <input 
                className={styles.input} 
                type="text" 
                name="location" 
                value={formData.location} 
                onChange={onFormChange} 
                placeholder="City, Country" 
            />
            <label className={styles.label}>Birthdate:</label>
            <input 
                className={styles.input} 
                type="date" 
                name="birthdate" 
                value={formData.birthdate} 
                onChange={onFormChange} 
            />
        </div>
    );
};

export default ProfileForm;
