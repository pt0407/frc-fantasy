const TBA_BASE = 'https://www.thebluealliance.com/api/v3';
const TBA_KEY = import.meta.env.VITE_TBA_KEY;

const headers = { 'X-TBA-Auth-Key': TBA_KEY };

async function tbaFetch(path) {
  const res = await fetch(`${TBA_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`TBA error: ${res.status} ${path}`);
  return res.json();
}

export async function getEvents(year = new Date().getFullYear()) {
  return tbaFetch(`/events/${year}/simple`);
}

export async function getEvent(eventKey) {
  return tbaFetch(`/event/${eventKey}/simple`);
}

export async function getEventTeams(eventKey) {
  return tbaFetch(`/event/${eventKey}/teams/simple`);
}

export async function getEventMatches(eventKey) {
  return tbaFetch(`/event/${eventKey}/matches`);
}

export async function getEventRankings(eventKey) {
  return tbaFetch(`/event/${eventKey}/rankings`);
}

export async function getEventAwards(eventKey) {
  return tbaFetch(`/event/${eventKey}/awards`);
}

export async function getTeam(teamKey) {
  return tbaFetch(`/team/${teamKey}/simple`);
}

export async function getUpcomingEvents(year = new Date().getFullYear()) {
  const events = await getEvents(year);
  const todayStr = new Date().toLocaleDateString('en-CA');
  return events
    .filter((e) => e.end_date >= todayStr)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

export async function getAllEvents(year = new Date().getFullYear()) {
  const events = await getEvents(year);
  const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local time
  return events
    .filter((e) => e.end_date >= todayStr)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

export function computeFantasyScore(teamKey, matches, awards = []) {
  let score = 0;

  for (const match of matches) {
    const redTeams = match.alliances?.red?.team_keys || [];
    const blueTeams = match.alliances?.blue?.team_keys || [];

    const inRed = redTeams.includes(teamKey);
    const inBlue = blueTeams.includes(teamKey);

    if (!inRed && !inBlue) continue;

    const alliance = inRed ? 'red' : 'blue';
    const myAlliance = match.alliances?.[alliance];
    const oppAlliance = match.alliances?.[alliance === 'red' ? 'blue' : 'red'];

    if (!myAlliance || !oppAlliance) continue;

    const myScore = myAlliance.score ?? -1;
    const oppScore = oppAlliance.score ?? -1;

    if (myScore < 0 || oppScore < 0) continue;

    score += Math.floor(myScore / 10);

    if (myScore > oppScore) score += 5;

    const scoreBreakdown = match.score_breakdown?.[alliance];
    if (scoreBreakdown) {
      score += (scoreBreakdown.rp || 0) * 3;

      const autoPoints = scoreBreakdown.autoPoints
        ?? scoreBreakdown.autoCoralPoints
        ?? scoreBreakdown.autoMobilityPoints
        ?? 0;
      if (autoPoints > 0) score += Math.floor(autoPoints / 5);
    }
  }

  for (const award of awards) {
    if (award.recipient_list?.some((r) => r.team_key === teamKey)) {
      const t = award.award_type;
      if (t === 0) score += 50;        // FIRST Impact (Chairman's)
      else if (t === 1) score += 40;   // Winner
      else if (t === 2) score += 25;   // Finalist
      else if (t === 9) score += 30;   // Engineering Inspiration
      else if (t === 10) score += 20;  // Rookie All-Star
      else if (t === 16) score += 15;  // Gracious Professionalism
      else score += 10;                // All other awards
    }
  }

  return score;
}
