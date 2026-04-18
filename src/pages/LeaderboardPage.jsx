import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserLeagues } from '../lib/firestore';
import { Trophy, Medal, ChevronDown } from 'lucide-react';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserLeagues(user.uid).then((l) => {
      setLeagues(l);
      if (l.length > 0) setSelected(l[0].id);
      setLoading(false);
    });
  }, [user]);

  const league = leagues.find((l) => l.id === selected);

  const sorted = league
    ? Object.entries(league.scores || {})
        .map(([uid, score]) => ({ uid, score, name: league.memberNames?.[uid] || uid, roster: league.rosters?.[uid] || [] }))
        .sort((a, b) => b.score - a.score)
    : [];

  const rankStyle = (idx) => {
    if (idx === 0) return 'bg-yellow-500 text-black';
    if (idx === 1) return 'bg-slate-400 text-black';
    if (idx === 2) return 'bg-orange-600 text-white';
    return 'bg-[#2a2d3a] text-slate-400';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-slate-400 text-sm mt-1">Rankings across your leagues</p>
      </div>

      {leagues.length > 1 && (
        <div className="relative">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full appearance-none bg-[#1a1d27] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 pr-10"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl animate-pulse" />)}
        </div>
      ) : !league ? (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-12 text-center">
          <Trophy className="w-14 h-14 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Join or create a league to see rankings.</p>
        </div>
      ) : (
        <>
          {sorted[0] && (
            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-8 h-8 text-black" />
              </div>
              <p className="text-yellow-400 text-xs font-semibold tracking-wider mb-1">LEADING</p>
              <p className="text-white text-2xl font-bold">{sorted[0].name}</p>
              <p className="text-yellow-400 text-3xl font-black mt-1">{sorted[0].score} pts</p>
              <p className="text-slate-500 text-sm mt-1">{sorted[0].roster.length} teams drafted</p>
            </div>
          )}

          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 px-5 py-3 border-b border-[#2a2d3a] text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-6">Manager</div>
              <div className="col-span-3 text-center">Teams</div>
              <div className="col-span-2 text-right">Points</div>
            </div>
            {sorted.map(({ uid, score, name, roster }, idx) => (
              <div
                key={uid}
                className={`grid grid-cols-12 items-center px-5 py-4 border-b border-[#2a2d3a] last:border-0 transition-colors ${uid === user?.uid ? 'bg-blue-600/5' : 'hover:bg-white/2'}`}
              >
                <div className="col-span-1">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${rankStyle(idx)}`}>
                    {idx + 1}
                  </span>
                </div>
                <div className="col-span-6 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
                    {name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{name}{uid === user?.uid ? ' (you)' : ''}</p>
                    {uid === league.ownerUid && <p className="text-slate-500 text-xs">Owner</p>}
                  </div>
                </div>
                <div className="col-span-3 text-center text-slate-400 text-sm">{roster.length}</div>
                <div className="col-span-2 text-right">
                  <span className="text-yellow-400 font-bold">{score}</span>
                  <span className="text-slate-500 text-xs ml-1">pts</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
