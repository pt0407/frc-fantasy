import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, placeBet, getUserBets, resolvePendingBets } from '../lib/firestore';
import { getUpcomingEvents, getEventMatches } from '../lib/tba';
import { Coins, TrendingUp, Clock, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';

function BetModal({ match, onClose, onBet, coins }) {
  const [alliance, setAlliance] = useState('red');
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await onBet(match, alliance, amount);
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-1">Place Bet</h2>
        <p className="text-slate-400 text-sm mb-5">{matchLabel(match)}</p>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setAlliance('red')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${alliance === 'red' ? 'bg-red-600 text-white' : 'bg-[#0f1117] border border-[#2a2d3a] text-slate-400 hover:text-white'}`}
          >
            🔴 Red Alliance
          </button>
          <button
            onClick={() => setAlliance('blue')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${alliance === 'blue' ? 'bg-blue-600 text-white' : 'bg-[#0f1117] border border-[#2a2d3a] text-slate-400 hover:text-white'}`}
          >
            🔵 Blue Alliance
          </button>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-2">Bet Amount (you have {coins} coins)</label>
          <input
            type="number"
            min={10}
            max={coins}
            step={10}
            value={amount}
            onChange={(e) => setAmount(Math.min(Number(e.target.value), coins))}
            className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2 mt-2">
            {[25, 50, 100, 200].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(Math.min(v, coins))}
                className="flex-1 py-1.5 text-xs bg-[#0f1117] border border-[#2a2d3a] text-slate-400 hover:text-white rounded-lg transition-all"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <p className="text-slate-400 text-xs mb-4">Win: +{amount} coins · Lose: -{amount} coins</p>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#2a2d3a] text-slate-300 rounded-xl text-sm hover:border-slate-500 transition-all">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || amount < 10}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          >
            {loading ? 'Placing...' : 'Confirm Bet'}
          </button>
        </div>
      </div>
    </div>
  );
}

const DE_BRACKET = {
  1: 'Upper Bracket — Round 1, Match 1',
  2: 'Upper Bracket — Round 1, Match 2',
  3: 'Upper Bracket — Round 1, Match 3',
  4: 'Upper Bracket — Round 1, Match 4',
  5: 'Lower Bracket — Round 1, Match 1',
  6: 'Lower Bracket — Round 1, Match 2',
  7: 'Upper Bracket — Round 2, Match 1',
  8: 'Upper Bracket — Round 2, Match 2',
  9: 'Lower Bracket — Round 2, Match 1',
  10: 'Lower Bracket — Round 2, Match 2',
  11: 'Upper Bracket Final',
  12: 'Lower Bracket — Round 3',
  13: 'Bracket Final',
};

function matchLabel(match) {
  const { comp_level: cl, set_number: s, match_number: m } = match;
  if (cl === 'qm') return `Qualification ${m}`;
  if (cl === 'ef') return `Octofinal ${s}, Match ${m}`;
  if (cl === 'qf') return `Quarterfinal ${s}, Match ${m}`;
  if (cl === 'sf') {
    const bracket = DE_BRACKET[s];
    if (bracket) return m > 1 ? `${bracket} (Rematch ${m})` : bracket;
    return `Semifinal ${s}, Match ${m}`;
  }
  if (cl === 'f') return `Finals — Match ${m}`;
  return `${cl?.toUpperCase()} Match ${m}`;
}

