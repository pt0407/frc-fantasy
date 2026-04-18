import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, signInEmail, signUpEmail } = useAuth();
  const navigate = useNavigate();

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!displayName.trim()) throw new Error('Display name is required');
        await signUpEmail(email, password, displayName);
      } else {
        await signInEmail(email, password);
      }
      navigate('/dashboard');
    } catch (e) {
      setError(e.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">FRC Fantasy</span>
          </div>
          <p className="text-slate-400 text-sm">Draft FRC teams. Dominate your league.</p>
        </div>

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-8">
          <div className="flex bg-[#0f1117] rounded-xl p-1 mb-6">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-xl transition-all mb-5 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#2a2d3a]" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-[#2a2d3a]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Loading...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
