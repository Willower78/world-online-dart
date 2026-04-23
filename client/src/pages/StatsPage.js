import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import TopHeader from '../components/TopHeader';
import Spinner from '../components/Spinner';
import styles from './StatsPage.module.css';
import { useAuth } from '../context/AuthContext'; // Import useAuth

const StatsPage = () => {
  const [stats, setStats] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { onMenuClick } = useOutletContext();
  const { user } = useAuth(); // Get user from AuthContext

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const statsRes = await axios.get('/api/stats/me');
        setStats(statsRes.data);

        const matchesRes = await axios.get(`/api/stats/matches/${user._id}`);
        setMatches(matchesRes.data.matches);

      } catch (err) {
        console.error("Failed to fetch stats data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const StatCard = ({ title, value, subtext }) => (
    <div className={styles.statCard}>
      <p className={styles.statValue}>{value}</p>
      <h4 className={styles.statTitle}>{title}</h4>
      {subtext && <p className={styles.statSubtext}>{subtext}</p>}
    </div>
  );

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spinner /></div>;
  }

  if (!stats) {
    return (
        <>
            <TopHeader title="STATISTICS" onMenuClick={onMenuClick} />
            <div className={styles.contentPadding}>
                <p>Could not load statistics. Please try again later.</p>
            </div>
        </>
    );
  }
  
  const getStat = (game, field, defaultValue = 0) => {
    return stats[game]?.[field] ?? defaultValue;
  }
  
  return (
    <>
      <TopHeader title="STATISTICS" onMenuClick={onMenuClick} />
      <div className={styles.contentPadding}>
        
        <h2>Overall</h2>
        <div className={styles.grid}>
          <StatCard title="Matches Played" value={stats.totalMatches || 0} />
          <StatCard title="Wins" value={stats.wins || 0} />
          <StatCard title="Losses" value={stats.losses || 0} />
          <StatCard title="Win Rate" value={`${((stats.wins / stats.totalMatches) * 100 || 0).toFixed(1)}%`} />
        </div>

        <h2>501 / 301</h2>
        <div className={styles.grid}>
          <StatCard title="Played" value={(getStat('game_501', 'wins') + getStat('game_501', 'losses'))} />
          <StatCard title="Wins" value={getStat('game_501', 'wins')} />
          <StatCard title="Losses" value={getStat('game_501', 'losses')} />
          <StatCard title="3-Dart Average" value={getStat('game_501', 'threeDartAverage')} subtext="Points per 3 darts" />
        </div>

        <h2>Cricket</h2>
        <div className={styles.grid}>
          <StatCard title="Played" value={(getStat('cricket', 'wins') + getStat('cricket', 'losses'))} />
          <StatCard title="Wins" value={getStat('cricket', 'wins')} />
          <StatCard title="Losses" value={getStat('cricket', 'losses')} />
          <StatCard title="Marks Per Round (MPR)" value={getStat('cricket', 'marksPerRound')} subtext="Marks per 3 darts" />
        </div>
        
        <h2>Recent Matches</h2>
         <div className={styles.card}>
            {matches.length > 0 ? (
                <ul className={styles.matchList}>
                    {matches.map(match => {
                        const isWinner = match.winner._id === user._id;
                        const opponent = match.players.find(p => p._id !== user._id);
                        return (
                            <li key={match._id} className={styles.matchItem}>
                                <div className={styles.matchSummary}>
                                    <span className={isWinner ? styles.win : styles.loss}>{isWinner ? 'WIN' : 'LOSS'}</span>
                                    <span>vs {opponent?.username || 'Unknown'}</span>
                                    <span className={styles.gameType}>{match.gameType}</span>
                                    <span className={styles.matchDate}>{new Date(match.createdAt).toLocaleDateString()}</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p>No matches played yet.</p>
            )}
        </div>

      </div>
    </>
  );
};

export default StatsPage;