import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import LeaguesPage from './pages/LeaguesPage';
import LeaguePage from './pages/LeaguePage';
import DraftPage from './pages/DraftPage';
import BettingPage from './pages/BettingPage';
import LeaderboardPage from './pages/LeaderboardPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? children : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/auth'} replace />} />
      <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/leagues" element={<PrivateRoute><Layout><LeaguesPage /></Layout></PrivateRoute>} />
      <Route path="/leagues/:id" element={<PrivateRoute><Layout><LeaguePage /></Layout></PrivateRoute>} />
      <Route path="/leagues/:id/draft" element={<PrivateRoute><Layout><DraftPage /></Layout></PrivateRoute>} />
      <Route path="/betting" element={<PrivateRoute><Layout><BettingPage /></Layout></PrivateRoute>} />
      <Route path="/leaderboard" element={<PrivateRoute><Layout><LeaderboardPage /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
