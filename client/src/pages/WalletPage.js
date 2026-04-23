import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import MainLayout from '../components/MainLayout';
import Spinner from '../components/Spinner'; // Assuming a spinner component exists
import styles from './WalletPage.module.css';

const PurchaseSection = ({ onTransaction, loading }) => {
  const handlePurchase = async (gold, silver, euros) => {
    if (window.confirm(`Are you sure you want to purchase stars for €${euros}?`)) {
      await onTransaction('purchase', { goldAmount: gold, silverAmount: silver });
    }
  };

  return (
    <div className={styles.walletSection}>
      <h3>Purchase Stars</h3>
      <p>Stock up on stars to enter exclusive tournaments and leagues.</p>
      <div className={styles.purchaseOptions}>
        <div className={styles.option}>
          <span>10 Gold Stars</span>
          <button onClick={() => handlePurchase(10, 0, 10)} disabled={loading} className={styles.actionButton}>€10.00</button>
        </div>
        <div className={styles.option}>
          <span>50 Gold Stars</span>
          <button onClick={() => handlePurchase(50, 0, 50)} disabled={loading} className={styles.actionButton}>€50.00</button>
        </div>
        <div className={styles.option}>
          <span>100 Silver Stars</span>
          <button onClick={() => handlePurchase(0, 100, 50)} disabled={loading} className={styles.actionButton}>€50.00</button>
        </div>
      </div>
    </div>
  );
};

const CashOutSection = ({ onTransaction, loading, goldStars }) => {
  const [amount, setAmount] = useState(10);

  const handleCashOut = async () => {
    if (amount > goldStars) {
        return toast.error("You don't have enough Gold Stars to cash out this amount.");
    }
    if (window.confirm(`Are you sure you want to redeem ${amount} Gold Stars for a €${amount} gift card?`)) {
      await onTransaction('cash-out', { euroAmount: amount });
    }
  };

  return (
    <div className={styles.walletSection}>
      <h3>Cash Out Gold Stars</h3>
      <p>Redeem your Gold Stars for real-world value with Tremendous gift cards.</p>
      <div className={styles.cashOutForm}>
        <label>Amount (min €5, max €100):</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value, 10))}
          min="5"
          max="100"
          className={styles.inputField}
          disabled={loading}
        />
        <button onClick={handleCashOut} disabled={loading} className={`${styles.actionButton} ${styles.primary}`}>
          Redeem for €{amount} Gift Card
        </button>
      </div>
    </div>
  );
};

const WalletPage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users/me');
      setUser(res.data);
    } catch (err) {
      setError('Failed to fetch user data. Please try again later.');
      toast.error('Failed to fetch user data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleApiTransaction = async (type, payload) => {
    setLoading(true);
    try {
      const res = await axios.post(`/api/economy/${type}`, payload);
      toast.success(res.data.msg || 'Transaction successful!');
      // Refetch user data to update the balance
      await fetchUserData();
    } catch (err) {
      const errorMsg = err.response?.data?.msg || `An error occurred during the ${type} process.`;
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) {
    return <MainLayout><Spinner /></MainLayout>;
  }

  if (error) {
    return <MainLayout><div className={styles.walletContainer}><p style={{ color: 'red' }}>{error}</p></div></MainLayout>;
  }

  if (!user) {
    return <MainLayout><div className={styles.walletContainer}><p>No user data found.</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className={styles.walletContainer}>
        <h1 className={styles.title}>My WOD Wallet</h1>
        
        <div className={styles.balanceDisplay}>
          <div className={styles.balanceItem}>
            <h2>{user.goldStars}</h2>
            <span>Gold Stars</span>
          </div>
          <div className={styles.balanceItem}>
            <h2>{user.silverStars}</h2>
            <span>Silver Stars</span>
          </div>
        </div>

        <PurchaseSection onTransaction={handleApiTransaction} loading={loading} />
        <CashOutSection onTransaction={handleApiTransaction} loading={loading} goldStars={user.goldStars} />
        
        <div className={styles.walletSection}>
          <h3>Transaction History</h3>
          <p>Your recent transactions will appear here.</p>
          {/* Transaction history would be implemented here once the backend supports it */}
          <ul className={styles.transactionList}>
            <li>
              <span>Feature coming soon...</span>
            </li>
          </ul>
        </div>
      </div>
    </MainLayout>
  );
};

export default WalletPage;
