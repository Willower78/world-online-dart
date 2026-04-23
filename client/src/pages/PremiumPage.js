import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PremiumPage = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleUpgradeClick = async () => {
        setLoading(true);
        setError('');
        try {
            // Anropa vår backend för att skapa en Stripe Checkout-session
            const res = await axios.post('/api/payments/create-checkout-session');
            // Omdirigera användaren till Stripes betalningssida
            window.location.href = res.data.url;
        } catch (err) {
            console.error('Failed to create checkout session', err);
            setError('Could not connect to the payment service. Please try again later.');
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Go Premium!</h1>
            <div style={styles.card}>
                <h2>Premium Membership</h2>
                <p>Unlock exclusive features:</p>
                <ul style={styles.list}>
                    <li>Advanced statistics</li>
                    <li>Access to tournaments</li>
                    <li>Premium user badge</li>
                    <li>And much more!</li>
                </ul>
                <button onClick={handleUpgradeClick} disabled={loading} style={styles.button}>
                    {loading ? 'Redirecting...' : 'Upgrade for 50 SEK/month'}
                </button>
                {error && <p style={styles.errorText}>{error}</p>}
            </div>
            <Link to="/profile" style={styles.backLink}>← Back to Profile</Link>
        </div>
    );
};

const styles = {
    container: { backgroundColor: '#1a1a1a', color: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', fontFamily: 'Arial, sans-serif' },
    title: { color: '#e74c3c', marginBottom: '30px' },
    card: {
        background: '#333',
        padding: '30px',
        borderRadius: '8px',
        margin: '10px 0',
        width: '90%',
        maxWidth: '500px',
        textAlign: 'center'
    },
    list: {
        listStyle: 'none',
        padding: 0,
        textAlign: 'left',
        display: 'inline-block',
        marginBottom: '30px'
    },
    button: { padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    errorText: { color: '#e74c3c', marginTop: '15px' },
    backLink: { color: '#ccc', textDecoration: 'none', marginTop: '20px' }
};

export default PremiumPage;