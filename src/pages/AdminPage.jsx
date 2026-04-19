import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, setUserCoins, addUserCoins, toggleLbBlacklist, emergencyWipe } from '../lib/firestore';
import { Coins, Shield, Search, EyeOff, Eye, Plus, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

const ADMIN_EMAIL = 'pranav07t@gmail.com';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [coinInputs, setCoinInputs] = useState({});
  const [working, setWorking] = useState({});
  const [wipeStep, setWipeStep] = useState(0);
  const [wiping, setWiping] = useState(false);

  async function handleWipe() {
    setWiping(true);
    try {
      await emergencyWipe();
      setUsers([]);
      setWipeStep(0);
    } catch (e) {
      alert('Wipe failed: ' + e.message);
    } finally {
      setWiping(false);
    }
  }

  if (user?.email !== ADMIN_EMAIL) {
    return <div className="text-center text-slate-400 py-20">Access denied.</div>;
  }

  async function load() {
    setLoading(true);
    const all = await getAllUsers();
    setUsers(all);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSetCoins(uid) {
    const val = Number(coinInputs[uid]);
    if (isNaN(val)) return;
    setWorking((w) => ({ ...w, [uid]: true }));
    await setUserCoins(uid, val);
    await load();
    setCoinInputs((c) => ({ ...c, [uid]: '' }));
    setWorking((w) => ({ ...w, [uid]: false }));
  }

  async function handleAddCoins(uid) {
    const val = Number(coinInputs[uid]);
    if (isNaN(val) || val === 0) return;
    setWorking((w) => ({ ...w, [uid]: true }));
    await addUserCoins(uid, val);
    await load();
    setCoinInputs((c) => ({ ...c, [uid]: '' }));
    setWorking((w) => ({ ...w, [uid]: false }));
  }

  async function handleBlacklist(uid, current) {
    setWorking((w) => ({ ...w, [`bl_${uid}`]: true }));
    await toggleLbBlacklist(uid, !current);
    await load();
    setWorking((w) => ({ ...w, [`bl_${uid}`]: false }));
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || u.uid.includes(q);
  });

  const totalCoins = users.reduce((s, u) => s + (u.betCoins ?? 0), 0);
  const blacklisted = users.filter((u) => u.lbBlacklisted).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-600/20 border border-red-500/30 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-slate-400 text-sm">Manage users, coins & leaderboard</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setWipeStep(1)}
            className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold transition-all"
          >
            <Trash2 className="w-4 h-4" /> Emergency Wipe
          </button>
        </div>
      </div>

      {wipeStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setWipeStep(0)} />
          <div className="relative bg-[#1a1d27] border border-red-500/40 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <h2 className="text-white font-bold text-lg">Emergency Wipe</h2>
            </div>
            {wipeStep === 1 && (
              <>
                <p className="text-slate-300 text-sm mb-6">This will permanently delete <strong className="text-red-400">all users, leagues, and bets</strong>. This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setWipeStep(0)} className="flex-1 py-2.5 border border-[#2a2d3a] text-slate-300 rounded-xl text-sm hover:border-slate-500 transition-all">Cancel</button>
                  <button onClick={() => setWipeStep(2)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all">Continue →</button>
                </div>
              </>
            )}
            {wipeStep === 2 && (
              <>
                <p className="text-red-400 text-sm font-semibold mb-2">Are you absolutely sure?</p>
                <p className="text-slate-400 text-xs mb-6">There is no recovery. Every account, league, and bet will be gone forever.</p>
                <div className="flex gap-2">
                  <button onClick={() => setWipeStep(0)} className="flex-1 py-2.5 border border-[#2a2d3a] text-slate-300 rounded-xl text-sm hover:border-slate-500 transition-all">Cancel</button>
                  <button onClick={handleWipe} disabled={wiping} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                    {wiping ? 'Wiping...' : '🗑 WIPE EVERYTHING'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
          <p className="text-slate-400 text-xs mb-1">Total Users</p>
          <p className="text-white text-2xl font-bold">{users.length}</p>
        </div>
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
          <p className="text-slate-400 text-xs mb-1">Coins in Circulation</p>
          <p className="text-yellow-400 text-2xl font-bold">{totalCoins.toLocaleString()}</p>
        </div>
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
          <p className="text-slate-400 text-xs mb-1">LB Blacklisted</p>
          <p className="text-red-400 text-2xl font-bold">{blacklisted}</p>
        </div>
      </div>

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl">
        <div className="p-5 border-b border-[#2a2d3a] flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or UID…"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading users…</div>
        ) : (
          <div className="divide-y divide-[#2a2d3a]">
            {filtered.map((u, i) => (
              <div key={u.uid} className={`flex items-center gap-4 px-5 py-4 ${u.lbBlacklisted ? 'opacity-50' : ''}`}>
                <span className="text-slate-600 text-xs w-5 text-center">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-300 text-xs font-bold flex-shrink-0">
                  {(u.displayName || u.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {u.displayName || 'Anonymous'}
                    {u.lbBlacklisted && <span className="ml-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">LB hidden</span>}
                  </p>
                  <p className="text-slate-500 text-xs truncate">{u.uid}</p>
                </div>

                <div className="flex items-center gap-1.5 mr-2">
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-sm w-16 text-right">{(u.betCoins ?? 0).toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="amount"
                    value={coinInputs[u.uid] ?? ''}
                    onChange={(e) => setCoinInputs((c) => ({ ...c, [u.uid]: e.target.value }))}
                    className="w-24 bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleAddCoins(u.uid)}
                    disabled={working[u.uid]}
                    title="Add/subtract coins"
                    className="px-2.5 py-1.5 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleSetCoins(u.uid)}
                    disabled={working[u.uid]}
                    title="Set coins to exact amount"
                    className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    Set
                  </button>
                  <button
                    onClick={() => handleBlacklist(u.uid, u.lbBlacklisted)}
                    disabled={working[`bl_${u.uid}`]}
                    title={u.lbBlacklisted ? 'Remove from blacklist' : 'Hide from leaderboard'}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border disabled:opacity-50 ${
                      u.lbBlacklisted
                        ? 'bg-slate-600/20 hover:bg-slate-600/40 border-slate-500/30 text-slate-300'
                        : 'bg-red-600/20 hover:bg-red-600/40 border-red-500/30 text-red-400'
                    }`}
                  >
                    {u.lbBlacklisted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
