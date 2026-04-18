import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeague, makeDraftPick } from '../lib/firestore';
import { getEventTeams } from '../lib/tba';
import { Search, Zap, Clock, CheckCircle2 } from 'lucide-react';

function getSnakePicker(draftOrder, pickNum) {
  if (!draftOrder.length) return null;
  const round = Math.floor(pickNum / draftOrder.length);
  const idxInRound = pickNum % draftOrder.length;
  const snakeIdx = round % 2 === 0 ? idxInRound : draftOrder.length - 1 - idxInRound;
  return draftOrder[snakeIdx];
}

export default function DraftPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [history, setHistory] = useState([]);

  const fetchLeague = useCallback(async () => {
    const l = await getLeague(id);
    setLeague(l);
  }, [id]);

  useEffect(() => {
    async function init() {
      const l = await getLeague(id);
      setLeague(l);
      setLoading(false);
      if (l?.eventKey) {
        const t = await getEventTeams(l.eventKey);
        setTeams(t.sort((a, b) => a.team_number - b.team_number));
      }
    }
    init();
    const interval = setInterval(fetchLeague, 3000);
    return () => clearInterval(interval);
  }, [id, fetchLeague]);

  async function handlePick(team) {
    if (!league || picking) return;
    setPicking(true);
    try {
      await makeDraftPick(id, user.uid, `frc${team.team_number}`, team.nickname || `Team ${team.team_number}`);
      await fetchLeague();
    } catch (e) {
      alert(e.message);
    } finally {
      setPicking(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-64 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!league) return <div className="text-center text-slate-400 py-20">League not found.</div>;
  if (!league.draftStarted) return <div className="text-center text-slate-400 py-20">Draft has not started yet.</div>;

  const allPicked = Object.values(league.rosters || {}).flat();
  const currentPicker = getSnakePicker(league.draftOrder, league.draftPick);
  const isMyTurn = currentPicker === user?.uid;
  const totalPicks = league.rosterSize * league.draftOrder.length;
  const progress = Math.min(league.draftPick / totalPicks, 1);
  const currentRound = Math.floor(league.draftPick / league.draftOrder.length) + 1;

  const filteredTeams = teams.filter((t) => {
    const key = `frc${t.team_number}`;
    if (allPicked.includes(key)) return false;
    if (!search) return true;
    return (
      String(t.team_number).includes(search) ||
      (t.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.city || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const myRoster = league.rosters?.[user?.uid] || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{league.name} — Snake Draft</h1>
            {league.draftComplete ? (
              <p className="text-green-400 text-sm mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Draft complete!
              </p>
            ) : (
              <p className="text-slate-400 text-sm mt-1">
                Round {currentRound} of {league.rosterSize} · Pick #{league.draftPick + 1} of {totalPicks}
              </p>
            )}
          </div>
          {!league.draftComplete && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${isMyTurn ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-[#0f1117] text-slate-400 border border-[#2a2d3a]'}`}>
              {isMyTurn ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {isMyTurn ? "It's your pick!" : `Waiting for ${league.memberNames?.[currentPicker] || '...'}`}
            </div>
          )}
        </div>
        <div className="w-full bg-[#0f1117] rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teams by number, name, or city..."
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {league.eventKey ? (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredTeams.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">
                  {teams.length === 0 ? 'No teams found for this event.' : 'All teams drafted or no matches.'}
                </p>
              ) : (
                filteredTeams.map((team) => {
                  const key = `frc${team.team_number}`;
                  return (
                    <button
                      key={key}
                      onClick={() => handlePick(team)}
                      disabled={!isMyTurn || picking || league.draftComplete}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                        isMyTurn && !league.draftComplete
                          ? 'bg-[#0f1117] hover:bg-blue-600/10 hover:border-blue-500/30 border border-transparent cursor-pointer'
                          : 'bg-[#0f1117] border border-transparent cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-400 text-xs font-bold">{team.team_number}</span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{team.nickname || `Team ${team.team_number}`}</p>
                          <p className="text-slate-500 text-xs">{team.school_name || ''}{team.city ? ` · ${team.city}, ${team.state_prov}` : ''}</p>
                        </div>
                      </div>
                      {isMyTurn && !league.draftComplete && (
                        <span className="text-blue-400 text-xs font-medium px-2 py-1 bg-blue-600/10 rounded-lg border border-blue-500/20">Pick</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">This league has no event linked.</p>
              <p className="text-slate-500 text-xs mt-1">Ask the league owner to link an event to enable team drafting.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-3">Draft Order</h2>
            <div className="space-y-1">
              {league.draftOrder.map((uid, idx) => {
                const isActive = uid === currentPicker && !league.draftComplete;
                return (
                  <div key={uid} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400'}`}>
                    <span className="w-5 text-xs text-slate-600">{idx + 1}</span>
                    <span className="flex-1 truncate">{league.memberNames?.[uid] || uid}{uid === user?.uid ? ' (you)' : ''}</span>
                    <span className="text-xs text-slate-600">{(league.rosters?.[uid] || []).length}/{league.rosterSize}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-3">My Roster ({myRoster.length}/{league.rosterSize})</h2>
            {myRoster.length === 0 ? (
              <p className="text-slate-500 text-sm">No picks yet.</p>
            ) : (
              <div className="space-y-1">
                {myRoster.map((key) => (
                  <div key={key} className="flex items-center gap-2 px-3 py-2 bg-[#0f1117] rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-white text-sm">{key.replace('frc', 'Team ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
