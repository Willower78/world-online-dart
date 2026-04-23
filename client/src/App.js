import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context
import { OnlineFriendsProvider } from './context/OnlineFriendsContext';
import { AuthProvider } from './context/AuthContext';

// Components
import SubscriberRoute from './components/SubscriberRoute';
import GameWrapper from './components/GameWrapper';
import MainLayout from './components/MainLayout';

// Page Imports
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Lobby from './pages/Lobby';
import Inbox from './pages/Inbox';
import FriendsPage from './pages/FriendsPage';
import SocialFeedPage from './pages/SocialFeedPage';
import ChatPage from './pages/ChatPage';
import UserProfilePage from './pages/UserProfilePage';
import PremiumPage from './pages/PremiumPage';
import TournamentDetailPage from './pages/TournamentDetailPage';
import TournamentsPage from './pages/TournamentsPage';
import LeaguesPage from './pages/LeaguesPage';
import LeagueDetailPage from './pages/LeagueDetailPage';
import MyMatchesPage from './pages/MyMatchesPage';
import AdminPage from './pages/AdminPage';
import FederationDashboard from './pages/FederationDashboard';
import LeaderboardPage from './pages/LeaderboardPage';
import WalletPage from './pages/WalletPage';
import SpectatePage from './pages/SpectatePage';
import LandingPage from './pages/LandingPage';
import CalibrationPage from './pages/CalibrationPage';

// Import socket to ensure connection initialization
import './socket/socket';

function App() {
  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/landing" element={<LandingPage />} />
          
          {/* Main App Routes (Wrapped in Layout) */}
          <Route element={<MainLayout />}>
             <Route path="/" element={<Lobby />} />
             <Route path="/profile" element={<Profile />} />
             <Route path="/user/:userId" element={<UserProfilePage />} />
             <Route path="/inbox" element={<Inbox />} />
             <Route path="/friends" element={<FriendsPage />} />
             <Route path="/social" element={<SocialFeedPage />} />
             <Route path="/chat" element={<ChatPage />} />
             <Route path="/leaderboard" element={<LeaderboardPage />} />
             <Route path="/premium" element={<PremiumPage />} />
             <Route path="/wallet" element={<WalletPage />} />
             <Route path="/admin" element={<AdminPage />} />
             <Route path="/federation" element={<FederationDashboard />} />
             <Route path="/calibration" element={<CalibrationPage />} />
             
             {/* Subscriber Only Routes */}
             <Route element={<SubscriberRoute />}>
                <Route path="/tournaments" element={<TournamentsPage />} />
                <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
                <Route path="/leagues" element={<LeaguesPage />} />
                <Route path="/leagues/:id" element={<LeagueDetailPage />} />
                <Route path="/my-matches" element={<MyMatchesPage />} />
                <Route path="/spectate/:gameId" element={<SpectatePage />} />
             </Route>
          </Route>

          {/* Game Routes (Typically no MainLayout to maximize screen space) */}
          <Route element={<SubscriberRoute />}>
             <Route path="/game/:gameId" element={<GameWrapper />} />
          </Route>

           {/* Fallback */}
           <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

function AppWrapper() {
  return (
    <Router>
      <AuthProvider>
        <OnlineFriendsProvider>
          <App />
        </OnlineFriendsProvider>
      </AuthProvider>
    </Router>
  );
}

export default AppWrapper;
