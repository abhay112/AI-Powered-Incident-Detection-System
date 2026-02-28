import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
    const [isOnline, setIsOnline] = useState(true);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const check = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', check);
        window.addEventListener('offline', check);
        return () => {
            window.removeEventListener('online', check);
            window.removeEventListener('offline', check);
        };
    }, []);

    return (
        <nav className="navbar" role="navigation" aria-label="main navigation">
            <div className="navbar-inner">
                <Link to="/" className="navbar-brand" aria-label="SRE Incident Command Center home">
                    <div className="navbar-logo" aria-hidden="true">⚡</div>
                    <div>
                        <div className="navbar-title">SRE Command Center</div>
                        <div className="navbar-subtitle">AI Incident Detection System</div>
                    </div>
                </Link>

                <div className="navbar-status">
                    <div className={`status-dot ${isOnline ? '' : 'offline'}`} aria-hidden="true" />
                    <span>{isOnline ? 'Systems Operational' : 'Offline'}</span>
                    <span style={{ color: 'var(--border-color)', margin: '0 0.5rem' }}>|</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem' }}>
                        {time.toLocaleTimeString()}
                    </span>
                </div>
            </div>
        </nav>
    );
}
