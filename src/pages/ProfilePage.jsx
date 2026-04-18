import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, getUserLeagues, getUserBets, claimDailyCoins } from '../lib/firestore';
import { User, Coins, Trophy, Users, TrendingUp, TrendingDown, Clock, Gift, Star } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserProfile(user.uid),
      getUserLeagues(user.uid),
      getUserBets(user.uid).catch(() => []),
    ]).then(([p, l, b]) => {
      setProfile(p);
      setLeagues(l);
      setBets(b);
      setLoading(false);
    });
  }, [user]);

  async function handleClaim() {
    setClaiming(true);
    setClaimMsg('');
    try {
      await claimDailyCoins(user.uid);
      const updated = await getUserProfile(user.uid);
      setProfile(updated);
      setClaimMsg('+50 coins claimed!');
    } catch (e) {
      setClaimMsg(e.message);
    } finally {
      setClaiming(false);
    }
  }

  function canClaim() {
    if (!profile?.lastDailyClaim) return true;
    const last = profile.lastDailyClaim.toDate ? profile.lastDailyClaim.toDate() : new Date(profile.lastDailyClaim);
    return (new Date() - last) / (1000 * 60 * 60) >= 24;
  }

  function nextClaimIn() {
    if (!profile?.lastDailyClaim) return null;
    const last = profile.lastDailyClaim.toDate ? profile.lastDailyClaim.toDate() : new Date(profile.lastDailyClaim);
    const diffMs = (24 * 60 * 60 * 1000) - (new Date() - last);
    if (diffMs <= 0) return null;
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  }

  const wonBets = bets.filter((b) => b.result === 'win').length;
  const lostBets = bets.filter((b) => b.result === 'loss').length;
  const pendingBets = bets.filter((b) => b.status === 'pending').length;
  const totalWagered = bets.reduce((s, b) => s + (b.amount || 0), 0);
  const netCoins = bets.reduce((s, b) => {
    if (b.result === 'win') return s + b.amount;
    if (b.result === 'loss') return s - b.amount;
    return s;
  }, 0);

  const bestRank = leagues.reduce((best, league) => {
    const sorted = Object.entries(league.scores || {}).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([uid]) => uid === user?.uid) + 1;
    return rank > 0 && (best === null || rank < best) ? rank : best;
  }, null);

  const totalFantasyPts = leagues.reduce((sum, l) => sum + (l.scores?.[user?.uid] || 0), 0);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <div className="flex items-center gap-5">
          {user?.photoURL ? (
            <img src={user.photoURL} className="w-20 h-20 rounded-2xl object-cover" alt="" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
              {(user?.displayName || user?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{user?.displayName || 'Anonymous'}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{user?.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1.5 text-sm text-slate-400">
                <Users className="w-4 h-4" />
                {leagues.length} {leagues.length === 1 ? 'league' : 'leagues'}
              </span>
              {bestRank && (
                <span className="flex items-center gap-1.5 text-sm text-yellow-400">
                  <Star className="w-4 h-4" />
                  Best rank #{bestRank}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold text-lg">Bet Coins</h2>
          </div>
          <span className="text-yellow-400 text-3xl font-black">{profile?.betCoins?.toLocaleString() ?? 0}</span>
        </div>

        <div className="bg-[#0f1117] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-400" /> Daily Bonus
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              {canClaim() ? 'Claim your 50 free coins!' : `Next claim in ${nextClaimIn()}`}
            </p>
            {claimMsg && (
              <p className={`text-xs mt-1 font-medium ${claimMsg.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                {claimMsg}
              </p>
            )}
          </div>
          <button
            onClick={handleClaim}
            disabled={claiming || !canClaim()}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              canClaim()
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-[#2a2d3a] text-slate-500 cursor-not-allowed'
            } disabled:opacity-60`}
          >
            <Gift className="w-4 h-4" />
            {claiming ? 'Claiming...' : canClaim() ? 'Claim +50' : 'Claimed'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fantasy Points', value: totalFantasyPts, icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Bets Won', value: wonBets, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Bets Lost', value: lostBets, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Pending Bets', value: pendingBets, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-4 flex flex-col items-center text-center gap-2">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-white text-xl font-bold">{value}</p>
            <p className="text-slate-500 text-xs">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" /> League Stats
        </h2>
        {leagues.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No leagues joined yet.</p>
        ) : (
          <div className="space-y-3">
            {leagues.map((league) => {
              const myScore = league.scores?.[user?.uid] || 0;
              const sorted = Object.entries(league.scores || {}).sort((a, b) => b[1] - a[1]);
              const rank = sorted.findIndex(([uid]) => uid === user?.uid) + 1;
              const myRoster = league.rosters?.[user?.uid] || [];
              return (
                <div key={league.id} className="bg-[#0f1117] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white font-medium text-sm">{league.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-xs">#{rank} of {sorted.length}</span>
                      <span className="text-yellow-400 font-bold text-sm">{myScore} pts</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{league.eventName || 'No event'}</span>
                    <span>{myRoster.length}/{league.rosterSize} teams drafted</span>
                    <span>{league.members.length} members</span>
                  </div>
                  {myRoster.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {myRoster.map((k) => (
                        <span key={k} className="text-xs bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                          {k.replace('frc', 'Team ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <h2 className="text-white font-semibold text-lg mb-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" /> Betting Summary
        </h2>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-[#0f1117] rounded-xl p-4 text-center">
            <p className="text-slate-400 text-xs mb-1">Total Wagered</p>
            <p className="text-white font-bold text-xl">{totalWagered}</p>
            <p className="text-slate-500 text-xs">coins</p>
          </div>
          <div className="bg-[#0f1117] rounded-xl p-4 text-center">
            <p className="text-slate-400 text-xs mb-1">Net P&L</p>
            <p className={`font-bold text-xl ${netCoins >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {netCoins >= 0 ? '+' : ''}{netCoins}
            </p>
            <p className="text-slate-500 text-xs">coins</p>
          </div>
        </div>
        {wonBets + lostBets > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Win rate</span>
              <span>{Math.round((wonBets / (wonBets + lostBets)) * 100)}%</span>
            </div>
            <div className="w-full bg-[#0f1117] rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${(wonBets / (wonBets + lostBets)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
