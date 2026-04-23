import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Register.module.css';
import { ReactComponent as Dartboard } from '../assets/dartboard.svg';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    realName: '',
    nickname: '',
    address: '',
    city: '',
    country: '',
    estimatedAverage: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { username, email, password, realName, nickname, address, city, country, estimatedAverage } = formData;

  const onChange = e => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
      setError('');
  };

  const onSubmit = async e => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/register', formData);
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['x-auth-token'] = token;

      navigate('/profile');
    } catch (err) {
      if (err.response) {
        console.error('Registration error:', err.response.data);
        setError(err.response.data.msg || 'Registration failed. Please try again.');
      } else {
        console.error('Network error:', err.message);
        setError('Could not connect to the server. Please ensure it is running and try again.');
      }
    }
  };

  return (
    <div className={styles.registerContainer}>
        <div className={styles.registerBox}>
            <Dartboard className={styles.dartboard} />
            <h1 className={styles.title}>Register Account</h1>
            
            <form onSubmit={onSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <input 
                        className={styles.input} type="text" name="username" value={username} onChange={onChange} placeholder="Username" required 
                    />
                </div>
                
                <div className={styles.inputGroup}>
                    <input 
                        className={styles.input} type="email" name="email" value={email} onChange={onChange} placeholder="Email" required 
                    />
                </div>
                
                <div className={styles.inputGroup}>
                    <input 
                        className={styles.input} type="password" name="password" value={password} onChange={onChange} placeholder="Password (min 6 chars)" minLength="6" required 
                    />
                </div>

                <hr className={styles.divider} />
                <p className={styles.sectionTitle}>Profile Details</p>

                <div className={styles.row}>
                    <input className={styles.input} type="text" name="realName" value={realName} onChange={onChange} placeholder="Real Name (Private)" required />
                    <input className={styles.input} type="text" name="nickname" value={nickname} onChange={onChange} placeholder="Nickname" required />
                </div>

                <div className={styles.inputGroup}>
                    <input className={styles.input} type="text" name="address" value={address} onChange={onChange} placeholder="Address" required />
                </div>

                <div className={styles.row}>
                    <input className={styles.input} type="text" name="city" value={city} onChange={onChange} placeholder="City" required />
                    <input className={styles.input} type="text" name="country" value={country} onChange={onChange} placeholder="Country" required />
                </div>

                <div className={styles.inputGroup}>
                     <label className={styles.label}>Estimated 3-Dart Average</label>
                     <select className={styles.select} name="estimatedAverage" value={estimatedAverage} onChange={onChange} required>
                         <option value="">Select your average...</option>
                         <option value="30">Beginner (0 - 45)</option>
                         <option value="60">Amateur (46 - 84)</option>
                         <option value="90">Pro (85+)</option>
                     </select>
                </div>

                <button className={styles.button} type="submit">Register</button>
            </form>
            
            {error && <div className={styles.error}>{error}</div>}

            <p style={{ position: 'relative', zIndex: 1, marginTop: '20px' }}>
                Already have an account? <Link to="/login" className={styles.link}>Login here</Link>
            </p>
        </div>
    </div>
  );
};

export default Register;