import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeague, makeDraftPick, nominateTeam, submitAuctionBid, revealAuctionBids, clearAuctionNomination } from '../lib/firestore';
import { getEventTeams } from '../lib/tba';
import { Search, Zap, Clock, CheckCircle2, Gavel, Eye, EyeOff, X } from 'lucide-react';

function getCurrentPicker(league) {
  if (!league?.draftOrder?.length) return null;
  const { draftOrder, draftPick } = league;
  const draftType = league.draftType || 'snake';
  const n = draftOrder.length;
  const idxInRound = draftPick % n;
  const round = Math.floor(draftPick / n);
  const idx = (draftType === 'snake' && round % 2 !== 0) ? (n - 1 - idxInRound) : idxInRound;
  return draftOrder[idx];
}

export default function DraftPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [bidAmount, setBidAmount] = useState(0);
  const [nominating, setNominating] = useState(false);
  const [bidSubmitted, setBidSubmitted] = useState(false);
  const [revealing, setRevealing] = useState(false);

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
      setSelectedTeam(null);
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

  const draftType = league.draftType || 'snake';
  const allPicked = Object.values(league.rosters || {}).flat();
  const myRoster = league.rosters?.[user?.uid] || [];
  const myBudget = league.auctionBudgets?.[user?.uid] ?? league.auctionBudget ?? 200;

  const currentPicker = draftType === 'free_pick' || draftType === 'auction' ? null : getCurrentPicker(league);
  const isMyTurn = draftType === 'free_pick'
    ? myRoster.length < league.rosterSize
    : draftType === 'auction'
    ? !league.auctionNomination
    : currentPicker === user?.uid;

  const totalPicks = league.rosterSize * (draftType === 'free_pick' ? league.members.length : (league.draftOrder?.length || league.members.length));
  const pickedSoFar = allPicked.length;
  const progress = Math.min(pickedSoFar / totalPicks, 1);
  const currentRound = league.draftOrder?.length
    ? Math.floor((league.draftPick || 0) / league.draftOrder.length) + 1
    : 1;

  const nom = league.auctionNomination;
  const myBid = nom?.bids?.[user?.uid];
  const allBidsIn = nom ? Object.values(nom.bids || {}).every((b) => b !== null) : false;

  const visibleRosters = league.draftVisibility === 'hidden' && !league.draftComplete
    ? { [user?.uid]: myRoster }
    : league.rosters || {};

  const uniqueTeams = league.uniqueTeams !== false;
  const filteredTeams = teams.filter((t) => {
    const key = `frc${t.team_number}`;
    if (uniqueTeams && allPicked.includes(key)) return false;
    if (!uniqueTeams && myRoster.includes(key)) return false;
    if (!search) return true;
    return (
      String(t.team_number).includes(search) ||
      (t.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.city || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const draftTypeLabel = { snake: 'Snake Draft', linear: 'Linear Draft', free_pick: 'Free Pick', auction: 'Auction' }[draftType] || 'Draft';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{league.name} — {draftTypeLabel}</h1>
            {league.draftComplete ? (
              <p className="text-green-400 text-sm mt-1 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Draft complete!</p>
            ) : draftType === 'free_pick' ? (
              <p className="text-slate-400 text-sm mt-1">{pickedSoFar}/{totalPicks} picks made · Pick any team to fill your roster ({myRoster.length}/{league.rosterSize})</p>
            ) : draftType === 'auction' ? (
              <p className="text-slate-400 text-sm mt-1">Budget: <span className="text-yellow-400 font-bold">{myBudget}</span> coins · {pickedSoFar}/{totalPicks} teams claimed</p>
            ) : (
              <p className="text-slate-400 text-sm mt-1">Round {currentRound} of {league.rosterSize} · Pick #{(league.draftPick || 0) + 1} of {totalPicks}</p>
            )}
            {league.draftVisibility === 'hidden' && !league.draftComplete && (
              <p className="text-slate-500 text-xs mt-1 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Picks hidden until draft ends</p>
            )}
          </div>
          {!league.draftComplete && draftType !== 'free_pick' && draftType !== 'auction' && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${isMyTurn ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-[#0f1117] text-slate-400 border border-[#2a2d3a]'}`}>
              {isMyTurn ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {isMyTurn ? "It's your pick!" : `Waiting for ${league.memberNames?.[currentPicker] || '...'}`}
            </div>
          )}
          {!league.draftComplete && draftType === 'free_pick' && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${isMyTurn ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-[#0f1117] text-slate-400 border border-[#2a2d3a]'}`}>
              {isMyTurn ? <Zap className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {isMyTurn ? 'Pick your teams!' : 'Roster full!'}
            </div>
          )}
        </div>
        <div className="w-full bg-[#0f1117] rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {draftType === 'auction' && nom && (
        <div className="bg-[#1a1d27] border border-yellow-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gavel className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">On the Block: <span className="text-yellow-400">{nom.teamName || nom.teamKey}</span></h2>
            <span className="text-slate-500 text-xs">Nominated by {league.memberNames?.[nom.nominatedBy] || '?'}</span>
          </div>
          {!nom.revealed ? (
            myBid === null ? (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1.5">Your sealed bid (budget: {myBudget} coins)</label>
                  <input type="number" min={0} max={myBudget} value={bidAmount} onChange={(e) => setBidAmount(Math.min(Number(e.target.value), myBudget))}
                    className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <button onClick={async () => { try { await submitAuctionBid(id, user.uid, bidAmount); setBidSubmitted(true); await fetchLeague(); } catch(e) { alert(e.message); } }}
                  className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-xl text-sm transition-all">
                  Submit Bid
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Bid submitted — waiting for others ({Object.values(nom.bids||{}).filter(b=>b!==null).length}/{Object.keys(nom.bids||{}).length})</p>
                {league.ownerUid === user?.uid && allBidsIn && (
                  <button onClick={async () => { setRevealing(true); try { await revealAuctionBids(id); await fetchLeague(); } catch(e){alert(e.message);} finally{setRevealing(false);} }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all">
                    <Eye className="w-4 h-4" /> Reveal Bids
                  </button>
                )}
              </div>
            )
          ) : (
            <div>
              <p className="text-white font-semibold mb-3">Winner: <span className="text-yellow-400">{league.memberNames?.[nom.winner] || 'No winner'}</span> with {nom.topBid} coins</p>
              <div className="space-y-1 mb-4">
                {Object.entries(nom.bids||{}).sort((a,b)=>b[1]-a[1]).map(([uid,bid])=>(
                  <div key={uid} className={`flex items-center justify-between px-3 py-2 rounded-lg ${uid===nom.winner?'bg-yellow-500/10 border border-yellow-500/20':'bg-[#0f1117]'}`}>
                    <span className="text-white text-sm">{league.memberNames?.[uid]||uid}</span>
                    <span className={`font-bold text-sm ${uid===nom.winner?'text-yellow-400':'text-slate-400'}`}>{bid} coins</span>
                  </div>
                ))}
              </div>
              {league.ownerUid === user?.uid && (
                <button onClick={async()=>{try{await clearAuctionNomination(id);await fetchLeague();}catch(e){alert(e.message);}}}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all">
                  Nominate Next Team
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teams by number, name, or city..."
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {league.eventKey ? (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredTeams.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">{teams.length === 0 ? 'No teams found for this event.' : 'All teams drafted or no matches.'}</p>
              ) : (
                filteredTeams.map((team) => {
                  const key = `frc${team.team_number}`;
                  const canAct = draftType === 'free_pick'
                    ? myRoster.length < league.rosterSize
                    : !league.draftComplete && (
                        draftType === 'auction' ? !nom : isMyTurn
                      );
                  const isSelected = selectedTeam?.team_number === team.team_number;
                  return (
                    <button key={key}
                      onClick={() => {
                        if (!canAct || picking) return;
                        if (draftType === 'auction') {
                          nominateTeam(id, user.uid, key, team.nickname||`Team ${team.team_number}`).then(fetchLeague).catch(e=>alert(e.message));
                        } else {
                          setSelectedTeam(isSelected ? null : team);
                        }
                      }}
                      disabled={(!canAct && !isSelected) || picking}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all border ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/50 ring-1 ring-blue-500/30'
                          : canAct
                          ? 'bg-[#0f1117] hover:bg-blue-600/10 hover:border-blue-500/30 border-transparent cursor-pointer'
                          : 'bg-[#0f1117] border-transparent cursor-not-allowed opacity-50'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600/40' : 'bg-blue-600/20'}`}>
                          <span className="text-blue-400 text-xs font-bold">{team.team_number}</span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{team.nickname || `Team ${team.team_number}`}</p>
                          <p className="text-slate-500 text-xs">{team.city ? `${team.city}, ${team.state_prov}` : ''}</p>
                        </div>
                      </div>
                      {isSelected && <span className="text-blue-300 text-xs font-semibold">Selected</span>}
                      {!isSelected && canAct && <span className="text-slate-500 text-xs">Click to select</span>}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No event linked — ask the owner to link an event.</p>
            </div>
          )}

          {selectedTeam && (
            <div className="mt-4 flex items-center justify-between bg-blue-600/10 border border-blue-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-300 text-xs font-bold">{selectedTeam.team_number}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{selectedTeam.nickname || `Team ${selectedTeam.team_number}`}</p>
                  <p className="text-slate-400 text-xs">{selectedTeam.city ? `${selectedTeam.city}, ${selectedTeam.state_prov}` : 'Selected'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="p-2 rounded-lg bg-[#0f1117] border border-[#2a2d3a] hover:border-red-500/40 text-slate-400 hover:text-red-400 transition-all"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePick(selectedTeam)}
                  disabled={picking}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                >
                  <Zap className="w-4 h-4" />
                  {picking ? 'Picking...' : 'Finalize Pick'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {(draftType === 'snake' || draftType === 'linear') && (
          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-3">Draft Order</h2>
            <div className="space-y-1">
              {(league.draftOrder||[]).map((uid, idx) => {
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
          )}

          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">
                {league.draftVisibility === 'hidden' && !league.draftComplete ? 'My Roster' : 'All Rosters'}
              </h2>
              {league.draftVisibility === 'hidden' && !league.draftComplete && <EyeOff className="w-4 h-4 text-slate-500" />}
            </div>
            <div className="space-y-3">
              {Object.entries(visibleRosters).map(([uid, roster]) => (
                <div key={uid}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-400 text-xs font-medium truncate">{league.memberNames?.[uid] || uid}{uid===user?.uid?' (you)':''}</p>
                    <div className="flex items-center gap-2">
                      {draftType === 'auction' && <span className="text-yellow-400 text-xs">{league.auctionBudgets?.[uid]??0}¢</span>}
                      <span className="text-slate-600 text-xs">{(roster||[]).length}/{league.rosterSize}</span>
                    </div>
                  </div>
                  {(roster||[]).length === 0 ? <p className="text-slate-600 text-xs">No picks yet</p> : (
                    <div className="space-y-0.5">
                      {(roster||[]).map((key) => (
                        <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-[#0f1117] rounded-lg">
                          <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                          <span className="text-white text-xs">{key.replace('frc','Team ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
