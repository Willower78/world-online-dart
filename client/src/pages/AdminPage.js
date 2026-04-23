import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, Link } from 'react-router-dom';
import styles from './AdminPage.module.css';
import { FaTachometerAlt, FaUsers, FaTrophy, FaGamepad, FaGift, FaArrowLeft, FaChessBoard, FaExclamationTriangle } from 'react-icons/fa';

import DashboardView from '../components/admin/DashboardView';
import UsersView from '../components/admin/UsersView';
import TournamentsView from '../components/admin/TournamentsView';
import MatchesView from '../components/admin/MatchesView';
import RewardsView from '../components/admin/RewardsView';
import LeaguesView from '../components/admin/LeaguesView';
import ReportsView from '../components/admin/ReportsView';

const AdminPage = () => {
    const [user] = useState(JSON.parse(localStorage.getItem('user')));
    const [activeTab, setActiveTab] = useState('dashboard');
    const navigate = useNavigate();

    useEffect(() => {
        if (!user || !user.isAdmin) {
            toast.error('Access Denied. Admins only.');
            navigate('/profile');
        }
    }, [user, navigate]);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardView />;
            case 'users': return <UsersView />;
            case 'tournaments': return <TournamentsView />;
            case 'matches': return <MatchesView />;
            case 'rewards': return <RewardsView />;
            case 'leagues': return <LeaguesView />;
            case 'reports': return <ReportsView />;
            default: return <DashboardView />;
        }
    };

    if (!user || !user.isAdmin) return null;

    const Tab = ({ name, icon, label }) => (
        <button
            className={`${styles.tabButton} ${activeTab === name ? styles.active : ''}`}
            onClick={() => setActiveTab(name)}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Admin Dashboard</h1>
                <Link to="/profile" className={styles.backLink}><FaArrowLeft /> Back to Profile</Link>
            </header>

            <nav className={styles.tabNav}>
                <Tab name="dashboard" icon={<FaTachometerAlt />} label="Dashboard" />
                <Tab name="users" icon={<FaUsers />} label="Users" />
                <Tab name="reports" icon={<FaExclamationTriangle />} label="Reports" />
                <Tab name="tournaments" icon={<FaTrophy />} label="Tournaments" />
                <Tab name="leagues" icon={<FaChessBoard />} label="Leagues" />
                <Tab name="matches" icon={<FaGamepad />} label="Matches" />
                <Tab name="rewards" icon={<FaGift />} label="Rewards" />
            </nav>

            <main className={styles.content}>
                {renderContent()}
            </main>
        </div>
    );
};

export default AdminPage;