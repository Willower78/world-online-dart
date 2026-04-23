import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import socket from '../socket/socket';
import TopHeader from '../components/TopHeader';
import styles from './Lobby.module.css';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Promotions from '../components/Promotions';

const Lobby = () => {
    // --- Live Data State ---
    const [liveMatches, setLiveMatches] = useState([]);
    const [globalStats, setGlobalStats] = useState({ matches: 0, liveGames: 0, onlineUsers: 0 });

    // --- Search State ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    // --- Existing Logic ---
    const [isSearching, setIsSearching] = useState(false);
    const { user, isSubscriber } = useAuth();
    const navigate = useNavigate();
    const { onMenuClick } = useOutletContext();

    const GAME_MODES = {
        '501': { label: '501', isPractice: false },
        'cricket': { label: 'Cricket', isPractice: false },
        '301_dido': { label: '301 DIDO', isPractice: false },
        'bobs_27': { label: "Bob's 27", isPractice: true },
    };

    const GameCard = ({ match }) => (
        <div className={styles.gameCard}>
            <div className={styles.cardHeader}>
                <span>{match.title}</span>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => navigate(`/spectate/${match.id}`)}>Watch Match</button>
            </div>
            <div className={styles.cardBody}>
                <div className={styles.matchInfo}>
                    <div className={styles.player}>
                        <img src={match.p1.flag} className={styles.flag} alt={match.p1.name} />
                        <span>{match.p1.name}</span>
                    </div>
                    <div className={styles.scoreBox}>
                        <span className={styles.set}>VS</span>
                        <span className={styles.score}>{match.score}</span>
                    </div>
                    <div className={`${styles.player} ${styles.right}`}>
                        <span>{match.p2.name}</span>
                        <img src={match.p2.flag} className={styles.flag} alt={match.p2.name} />
                    </div>
                </div>
            </div>
        </div>
    );
    
    useEffect(() => {
        if (!user) {
            navigate('/login'); 
            return;
        }

        const fetchGlobalStats = async () => {
            try {
                const res = await axios.get('/api/stats/global');
                setGlobalStats({
                    matches: res.data.totalMatches,
                    liveGames: res.data.liveGames,
                    onlineUsers: res.data.onlineUsers,
                });
            } catch (err) {
                console.error("Failed to fetch global stats:", err);
            }
        };
        fetchGlobalStats();

        const onWaitingForMatch = () => setIsSearching(true);
        const onMatchCancelled = () => setIsSearching(false);
        const onLobbyUpdate = (matches) => setLiveMatches(matches);
        const onGameStart = (game) => {
            console.log('Game started, navigating to:', game.gameId);
            navigate(`/game/${game.gameId}`);
        };

        socket.on('waiting_for_match', onWaitingForMatch);
        socket.on('matchmaking_cancelled', onMatchCancelled);
        socket.on('lobby_state_update', onLobbyUpdate);
        socket.on('game_start', onGameStart);
        
        socket.emit('request_lobby_state');

        const intervalId = setInterval(fetchGlobalStats, 30000); 

        return () => {
            socket.off('waiting_for_match', onWaitingForMatch);
            socket.off('matchmaking_cancelled', onMatchCancelled);
            socket.off('lobby_state_update', onLobbyUpdate);
            socket.off('game_start', onGameStart);
            clearInterval(intervalId);
        };
    }, [navigate, user]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim().length > 1) {
                setIsSearchingUsers(true);
                try {
                    const res = await axios.get(`/api/users/search?q=${searchQuery}`);
                    setSearchResults(res.data);
                } catch (err) {
                    console.error("Search failed", err);
                } finally {
                    setIsSearchingUsers(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleFindMatch = (gameType) => {
        if (!isSubscriber) {
            toast.info("Finding a match is a subscriber-only feature. Please upgrade to Premium!");
            return navigate('/premium');
        }

        if (isSearching) {
            socket.emit('cancel_find_match');
        } else {
            socket.emit('find_match', {
                gameType: gameType,
                username: user.username,
                userId: user._id
            });
        }
    };

    const handleStartPractice = (gameType) => {
        socket.emit('create_practice_game', {
            gameType: gameType,
            username: user.username,
            userId: user._id
        });
    };

    return (
        <>
            <TopHeader title="PLAY ONLINE" onMenuClick={onMenuClick} />
            
            <div className={styles.subHeader}>
                <div className={styles.tabs}>
                    <a href="#" onClick={(e) => e.preventDefault()} className={`${styles.tab} ${styles.active}`}>LOBBY</a>
                    <a href="#" onClick={(e) => e.preventDefault()} className={styles.tab}>LIVE GAMES</a>
                </div>
            </div>

            <div className={styles.contentPadding}>
                <div className={styles.searchBar}>
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input 
                        type="text" 
                        placeholder="Search for players..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* --- CUPS SECTION --- */}
                <div className={styles.cupsSection}>
                    <div className={styles.cupsContainer}>
                         <div className={styles.cupCard}>
                             <div className={styles.cupHeader}>DAILY CUP</div>
                             <div className={styles.cupBody}>
                                 <span className={styles.cupPrize}>Win Giftcards!</span>
                                 <span className={styles.cupFee}>Entry: €4</span>
                                 <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>Join Daily</button>
                             </div>
                         </div>
                         <div className={styles.cupCard}>
                             <div className={styles.cupHeader}>WEEKLY CUP</div>
                             <div className={styles.cupBody}>
                                 <span className={styles.cupPrize}>Big Prizes!</span>
                                 <span className={styles.cupFee}>Entry: €10</span>
                                 <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>Join Weekly</button>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Search Results Grid */}
                {searchResults.length > 0 && (
                    <div className={styles.searchResultsContainer}>
                        <h3 className={styles.resultsTitle}>Search Results</h3>
                        <div className={styles.userGrid}>
                            {searchResults.map(resultUser => (
                                <Link to={`/user/${resultUser._id}`} key={resultUser._id} className={styles.userCard}>
                                    <div className={styles.userAvatar} style={{backgroundImage: `url(${resultUser.profilePicture || 'https://via.placeholder.com/150'})`}}></div>
                                    <div className={styles.userInfo}>
                                        <span className={styles.userName}>{resultUser.username}</span>
                                        <div className={styles.userDetails}>
                                            <span className={styles.userLocation}>{resultUser.location || 'Unknown'}</span>
                                            <span className={styles.userClassBadge}>{resultUser.classification || 'Unranked'}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.cardGrid}>
                    {liveMatches.length > 0 ? (
                        liveMatches.map(match => <GameCard key={match.id} match={match} />)
                    ) : (
                        null // Only show if matches exist
                    )}
                </div>

                <div className={styles.fullWidthSection}>
                    <div className={styles.statsGrid}>
                        {/* Global Mode Box - Split */}
                        <div className={styles.statBox}>
                            <h3>GLOBAL MODE</h3>
                            
                            <div className={styles.gameSelectionArea}>
                                {Object.entries(GAME_MODES).map(([key, { label, isPractice }]) => (
                                    <button 
                                        key={key}
                                        className={`${styles.btn} ${styles.btnOrange}`}
                                        onClick={() => {
                                            if (isPractice) {
                                                handleStartPractice(key);
                                            } else {
                                                handleFindMatch(key);
                                            }
                                        }}
                                        disabled={!isPractice && !isSubscriber} 
                                        title={!isPractice && !isSubscriber ? "Subscriber only" : ""}
                                    >
                                        {!isPractice && isSearching ? "Searching..." : label}
                                    </button>
                                ))}
                            </div>

                            <div className={styles.divider}></div>

                            {/* Separated Stats Box */}
                            <div className={styles.liveStatsContainer}>
                                <div className={styles.statItem}>
                                    <span className={styles.big}>{globalStats.onlineUsers}</span> 
                                    <span className={styles.label}>Players Online</span>
                                </div>
                                <div className={styles.statSeparator}></div>
                                <div className={styles.statItem}>
                                    <span className={styles.big}>{globalStats.liveGames}</span> 
                                    <span className={styles.label}>Live Games</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className={styles.statBox}>
                            <h3>FRIEND MODE</h3>
                            <div className={styles.friendModeContent}>
                                <p>Challenge your friends to a private match.</p>
                                <button 
                                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} 
                                    onClick={() => isSubscriber ? navigate('/friends') : navigate('/premium')}
                                    title={!isSubscriber ? "Subscriber only" : "Challenge a friend"}
                                >
                                    Challenge a friend!
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.fullWidthSection}>
                    <h2>Special Offers & News</h2>
                    <Promotions />
                </div>
            </div>
        </>
    );
};

export default Lobby;
