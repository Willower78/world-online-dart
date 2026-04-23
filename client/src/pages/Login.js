import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Login.module.css';

import { ReactComponent as Dartboard } from '../assets/dartboard.svg';

import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();
    const { email, password } = formData;

    const onChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(''); // Clear error on new input
    };

    const onSubmit = async e => {
        e.preventDefault();
        setError('');
        try {
            const res = await axios.post('/api/auth/login', { email, password });
            login(res.data);
            
            // Role-based redirect
            const user = res.data.user;
            if (user.isAdmin || user.role === 'admin') {
                navigate('/admin');
            } else if (user.role === 'federation') {
                navigate('/federation');
            } else {
                navigate('/lobby');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.msg || 'Login failed. Please check your credentials.';
            console.error('Login error:', errorMessage);
            setError(errorMessage);
        }
    };

    return (
        <div className={styles.loginContainer}>
            
            <div className={styles.loginBox}>
                <Dartboard className={styles.dartboard} />
                <h1 className={styles.title}>World Online Dart</h1>
                <p className={styles.subtitle}>Sign in to continue</p>
                
                <form onSubmit={onSubmit} className={styles.form}>
                    <input 
                        className={styles.input} 
                        type="email" 
                        name="email" 
                        value={email} 
                        onChange={onChange} 
                        placeholder="Email" 
                        required 
                    />
                    <input 
                        className={styles.input} 
                        type="password" 
                        name="password" 
                        value={password} 
                        onChange={onChange} 
                        placeholder="Password" 
                        required 
                    />
                    <button className={styles.button} type="submit">Login</button>
                </form>

                {error && <div className={styles.error}>{error}</div>}

                <p>
                    Don't have an account? <Link to="/register" className={styles.link}>Register here</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;