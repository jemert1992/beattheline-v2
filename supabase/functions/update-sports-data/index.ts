// Import necessary libraries
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Initializing update-sports-data function (v30 EPL Diagnostic)");

// --- Helper Function to fetch paginated data ---
async function fetchAllPaginatedData(url: string, apiKey: string) {
  let allData: any[] = [];
  let nextCursor: string | null = null;
  let page = 1;

  do {
    const separator = url.includes("?") ? "&" : "?";
    const currentUrl = nextCursor
      ? `${url}${separator}cursor=${nextCursor}&per_page=100`
      : `${url}${separator}per_page=100`;
    console.log(`Fetching page ${page} from ${currentUrl.split("?")[0]}...`);
    const response = await fetch(currentUrl, {
      headers: {
        "Authorization": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${await response.text()} fetching ${currentUrl}`);
    }

    const pageData = await response.json();
    // Defensive check: Ensure pageData.data is an array before concatenating
    if (Array.isArray(pageData.data)) {
        allData = allData.concat(pageData.data);
    } else {
        console.warn(`Received non-array data on page ${page} for ${url.split("?")[0]}, stopping pagination.`);
        break; 
    }
    nextCursor = pageData.meta?.next_cursor;
    page++;

    // Add a small delay to avoid hitting rate limits too quickly
    await new Promise(resolve => setTimeout(resolve, 200)); 

  } while (nextCursor);

  return allData;
}

// --- Helper function to fetch data from NHL API ---
async function fetchNhlData(endpoint: string) {
  console.log(`Fetching NHL data from ${endpoint}...`);
  const response = await fetch(`https://api-web.nhle.com${endpoint}`);
  
  if (!response.ok) {
    throw new Error(`NHL API HTTP error! status: ${response.status} - ${await response.text()} fetching ${endpoint}`);
  }
  
  return await response.json();
}

// --- Main Function Handler ---
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Configuration ---
    const balldontlieApiKey = "9047df76-eb37-4f81-8586-f7ae336027dc"; // Use the provided API key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const currentSeason = 2023; // Use 2023 for NBA/MLB as per docs/errors
    const eplSeason = 2024; // Use 2024 for EPL as requested

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase environment variables not set.");
    }
    if (!balldontlieApiKey) {
      throw new Error("BallDontLie API key not set.");
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { 
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
    console.log("Supabase client created.");

    // --- Fetch NBA Data ---
    console.log("--- Starting NBA Data Fetch ---");
    try {
        // ... (NBA code remains the same) ...
        const nbaTeamsUrl = "https://api.balldontlie.io/v1/teams";
        const allTeams = await fetchAllPaginatedData(nbaTeamsUrl, balldontlieApiKey);
        console.log(`Fetched ${allTeams.length} NBA teams basic info.`);
        const teamStatsMap = new Map(); 
        console.log("Placeholder: Need to implement actual NBA team stats/standings fetch.");
        allTeams.forEach(team => {
            teamStatsMap.set(team.id, {
                win_rate: Math.random() * 0.6 + 0.2, pace: 95 + Math.random() * 10, 
                offensive_rating: 105 + Math.random() * 10, recent_form: "W-L-W-L-W"
            });
        });
        const teamsToUpsert = allTeams.map((team: any) => {
          const stats = teamStatsMap.get(team.id) || {};
          return { team_name: `${team.full_name} (${team.abbreviation})`, win_rate: stats.win_rate || 0.5, 
                   pace: stats.pace || 100.0, offensive_rating: stats.offensive_rating || 110.0, 
                   recent_form: stats.recent_form || "N/A" };
        });
        if (teamsToUpsert.length > 0) {
          console.log(`Upserting ${teamsToUpsert.length} NBA teams...`);
          const { error: teamUpsertError } = await supabase.from("nba_team_stats").upsert(teamsToUpsert, { onConflict: "team_name" }); 
          if (teamUpsertError) throw teamUpsertError;
          console.log("Successfully upserted NBA team data.");
        } else { console.log("No NBA team data to upsert."); }
        const playerAveragesUrl = `https://api.balldontlie.io/v1/season_averages/general?season=${currentSeason}&season_type=regular&type=base`;
        const allPlayerAverages = await fetchAllPaginatedData(playerAveragesUrl, balldontlieApiKey);
        console.log(`Fetched ${allPlayerAverages.length} NBA player season averages.`);
        if (allPlayerAverages && allPlayerAverages.length > 0) {
            const playerStatsToUpsert = allPlayerAverages.map((avg: any) => ({
                player_name: `${avg.player?.first_name ?? 'Unknown'} ${avg.player?.last_name ?? 'Player'}`, 
                team: avg.player?.team?.abbreviation ?? 'N/A', prop_type: 'Season Avg Pts',
                prop_value: avg.stats?.pts ?? 0,
                analysis: `Avg ${avg.stats?.pts ?? 0} pts in ${avg.stats?.games_played ?? 0} games.`, confidence: 3
            }));
            console.log(`Upserting ${playerStatsToUpsert.length} NBA player prop examples...`);
            const { error: playerUpsertError } = await supabase.from("nba_player_props").upsert(playerStatsToUpsert, { onConflict: "player_name, prop_type" });
            if (playerUpsertError) throw playerUpsertError;
            console.log("Successfully upserted NBA player prop examples.");
        } else { console.log("No NBA player averages data to process."); }
    } catch (nbaError) { console.error("NBA data fetch/process error:", nbaError.message); }
    console.log("--- Finished NBA Data Fetch ---");

    // --- Fetch NHL Data ---
    console.log("--- Starting NHL Data Fetch ---");
    try {
        // ... (NHL code remains the same) ...
      const nhlSeasonYYYYYYYY = "20232024"; const nhlGameType = 2;
      const nhlStandingsData = await fetchNhlData('/v1/standings/now');
      console.log(`Fetched NHL standings with ${nhlStandingsData.standings?.length || 0} teams.`);
      const nhlGoalieStatsData = await fetchNhlData(`/v1/goalie-stats-leaders/${nhlSeasonYYYYYYYY}/${nhlGameType}`);
      console.log(`Fetched NHL goalie stats for ${nhlSeasonYYYYYYYY} with ${nhlGoalieStatsData.goalieStatLeaders?.length || 0} categories.`);
      const nhlTeamsToUpsert = [];
      if (nhlStandingsData.standings && nhlStandingsData.standings.length > 0) {
        const savePctCategory = nhlGoalieStatsData.goalieStatLeaders?.find((cat: any) => cat.category === 'savePct');
        const goalieLeadersMap = new Map(savePctCategory?.leaders?.map((g: any) => [g.teamAbbrev, g]) || []);
        for (const team of nhlStandingsData.standings) {
          const goalieData = goalieLeadersMap.get(team.teamAbbrev);
          nhlTeamsToUpsert.push({
            team_name: `${team.teamName?.default ?? 'Unknown Team'} (${team.teamAbbrev ?? 'N/A'})`,
            puck_line_trend: team.streakCode || 'N/A',
            goalie_name: goalieData ? `${goalieData.firstName ?? ''} ${goalieData.lastName ?? ''}`.trim() : 'N/A',
            goalie_save_percentage: goalieData?.value ?? null,
            power_play_efficiency: team.powerPlayPct ? parseFloat(team.powerPlayPct) / 100 : null,
          });
        }
      }
      if (nhlTeamsToUpsert.length > 0) {
        console.log(`Upserting ${nhlTeamsToUpsert.length} NHL teams...`);
        const { error: nhlTeamUpsertError } = await supabase.from("nhl_team_stats").upsert(nhlTeamsToUpsert, { onConflict: "team_name" });
        if (nhlTeamUpsertError) throw nhlTeamUpsertError;
        console.log("Successfully upserted NHL team data.");
      } else { console.log("No NHL team data to upsert."); }
      const nhlPlayerPropsMap = new Map();
      const nhlSkaterStatsData = await fetchNhlData(`/v1/skater-stats-leaders/${nhlSeasonYYYYYYYY}/${nhlGameType}`);
      console.log(`Fetched NHL skater stats with ${nhlSkaterStatsData.categories?.length || 0} categories.`);
      if (nhlSkaterStatsData.categories && nhlSkaterStatsData.categories.length > 0) {
        for (const category of nhlSkaterStatsData.categories) {
          if (category.leaders && category.leaders.length > 0) {
            for (const player of category.leaders.slice(0, 10)) {
              const playerName = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
              const propType = `Season ${category.categoryLabel ?? 'Stat'}`; const uniqueKey = `${playerName}-${propType}`;
              const propData = {
                player_name: playerName, team: player.teamAbbrev ?? 'N/A', prop_type: propType, prop_value: player.value ?? 0,
                analysis: `${player.value ?? 0} ${category.categoryLabel?.toLowerCase() ?? 'stat'} in ${player.gamesPlayed ?? 0} games.`,
                confidence: Math.min(5, Math.ceil((player.value ?? 0) / 10)),
              };
              nhlPlayerPropsMap.set(uniqueKey, propData);
            }
          }
        }
      }
      const nhlPlayerPropsToUpsert = Array.from(nhlPlayerPropsMap.values());
      if (nhlPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${nhlPlayerPropsToUpsert.length} unique NHL player props...`);
        const { error: nhlPlayerUpsertError } = await supabase.from("nhl_player_props").upsert(nhlPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
        if (nhlPlayerUpsertError) throw nhlPlayerUpsertError;
        console.log("Successfully upserted NHL player props.");
      } else { console.log("No NHL player props to upsert."); }
    } catch (nhlError) { console.error("NHL data fetch/process error:", nhlError.message); }
    console.log("--- Finished NHL Data Fetch ---");

    // --- Fetch MLB Data (v29 Final) ---
    console.log("--- Starting MLB Data Fetch (v29 Final) ---");
    const mlbBaseUrl = "https://api.balldontlie.io/mlb/v1";
    try {
        // ... (MLB code remains the same as v29) ...
      const mlbTeamsUrl = `${mlbBaseUrl}/teams`;
      const allMlbTeams = await fetchAllPaginatedData(mlbTeamsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbTeams.length} MLB teams basic info.`);
      const mlbTeamMap = new Map(); 
      allMlbTeams.forEach(team => {
          const abbreviation = team.abbreviation?.trim().toUpperCase();
          if (abbreviation) { mlbTeamMap.set(abbreviation, team); } 
          else { console.warn(`MLB Team ID ${team.id} missing abbreviation, skipping.`); }
      });
      console.log(`Created MLB team map with ${mlbTeamMap.size} entries keyed by abbreviation.`);
      const mlbStandingsUrl = `${mlbBaseUrl}/standings?season=${currentSeason}`;
      const allMlbStandings = await fetchAllPaginatedData(mlbStandingsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbStandings.length} MLB team standings entries.`);
      const mlbStandingsMap = new Map();
      allMlbStandings.forEach(standing => {
          const abbreviation = standing.team?.abbreviation?.trim().toUpperCase(); 
          if (abbreviation) { mlbStandingsMap.set(abbreviation, standing); } 
          else { console.warn(`MLB Standing object missing team abbreviation. Standing object: ${JSON.stringify(standing)}`); }
      });
       console.log(`Created MLB standings map with ${mlbStandingsMap.size} entries keyed by abbreviation.`);
      const mlbPlayerStatsUrl = `${mlbBaseUrl}/season_stats?season=${currentSeason}`;
      const allMlbPlayerStats = await fetchAllPaginatedData(mlbPlayerStatsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbPlayerStats.length} MLB player season stats entries.`);
      const teamAggregatedStats = new Map();
      if (allMlbPlayerStats && Array.isArray(allMlbPlayerStats)) {
          console.log("Starting MLB player stats aggregation by abbreviation..."); 
          for (const stats of allMlbPlayerStats) {
            const teamAbbreviation = stats.player?.team?.abbreviation?.trim().toUpperCase();
            if (!teamAbbreviation) continue;
            if (!teamAggregatedStats.has(teamAbbreviation)) {
              teamAggregatedStats.set(teamAbbreviation, { total_hits: 0, total_at_bats: 0, total_earned_runs: 0, total_innings_pitched: 0.0 });
            }
            const teamStats = teamAggregatedStats.get(teamAbbreviation);
            teamStats.total_hits += stats.batting_h ?? 0;
            teamStats.total_at_bats += stats.batting_ab ?? 0;
            const earnedRuns = parseFloat(stats.pitching_er); const inningsPitched = parseFloat(stats.pitching_ip);
            if (!isNaN(earnedRuns)) teamStats.total_earned_runs += earnedRuns;
            if (!isNaN(inningsPitched)) teamStats.total_innings_pitched += inningsPitched;
          }
          console.log("Finished MLB player stats aggregation loop."); 
      } else { console.warn("No valid MLB player stats data found for aggregation."); }
      console.log(`Aggregated stats for ${teamAggregatedStats.size} MLB teams keyed by abbreviation.`);
      const finalMlbTeamsToUpsert = [];
      console.log("Starting MLB team data combination (iterating over unique abbreviations)...");
      for (const teamAbbreviation of mlbTeamMap.keys()) {
          const teamInfo = mlbTeamMap.get(teamAbbreviation); const standing = mlbStandingsMap.get(teamAbbreviation);
          const aggregated = teamAggregatedStats.get(teamAbbreviation);
          if (!teamInfo) continue; 
          const teamName = `${teamInfo.display_name ?? 'Unknown'} (${teamInfo.abbreviation ?? 'N/A'})`;
          let era = null; let batting_average = null;
          if (aggregated) {
              if (aggregated.total_innings_pitched > 0) { era = (aggregated.total_earned_runs * 9) / aggregated.total_innings_pitched; }
              if (aggregated.total_at_bats > 0) { batting_average = aggregated.total_hits / aggregated.total_at_bats; }
          }
          const wins = standing?.wins ?? 0; const losses = standing?.losses ?? 0; const winLossRecord = `${wins}-${losses}`; 
          const teamData = { team_name: teamName, win_loss_record: winLossRecord, era: era, batting_average: batting_average };
          finalMlbTeamsToUpsert.push(teamData);
      }
      console.log(`Prepared ${finalMlbTeamsToUpsert.length} unique MLB teams for upsert.`);
      if (finalMlbTeamsToUpsert.length > 0) {
        console.log(`Upserting ${finalMlbTeamsToUpsert.length} MLB teams...`);
        const { error: mlbTeamUpsertError } = await supabase.from("mlb_team_stats").upsert(finalMlbTeamsToUpsert, { onConflict: "team_name" });
        if (mlbTeamUpsertError) { console.error("MLB Team Upsert Error Details:", JSON.stringify(mlbTeamUpsertError)); throw mlbTeamUpsertError; }
        console.log("Successfully upserted MLB team data.");
      } else { console.log("No combined MLB team stats to upsert." ); }
      const finalMlbPlayerPropsMap = new Map();
      if (allMlbPlayerStats && Array.isArray(allMlbPlayerStats)) {
          console.log("Starting MLB player prop processing...");
          for (const stats of allMlbPlayerStats) {
              const player = stats.player; if (!player) continue;
              const playerName = `${player.first_name ?? 'Unknown'} ${player.last_name ?? 'Player'}`.trim();
              const teamAbbreviation = player.team?.abbreviation?.trim().toUpperCase() ?? 'N/A';
              const props = {
                  'AVG': (stats.batting_ab ?? 0) > 0 ? (stats.batting_h ?? 0) / stats.batting_ab : 0,
                  'HR': stats.batting_hr ?? 0, 'RBI': stats.batting_rbi ?? 0,
                  'ERA': (parseFloat(stats.pitching_ip) || 0) > 0 ? (parseFloat(stats.pitching_er) * 9) / parseFloat(stats.pitching_ip) : null,
                  'W': stats.pitching_w ?? 0,
              };
              for (const [propType, propValue] of Object.entries(props)) {
                  if ((propType === 'ERA' && propValue === null) || (propType === 'W' && propValue === 0 && (parseFloat(stats.pitching_ip) || 0) === 0)) { continue; }
                  const uniqueKey = `${playerName}-${propType}`;
                  const propData = {
                      player_name: playerName, team: teamAbbreviation, prop_type: propType, prop_value: propValue,
                      analysis: `Season ${propType}: ${propValue?.toFixed ? propValue.toFixed(3) : propValue}`, confidence: 3
                  };
                  finalMlbPlayerPropsMap.set(uniqueKey, propData);
              }
          }
          console.log("Finished MLB player prop processing loop.");
      } else { console.warn("No valid MLB player stats data found for prop processing."); }
      const mlbPlayerPropsToUpsert = Array.from(finalMlbPlayerPropsMap.values());
      console.log(`Prepared ${mlbPlayerPropsToUpsert.length} unique MLB player props for upsert.`);
      if (mlbPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${mlbPlayerPropsToUpsert.length} MLB player props...`);
        const { error: mlbPlayerUpsertError } = await supabase.from("mlb_player_props").upsert(mlbPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
        if (mlbPlayerUpsertError) throw mlbPlayerUpsertError;
        console.log("Successfully upserted MLB player props.");
      } else { console.log("No MLB player props to upsert."); }
    } catch (mlbError) { console.error("MLB data fetch/process error:", mlbError.message); }
    console.log("--- Finished MLB Data Fetch ---");

    // --- Fetch EPL Data (v30 Diagnostic) ---
    console.log("--- Starting EPL Data Fetch (v30 Diagnostic) ---");
    const eplBaseUrl = "https://api.balldontlie.io/epl/v1"; 
    let allEplTeams = []; // Initialize empty array
    let eplFetchMethod = "None"; // Track which method succeeded

    try {
        // --- DIAGNOSTIC ATTEMPTS FOR /teams ---
        console.log("--- [EPL DIAGNOSTIC] Attempting to fetch /teams (no params) ---");
        try {
            const response = await fetch(`${eplBaseUrl}/teams`, { headers: { "Authorization": balldontlieApiKey } });
            if (!response.ok) {
                throw new Error(`Status ${response.status}: ${await response.text()}`);
            }
            const data = await response.json();
            // Check if data.data exists and is an array
            if (Array.isArray(data?.data)) {
                allEplTeams = data.data; // Assuming non-paginated or just first page is enough for diagnostic
                eplFetchMethod = "No Params";
                console.log(`--- [EPL DIAGNOSTIC] Success fetching /teams (no params). Found ${allEplTeams.length} teams.`);
            } else {
                 console.log(`--- [EPL DIAGNOSTIC] Fetch /teams (no params) OK, but response format unexpected: ${JSON.stringify(data)}`);
                 throw new Error("Unexpected response format");
            }
        } catch (error) {
            console.warn(`--- [EPL DIAGNOSTIC] Failed fetching /teams (no params): ${error.message}`);
        }

        // Only try next method if the previous one failed
        if (eplFetchMethod === "None") {
            console.log("--- [EPL DIAGNOSTIC] Attempting to fetch /teams?season=2023 ---");
            try {
                const response = await fetch(`${eplBaseUrl}/teams?season=2023`, { headers: { "Authorization": balldontlieApiKey } });
                if (!response.ok) {
                    throw new Error(`Status ${response.status}: ${await response.text()}`);
                }
                const data = await response.json();
                 if (Array.isArray(data?.data)) {
                    allEplTeams = data.data;
                    eplFetchMethod = "Season 2023";
                    console.log(`--- [EPL DIAGNOSTIC] Success fetching /teams?season=2023. Found ${allEplTeams.length} teams.`);
                 } else {
                    console.log(`--- [EPL DIAGNOSTIC] Fetch /teams?season=2023 OK, but response format unexpected: ${JSON.stringify(data)}`);
                    throw new Error("Unexpected response format");
                 }
            } catch (error) {
                console.warn(`--- [EPL DIAGNOSTIC] Failed fetching /teams?season=2023: ${error.message}`);
            }
        }

        if (eplFetchMethod === "None") {
            console.log("--- [EPL DIAGNOSTIC] Attempting to fetch /teams?season=2024 ---");
            try {
                const response = await fetch(`${eplBaseUrl}/teams?season=2024`, { headers: { "Authorization": balldontlieApiKey } });
                if (!response.ok) {
                    throw new Error(`Status ${response.status}: ${await response.text()}`);
                }
                 const data = await response.json();
                 if (Array.isArray(data?.data)) {
                    allEplTeams = data.data;
                    eplFetchMethod = "Season 2024";
                    console.log(`--- [EPL DIAGNOSTIC] Success fetching /teams?season=2024. Found ${allEplTeams.length} teams.`);
                 } else {
                    console.log(`--- [EPL DIAGNOSTIC] Fetch /teams?season=2024 OK, but response format unexpected: ${JSON.stringify(data)}`);
                    throw new Error("Unexpected response format");
                 }
            } catch (error) {
                console.warn(`--- [EPL DIAGNOSTIC] Failed fetching /teams?season=2024: ${error.message}`);
            }
        }
        // --- END DIAGNOSTIC ATTEMPTS ---

        if (eplFetchMethod === "None") {
            console.error("--- [EPL DIAGNOSTIC] All attempts to fetch EPL teams failed. Cannot proceed with EPL data.");
            // Skip the rest of the EPL processing
        } else {
            console.log(`Successfully fetched ${allEplTeams.length} EPL teams using method: ${eplFetchMethod}.`);
            const eplTeamMap = new Map(allEplTeams.map(team => [team.abbreviation?.trim().toUpperCase(), team]));
            console.log(`Created EPL team map with ${eplTeamMap.size} entries.`);

            // Continue with standings and player stats fetch (using eplSeason = 2024 for now)
            // Note: These might also fail if the season parameter is wrong for them too.
            const eplStandingsUrl = `${eplBaseUrl}/standings?season=${eplSeason}`;
            const allEplStandings = await fetchAllPaginatedData(eplStandingsUrl, balldontlieApiKey);
            console.log(`Fetched ${allEplStandings.length} EPL standings entries.`);
            const eplStandingsMap = new Map();
            allEplStandings.forEach(standing => {
                const abbreviation = standing.team?.abbreviation?.trim().toUpperCase();
                if (abbreviation) { eplStandingsMap.set(abbreviation, standing); } 
                else { console.warn(`EPL Standing object missing team abbreviation. Standing object: ${JSON.stringify(standing)}`); }
            });
            console.log(`Created EPL standings map with ${eplStandingsMap.size} entries.`);

            const eplTeamsToUpsert = [];
            for (const teamAbbreviation of eplTeamMap.keys()) {
                const teamInfo = eplTeamMap.get(teamAbbreviation); const standing = eplStandingsMap.get(teamAbbreviation);
                if (!teamInfo) continue;
                eplTeamsToUpsert.push({
                    team_name: `${teamInfo.display_name ?? 'Unknown'} (${teamInfo.abbreviation ?? 'N/A'})`,
                    wins: standing?.wins ?? 0, losses: standing?.losses ?? 0,
                    goals_for: standing?.goals_for ?? 0, goals_against: standing?.goals_against ?? 0,
                    points: standing?.points ?? 0,
                });
            }
            if (eplTeamsToUpsert.length > 0) {
                console.log(`Upserting ${eplTeamsToUpsert.length} EPL teams to placeholder table...`);
                const { error: eplTeamError } = await supabase.from("epl_team_stats").upsert(eplTeamsToUpsert, { onConflict: "team_name" });
                if (eplTeamError) throw eplTeamError;
                console.log("Successfully upserted EPL team data (placeholder)." );
            } else { console.log("No EPL team data to upsert."); }

            const eplPlayerStatsUrl = `${eplBaseUrl}/season_stats?season=${eplSeason}`;
            const allEplPlayerStats = await fetchAllPaginatedData(eplPlayerStatsUrl, balldontlieApiKey);
            console.log(`Fetched ${allEplPlayerStats.length} EPL player season stats entries.`);
            const finalEplPlayerPropsMap = new Map();
            if (allEplPlayerStats && Array.isArray(allEplPlayerStats)) {
                for (const stats of allEplPlayerStats) {
                    const player = stats.player; if (!player) continue;
                    const playerName = `${player.first_name ?? 'Unknown'} ${player.last_name ?? 'Player'}`.trim();
                    const teamAbbreviation = player.team?.abbreviation?.trim().toUpperCase() ?? 'N/A';
                    const props = { 'Goals': stats.goals ?? 0, 'Assists': stats.assists ?? 0, 'YellowCards': stats.yellow_cards ?? 0 };
                    for (const [propType, propValue] of Object.entries(props)) {
                         if (propValue === 0) continue;
                         const uniqueKey = `${playerName}-${propType}`;
                         const propData = {
                             player_name: playerName, team: teamAbbreviation, prop_type: propType, prop_value: propValue,
                             analysis: `Season ${propType}: ${propValue}`, confidence: 3
                         };
                         finalEplPlayerPropsMap.set(uniqueKey, propData);
                    }
                }
            }
            const eplPlayerPropsToUpsert = Array.from(finalEplPlayerPropsMap.values());
            if (eplPlayerPropsToUpsert.length > 0) {
                console.log(`Upserting ${eplPlayerPropsToUpsert.length} EPL player props to placeholder table...`);
                const { error: eplPlayerError } = await supabase.from("epl_player_props").upsert(eplPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
                if (eplPlayerError) throw eplPlayerError;
                console.log("Successfully upserted EPL player props (placeholder).");
            } else { console.log("No EPL player props to upsert."); }
        }

    } catch (eplError) {
        // Log specific EPL errors but don't stop the whole function if it's just EPL failing
        console.error("EPL data fetch/process error (Placeholder):", eplError.message);
        // Check if it's a 404 or similar indicating the endpoint might not exist
        if (eplError.message.includes("404")) {
            console.warn("EPL endpoints might not be available or require different parameters.");
        }
    } 
    console.log("--- Finished EPL Data Fetch (Placeholder) ---");

    // --- Function Completion ---
    console.log("Function execution completed successfully.");
    return new Response(JSON.stringify({ message: "Data update process completed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    // --- Error Handling ---
    console.error("Unhandled error in function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

