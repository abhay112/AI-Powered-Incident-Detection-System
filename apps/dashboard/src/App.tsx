import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import IncidentList from './pages/IncidentList';
import IncidentDetail from './pages/IncidentDetail';

export default function App() {
    return (
        <div className="app">
            <Navbar />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<IncidentList />} />
                    <Route path="/incidents/:id" element={<IncidentDetail />} />
                </Routes>
            </main>
        </div>
    );
}