export default function BettingPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [matches, setMatches] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [betModal, setBetModal] = useState(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [tab, setTab] = useState('matches');
  const [resolving, setResolving] = useState(false);

  async function refreshBets() {
    const [p, b] = await Promise.all([
      getUserProfile(user.uid),
      getUserBets(user.uid).catch(() => []),
    ]);
    setProfile(p);
    setMyBets(b);
  }

  async function handleResolve() {
    setResolving(true);
    try {
      await resolvePendingBets(user.uid);
      await refreshBets();
    } catch (e) { console.error(e); }
    finally { setResolving(false); }
  }

  useEffect(() => {
    if (!user) return;
    refreshBets();
    resolvePendingBets(user.uid).then(() => refreshBets()).catch(() => {});
    getUpcomingEvents().then((e) => {
      setEvents(e);
      if (e.length > 0) setSelectedEvent(e[0].key);
    }).catch(() => {});
    const interval = setInterval(() => {
      resolvePendingBets(user.uid).then(() => refreshBets()).catch(() => {});
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoadingMatches(true);
    getEventMatches(selectedEvent)
      .then((m) => {
        const upcoming = m.filter((match) => !match.actual_time || match.alliances?.red?.score === -1);
        setMatches(upcoming.sort((a, b) => (a.predicted_time || 0) - (b.predicted_time || 0)).slice(0, 30));
        setLoadingMatches(false);
      })
      .catch(() => setLoadingMatches(false));
  }, [selectedEvent]);

  const selectedEventName = events.find((e) => e.key === selectedEvent)?.name || selectedEvent;

  async function handleBet(match, alliance, amount) {
    const desc = `${matchLabel(match)} — ${alliance === 'red' ? 'Red' : 'Blue'} Alliance`;
    await placeBet(user.uid, match.key, alliance, amount, desc, selectedEventName);
    await refreshBets();
  }

  const alreadyBet = new Set(myBets.map((b) => b.matchKey));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Match Betting</h1>
          <p className="text-slate-400 text-sm mt-1">Bet coins on match outcomes. No real money.</p>
        </div>
        <div className="flex items-center gap-2 bg-[#1a1d27] border border-[#2a2d3a] rounded-xl px-4 py-2.5">
          <Coins className="w-4 h-4 text-yellow-400" />
          <span className="text-white font-bold">{profile?.betCoins?.toLocaleString() ?? '—'}</span>
          <span className="text-slate-400 text-sm">coins</span>
        </div>
      </div>

      <div className="flex bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-1">
        <button
          onClick={() => setTab('matches')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'matches' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Available Matches
        </button>
        <button
          onClick={() => setTab('mybets')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'mybets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          My Bets ({myBets.length})
        </button>
      </div>

      {tab === 'matches' && (
        <>
          <div className="relative">
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full appearance-none bg-[#1a1d27] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 pr-10"
            >
              {events.map((ev) => (
                <option key={ev.key} value={ev.key}>{ev.name} ({ev.start_date})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {loadingMatches ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl animate-pulse" />)}
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-12 text-center">
              <p className="text-slate-400">No upcoming matches found for this event.</p>
              <p className="text-slate-500 text-sm mt-1">Matches may not be scheduled yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => {
                const red = match.alliances?.red?.team_keys || [];
                const blue = match.alliances?.blue?.team_keys || [];
                const hasBet = alreadyBet.has(match.key);
                return (
                  <div key={match.key} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-400 text-sm font-medium">
                        {matchLabel(match)}
                      </span>
                      {hasBet && (
                        <span className="text-xs bg-green-600/20 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Bet placed</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-red-950/30 border border-red-900/30 rounded-xl p-3">
                        <p className="text-red-400 text-xs font-semibold mb-1">RED ALLIANCE</p>
                        <div className="space-y-0.5">
                          {red.map((k) => <p key={k} className="text-white text-sm">{k.replace('frc', 'Team ')}</p>)}
                        </div>
                      </div>
                      <div className="bg-blue-950/30 border border-blue-900/30 rounded-xl p-3">
                        <p className="text-blue-400 text-xs font-semibold mb-1">BLUE ALLIANCE</p>
                        <div className="space-y-0.5">
                          {blue.map((k) => <p key={k} className="text-white text-sm">{k.replace('frc', 'Team ')}</p>)}
                        </div>
                      </div>
                    </div>
                    {!hasBet ? (
                      <button
                        onClick={() => setBetModal(match)}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        <TrendingUp className="w-4 h-4" /> Place Bet
                      </button>
                    ) : (
                      <div className="w-full py-2.5 bg-green-600/10 border border-green-500/20 text-green-400 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Bet Placed
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'mybets' && (
        <div className="space-y-3">
          {myBets.some((b) => b.status === 'pending') && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="w-full py-2.5 bg-[#1a1d27] border border-[#2a2d3a] hover:border-blue-500/40 text-slate-300 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Clock className="w-4 h-4" />
              {resolving ? 'Checking results...' : 'Check & Resolve Pending Bets'}
            </button>
          )}
          {myBets.length === 0 ? (
            <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-12 text-center">
              <Coins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No bets placed yet.</p>
            </div>
          ) : (
            myBets.map((bet) => (
              <div key={bet.id} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{bet.matchDescription}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{bet.eventName || bet.matchKey?.split('_')[0]}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {bet.amount} coins on <span className={bet.alliance === 'red' ? 'text-red-400' : 'text-blue-400'}>{bet.alliance === 'red' ? 'Red' : 'Blue'} Alliance</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {bet.status === 'pending' && (
                    <span className="flex items-center gap-1 text-yellow-400 text-sm">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  )}
                  {bet.result === 'win' && (
                    <span className="flex items-center gap-1 text-green-400 text-sm font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> +{bet.amount}
                    </span>
                  )}
                  {bet.result === 'loss' && (
                    <span className="flex items-center gap-1 text-red-400 text-sm font-bold">
                      <XCircle className="w-3.5 h-3.5" /> -{bet.amount}
                    </span>
                  )}
                  {bet.result === 'tie' && (
                    <span className="flex items-center gap-1 text-slate-400 text-sm font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tie (refunded)
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {betModal && (
        <BetModal
          match={betModal}
          coins={profile?.betCoins ?? 0}
          onClose={() => setBetModal(null)}
          onBet={handleBet}
        />
      )}
    </div>
  );
}
