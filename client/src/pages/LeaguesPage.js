import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Spinner from '../components/Spinner';
import styles from './LeaguesPage.module.css';

const LeagueCard = ({ league }) => {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.leagueName}>{league.name}</h3>
        <span className={`${styles.status} ${styles[league.status.toLowerCase()]}`}>
          {league.status}
        </span>
      </div>
      <div className={styles.cardBody}>
        <p><strong>Region:</strong> {league.region}</p>
        <p><strong>Entry Fee:</strong> €{league.entryFeeEuros}</p>
        <p><strong>Game Fee:</strong> {league.perGameFeeSilverStars} Silver Stars per game</p>
      </div>
      <div className={styles.cardFooter}>
        <Link to={`/leagues/${league._id}`} className={styles.detailsButton}>
          View Details
        </Link>
      </div>
    </div>
  );
};

const LeaguesPage = () => {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/leagues');
        setLeagues(res.data);
      } catch (err) {
        setError('Failed to load leagues. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, []);

  return (
      <div className={styles.leaguesContainer}>
        <h1 className={styles.title}>Join a League</h1>
        <p className={styles.subtitle}>Compete in structured seasons against players of all skill levels.</p>
        
        {loading && <Spinner />}
        {error && <p className={styles.error}>{error}</p>}
        
        {!loading && !error && (
          <div className={styles.leaguesGrid}>
            {leagues.length > 0 ? (
              leagues.map(league => <LeagueCard key={league._id} league={league} />)
            ) : (
              <p>No active leagues found. Check back soon!</p>
            )}
          </div>
        )}
      </div>
  );
};

export default LeaguesPage;
