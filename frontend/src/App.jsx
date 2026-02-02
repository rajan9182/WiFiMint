import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login'; // Keep existing for Client Login ? Or replace?
// Let's assume Login is the "User" login (Captive Portal)
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import CustomerBase from './pages/CustomerBase';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <Router>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<AdminLogin />} />

                {/* Protected Admin Routes */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/customers" element={<CustomerBase />} />
                </Route>

                {/* Catch-all: Redirect to Login (Captive Portal behavior) */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
