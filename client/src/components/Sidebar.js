import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
    FaGlobe, 
    FaTrophy, 
    FaList, 
    FaUserGear, 
    FaUsers, 
    FaNewspaper, 
    FaRankingStar, 
    FaShieldHalved,
    FaUser,
    FaUserGroup,
    FaCommentDots,
    FaEnvelope
} from 'react-icons/fa6';
import styles from './Sidebar.module.css';
import { useOnlineFriends } from '../context/OnlineFriendsContext';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { onlineFriends, onlineFriendCount } = useOnlineFriends();
    const [isFriendsDropdownOpen, setFriendsDropdownOpen] = useState(false);
    const navigate = useNavigate();

    const NavItem = ({ to, icon, children, hasIndicator = false }) => (
        <NavLink 
            to={to} 
            className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}
            onClick={onClose}
        >
            {icon} {children}
            {hasIndicator && <span className={styles.onlineIndicator}></span>}
        </NavLink>
    );

    const handleFriendItemClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFriendsDropdownOpen(prev => !prev);
    };

    const handleNavigate = (path) => {
        navigate(path);
        onClose();
    };

    if (!user) {
        return <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}></aside>;
    }

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.userProfile}>
                <div className={styles.avatarCircle}>
                    {user.profilePicture ? (
                        <img src={`${user.profilePicture}?${new Date().getTime()}`} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
                    ) : (
                        <FaUser />
                    )}
                </div>
                <h3>{user.username}</h3>
            </div>

            <nav className={styles.navMenu}>
                <NavItem to="/lobby" icon={<FaGlobe />}>Play Online</NavItem>
                <NavItem to="/inbox" icon={<FaEnvelope />}>Inbox</NavItem>
                <NavItem to="/tournaments" icon={<FaTrophy />}>Online Tournaments</NavItem>
                <NavItem to="/leagues" icon={<FaList />}>Leagues</NavItem>
                <NavItem to="/profile" icon={<FaUserGear />}>Profile</NavItem>
                
                {/* Friends Dropdown Item */}
                <div className={styles.navItem} onClick={handleFriendItemClick}>
                    <FaUsers /> Friends
                    {onlineFriendCount > 0 && <span className={styles.onlineIndicator}></span>}
                    <span className={styles.friendCount}>{onlineFriendCount}</span>
                </div>

                {isFriendsDropdownOpen && (
                    <div className={styles.friendsDropdown}>
                        <div className={styles.dropdownItem} onClick={() => handleNavigate('/friends')}>
                            <FaUserGroup /> Manage Friends
                        </div>
                        {onlineFriends.length > 0 ? (
                            onlineFriends.map(friend => (
                                <div key={friend._id} className={styles.dropdownItem}>
                                    <span className={styles.friendName}>{friend.username}</span>
                                    <button 
                                        className={styles.messageButton} 
                                        onClick={() => handleNavigate(`/chat/${friend._id}`)}
                                    >
                                        <FaCommentDots />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className={`${styles.dropdownItem} ${styles.noFriends}`}>No friends online</div>
                        )}
                    </div>
                )}

                <NavItem to="/social" icon={<FaNewspaper />}>Feed</NavItem>
                <NavItem to="/leaderboard" icon={<FaRankingStar />}>Leaderboard</NavItem>
                {user.isAdmin && (
                    <NavItem to="/admin" icon={<FaShieldHalved />}>Admin</NavItem>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;