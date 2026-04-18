import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserLeagues, getUserProfile } from '../lib/firestore';
import { getUpcomingEvents } from '../lib/tba';
import { Users, Trophy, Coins, Calendar, ChevronRight, Plus } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then(setProfile);
    getUserLeagues(user.uid).then((l) => {
      setLeagues(l);
      setLoadingLeagues(false);
    });
    getUpcomingEvents().then((e) => {
      setEvents(e.slice(0, 5));
      setLoadingEvents(false);
    }).catch(() => setLoadingEvents(false));
  }, [user]);

  const stats = [
    { label: 'My Leagues', value: leagues.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Best Rank', value: '#—', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Bet Coins', value: profile?.betCoins?.toLocaleString() ?? '—', icon: Coins, color: 'text-green-400', bg: 'bg-green-500/10' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.displayName?.split(' ')[0] || 'Manager'} 👋
        </h1>
        <p className="text-slate-400 mt-1">Here's your FRC Fantasy overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
              <p className="text-slate-400 text-sm">{label}</p>
              <p className="text-white text-2xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">My Leagues</h2>
            <Link to="/leagues/create" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium">
              <Plus className="w-4 h-4" /> New
            </Link>
          </div>

          {loadingLeagues ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-16 bg-[#0f1117] rounded-xl animate-pulse" />)}
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No leagues yet.</p>
              <Link to="/leagues" className="text-blue-400 hover:text-blue-300 text-sm mt-1 inline-block">Browse or create one</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {leagues.map((league) => (
                <Link
                  key={league.id}
                  to={`/leagues/${league.id}`}
                  className="flex items-center justify-between p-4 bg-[#0f1117] hover:bg-[#13161f] rounded-xl transition-colors group"
                >
                  <div>
                    <p className="text-white font-medium text-sm">{league.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{league.members.length} members · {league.eventName || 'No event set'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 font-bold text-sm">{league.scores?.[user.uid] ?? 0} pts</span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">Upcoming Events</h2>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>

          {loadingEvents ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-[#0f1117] rounded-xl animate-pulse" />)}
            </div>
          ) : events.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No upcoming events found.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <Link
                  key={event.key}
                  to={`/events/${event.key}`}
                  className="flex items-center justify-between p-3 bg-[#0f1117] hover:bg-[#13161f] rounded-xl transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{event.name}</p>
                    <p className="text-slate-500 text-xs">{event.start_date} → {event.end_date}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 ml-2 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
