import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import Spinner from '../components/Spinner';
import styles from './LeagueDetailPage.module.css';

const LeagueDetailPage = () => {
  const { id } = useParams();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('divisions');

  useEffect(() => {
    const fetchLeague = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/leagues/${id}`);
        setLeague(res.data);
      } catch (err) {
        setError('Failed to load league details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeague();
  }, [id]);

  const handleJoinLeague = async () => {
    try {
      const res = await axios.post(`/api/leagues/${id}/join`);
      toast.success(res.data.msg || 'Successfully joined league!');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to join league.');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'divisions':
        return (
          <div>
            {league.divisions.map((div, index) => (
              <div key={index} className={styles.divisionBox}>
                <h4>Division {div.divisionNumber} ({div.players.length} / {league.maxPlayersPerDivision})</h4>
                <ul className={styles.playerList}>
                  {div.players.map(p => <li key={p._id}>{p.username}</li>)}
                </ul>
              </div>
            ))}
          </div>
        );
      case 'standings':
        return <p>Standings will be displayed here once the league starts.</p>;
      case 'schedule':
        return <p>The match schedule will be generated when the league starts.</p>;
      default:
        return null;
    }
  };

  if (loading) return <Spinner />;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!league) return <p>League not found.</p>;

  return (
    <div className={styles.detailContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.leagueName}>{league.name}</h1>
          <p className={styles.leagueRegion}>{league.region}</p>
        </div>
        {league.status === 'Recruiting' && (
          <button onClick={handleJoinLeague} className={styles.joinButton}>
            Join League (€{league.entryFeeEuros})
          </button>
        )}
      </header>

      <div className={styles.tabNav}>
        <button onClick={() => setActiveTab('divisions')} className={activeTab === 'divisions' ? styles.active : ''}>Divisions</button>
        <button onClick={() => setActiveTab('standings')} className={activeTab === 'standings' ? styles.active : ''}>Standings</button>
        <button onClick={() => setActiveTab('schedule')} className={activeTab === 'schedule' ? styles.active : ''}>Schedule</button>
      </div>

      <div className={styles.tabContent}>
        {renderContent()}
      </div>
    </div>
  );
};

export default LeagueDetailPage;