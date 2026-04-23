import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';

const LandingPage = () => {
    // Mock data for the components
    const newsItems = [
        { id: 1, title: 'WOD Premier League: Omgång 12 summering', meta: 'Match Report', thumb: 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=400' },
        { id: 2, title: 'Topp 10 högsta checkouts denna veckan', meta: 'Video', thumb: 'https://images.unsplash.com/photo-1526660690293-bcd32dc3b123?w=400' },
        { id: 3, title: 'Registreringen öppen för "Winter Classic"', meta: 'Tournament', thumb: 'https://placehold.co/100x70/222222/222222.png' },
        { id: 4, title: 'Ny uppdatering av dart-appen släppt', meta: 'Tech', thumb: 'https://images.unsplash.com/photo-1564518036089-3546e5a5856d?w=400' }
    ];

    const latestResults = {
        yesterday: [
            { id: 1, p1: '🇬🇧 Smith', s1: 7, p2: '🇳🇱 Van Gerwen', s2: 4 },
            { id: 2, p1: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Wright', s1: 5, p2: '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Price', s2: 7 }
        ],
        live: [
            { id: 3, p1: '🇸🇪 Andersson', s1: 3, p2: '🇧🇪 Huybrechts', s2: 2, live: 'Set 2, Leg 3' }
        ]
    };

    return (
        <div style={{backgroundColor: 'var(--bg-color)'}}>
            <header>
                <div className={styles.topBar}>
                    <div>WOD Corporate</div>
                    <div>Community</div>
                    <div>Shop</div>
                </div>
                <nav className={styles.nav}>
                    <div className={styles.logo}>
                        WORLD<span>ONLINE</span>DART
                    </div>
                    <div className={styles.navLinks}>
                        <Link to="#">Matches</Link>
                        <Link to="#">Rankings</Link>
                        <Link to="#">Statistics</Link>
                        <Link to="/tournaments">Tournaments</Link>
                        <Link to="#">Players</Link>
                        <Link to="#">News</Link>
                    </div>
                    <div className={styles.userActions}>
                        <Link to="#" style={{fontSize:'1.2rem'}}>🔍</Link>
                        <Link to="/login" className={styles.btnLogin}>Sign in</Link>
                    </div>
                </nav>
            </header>

            <main className={styles.container}>
                <section className={styles.heroCard}>
                    <div className={styles.heroTag}>Breaking News</div>
                    <div className={styles.heroTitle}>
                        Andersson vinner finalen<br />
                        efter avgörande 9-darter
                    </div>
                    <p style={{fontSize: '1.1rem', marginTop:'10px'}}>Svensken säkrar sin första WOD-titel i en dramatisk uppgörelse.</p>
                </section>

                <section className={styles.newsColumn}>
                    {newsItems.map(item => (
                        <div key={item.id} className={styles.newsCard}>
                            <div className={styles.newsThumb} style={{backgroundImage: `url('${item.thumb}')`}}></div>
                            <div className={styles.newsInfo}>
                                <h4>{item.title}</h4>
                                <span className={styles.newsMeta}>{item.meta}</span>
                            </div>
                        </div>
                    ))}
                </section>

                <aside className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>
                        <h2>Latest Results</h2>
                        <Link to="#" className={styles.viewAll}>View all matches &gt;</Link>
                    </div>

                    <h3>Yesterday - WOD Major</h3>
                    {latestResults.yesterday.map(match => (
                        <div key={match.id} className={styles.matchRow}>
                            <div className={styles.matchTeams}>
                                <div className={styles.team}><span>{match.p1}</span><span className={styles.score}>{match.s1}</span></div>
                                <div className={styles.team}><span>{match.p2}</span><span className={styles.score}>{match.s2}</span></div>
                            </div>
                        </div>
                    ))}
                    
                    <h3 style={{marginTop: '25px'}}>Live Now <span className={styles.liveBadge}>LIVE</span></h3>
                    {latestResults.live.map(match => (
                         <div key={match.id} className={styles.matchRow}>
                            <div className={styles.matchTeams}>
                                <div className={styles.team}><span>{match.p1}</span><span className={styles.score}>{match.s1}</span></div>
                                <div className={styles.team}><span>{match.p2}</span><span className={styles.score}>{match.s2}</span></div>
                            </div>
                            <div style={{fontSize:'0.7rem', color:'var(--accent-green)', marginLeft:'10px'}}>
                                {match.live.split(',').map(part => <div key={part}>{part}</div>)}
                            </div>
                        </div>
                    ))}
                </aside>
            </main>
        </div>
    );
};

export default LandingPage;
