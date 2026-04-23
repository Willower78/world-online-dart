import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Promotions.module.css';

const Promotions = () => {
    return (
        <div className={styles.container}>
            <div className={`${styles.promoCard} ${styles.premium}`}>
                <h3>Upgrade to Premium</h3>
                <p>Get unlimited stats, ad-free experience, and exclusive tournament access.</p>
                <Link to="/premium" className={styles.button}>Go Premium</Link>
            </div>

            <div className={`${styles.promoCard} ${styles.tournament}`}>
                <h3>Weekly 501 Cup</h3>
                <p>Join this Saturday! Prize pool: 5000 Gold Stars.</p>
                <Link to="/tournaments" className={styles.buttonOutline}>Join Now</Link>
            </div>

            <div className={`${styles.promoCard} ${styles.league}`}>
                <h3>Winter League</h3>
                <p>Registration closes soon. Find a division near you.</p>
                <Link to="/leagues" className={styles.buttonOutline}>Find League</Link>
            </div>
        </div>
    );
};

export default Promotions;
