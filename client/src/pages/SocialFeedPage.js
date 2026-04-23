import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link, useOutletContext } from 'react-router-dom';
import socket from '../socket/socket';
import Spinner from '../components/Spinner';
import TopHeader from '../components/TopHeader';
import styles from './SocialFeedPage.module.css';

const SocialFeedPage = () => {
    const [posts, setPosts] = useState([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [commentTexts, setCommentTexts] = useState({});
    const [loading, setLoading] = useState(true);
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const { onMenuClick } = useOutletContext();

    const fetchFeed = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/posts/feed');
            setPosts(res.data);
        } catch (err) {
            console.error('Could not fetch feed', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeed();

        const handleFeedUpdate = () => {
            console.log('Feed update received from server, refetching...');
            fetchFeed();
        };
        socket.on('feed_updated', handleFeedUpdate);

        return () => {
            socket.off('feed_updated', handleFeedUpdate);
        };
    }, [fetchFeed]);

    const handlePostSubmit = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() && !mediaFile) return;

        try {
            const formData = new FormData();
            formData.append('content', newPostContent);
            if (mediaFile) {
                formData.append('media', mediaFile);
            }

            await axios.post('/api/posts', formData);

            setNewPostContent('');
            setMediaFile(null);
            if (document.getElementById('media-input')) {
                document.getElementById('media-input').value = null;
            }
        } catch (err) {
            console.error('Could not create post', err);
            alert('Failed to create post.');
        }
    };

    const handleReaction = async (postId, reactionType) => {
        try {
            await axios.post(`/api/posts/react/${postId}`, { reactionType });
        } catch (err) {
            console.error('Could not react to post', err);
            alert('Failed to react to post.');
        }
    };

    const handleCommentSubmit = async (e, postId) => {
        e.preventDefault();
        const text = commentTexts[postId];
        if (!text || !text.trim()) return;
        try {
            await axios.post(`/api/posts/comment/${postId}`, { text });
            setCommentTexts(prev => ({ ...prev, [postId]: '' }));
        } catch (err) {
            console.error('Could not add comment', err);
            alert(err.response?.data?.msg || 'Failed to add comment.');
        }
    };

    const handleDeletePost = async (postId) => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            try {
                await axios.delete(`/api/posts/${postId}`);
            } catch (err) {
                console.error('Could not delete post', err);
                alert(err.response?.data?.msg || 'Failed to delete post.');
            }
        }
    };

    return (
        <>
            <TopHeader title="SOCIAL FEED" onMenuClick={onMenuClick} />
            <div className={styles.contentPadding}>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Create a Post</h2>
                    <form onSubmit={handlePostSubmit} className={styles.form}>
                        <textarea
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            placeholder="What's on your mind?"
                            className={styles.textarea}
                            rows="4"
                        />
                        <input
                            id="media-input"
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => setMediaFile(e.target.files[0])}
                            className={styles.fileInput}
                        />
                        <button type="submit" className={styles.button}>Post</button>
                    </form>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Recent Activity</h2>
                    {loading ? <Spinner /> : posts.length > 0 ? (
                        <ul className={styles.list}>
                            {posts.map(post => (
                                <li key={post._id} className={styles.postItem}>
                                    <div className={styles.postHeader}>
                                        <Link to={`/user/${post.user._id}`} className={styles.profileLink}>
                                            <img src={`${post.user.profilePicture}`} alt={post.user.username} />
                                            <strong>{post.user.username}</strong>
                                        </Link>
                                        <div>
                                            <span className={styles.postDate}>{new Date(post.createdAt).toLocaleString()}</span>
                                            {(currentUser?._id === post.user._id || currentUser?.isAdmin) && (
                                                <button onClick={() => handleDeletePost(post._id)} className={styles.deleteButton}>
                                                    &times;
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <p className={styles.postContent}>{post.content}</p>

                                    {post.mediaUrl && (
                                        post.mediaType === 'image' ?
                                        <img src={`${post.mediaUrl}`} alt="Post media" className={styles.media} /> :
                                        <video src={`${post.mediaUrl}`} controls className={styles.media} />
                                    )}

                                    <div className={styles.actionBar}>
                                        <button onClick={() => handleReaction(post._id, 'likes')} className={styles.actionButton}>👍 {post.reactions.likes.length}</button>
                                        <button onClick={() => handleReaction(post._id, 'dislikes')} className={styles.actionButton}>👎 {post.reactions.dislikes.length}</button>
                                        <button onClick={() => handleReaction(post._id, 'hugs')} className={styles.actionButton}>🤗 {post.reactions.hugs.length}</button>
                                        <button onClick={() => handleReaction(post._id, 'hearts')} className={styles.actionButton}>❤️ {post.reactions.hearts.length}</button>
                                    </div>

                                    <div className={styles.commentsSection}>
                                        {post.comments.map(comment => (
                                            <div key={comment._id} className={styles.comment}>
                                                <img src={`${comment.user.profilePicture}`} alt={comment.user.username} className={styles.commentAvatar} />
                                                <div className={styles.commentText}>
                                                    <Link to={`/user/${comment.user._id}`} className={styles.profileLink}><strong>{comment.user.username}</strong></Link>
                                                    <p>{comment.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                        <form onSubmit={(e) => handleCommentSubmit(e, post._id)} className={styles.commentForm}>
                                            <input
                                                type="text"
                                                maxLength="200"
                                                placeholder="Write a comment..."
                                                value={commentTexts[post._id] || ''}
                                                onChange={(e) => setCommentTexts(prev => ({ ...prev, [post._id]: e.target.value }))}
                                                className={styles.commentInput}
                                            />
                                        </form>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p>No posts to show. Add some friends or create a post!</p>}
                </div>
            </div>
        </>
    );
};

export default SocialFeedPage;