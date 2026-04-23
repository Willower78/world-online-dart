import React from 'react';
import styles from '../pages/Profile.module.css';

const ProfileDetails = ({ user }) => {
    const getAge = (birthdate) => {
        if (!birthdate) return null;
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    return (
        <div>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Location:</strong> {user.location || 'Not specified'}</p>
            <p><strong>Age:</strong> {getAge(user.birthdate) || 'Not specified'}</p>
            <p><strong>Member since:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
            <p>
                <strong>Status:</strong>
                <span className={user.subscriptionStatus === 'active' ? styles.premiumText : ''}>
                    {user.subscriptionStatus === 'active' ? 'Premium' : 'Standard'}
                </span>
            </p>
        </div>
    );
};

export default ProfileDetails;
