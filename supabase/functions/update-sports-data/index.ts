// Import necessary libraries
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Initializing update-sports-data function (v35 EPL Direct Teams Fetch)");

// --- Helper Function to fetch paginated data ---
async function fetchAllPaginatedData(url: string, apiKey: string) {
  // --- [v31] Add check for undefined URL ---
  if (typeof url !== 'string' || !url) {
    console.error(`[fetchAllPaginatedData] Received invalid URL: ${url}`);
    throw new Error(`[fetchAllPaginatedData] Attempted to fetch with an invalid URL.`);
  }
  // --- End [v31] check ---

  let allData: any[] = [];
  let nextCursor: string | null = null;
  let page = 1;

  do {
    // --- [v31] Check url again before includes, though the check above should prevent this ---
    if (typeof url !== 'string') {
        console.error(`[fetchAllPaginatedData] URL became invalid within loop: ${url}`);
        throw new Error(`[fetchAllPaginatedData] URL became invalid within loop.`);
    }
    // --- End [v31] check ---
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
        // If it's not paginated but the response is an array, use it directly
        if (Array.isArray(pageData)) {
            console.log(`Assuming non-paginated array response for ${url.split("?")[0]}`);
            allData = pageData;
        } else {
             console.error(`Received unexpected data structure (not an array or {data: []}) for ${url.split("?")[0]}`);
        }
        break; // Stop pagination if data format is unexpected
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
        const nbaBaseUrl = "https://api.balldontlie.io/v1";
        const nbaTeamsUrl = `${nbaBaseUrl}/teams`;
        const allTeams = await fetchAllPaginatedData(nbaTeamsUrl, balldontlieApiKey);
        console.log(`Fetched ${allTeams.length} NBA teams basic info.`);
        
        const teamStatsMap = new Map(); 
        console.log("Placeholder: Need to implement actual NBA team stats/standings fetch.");
        // Placeholder logic for NBA team stats
        allTeams.forEach(team => {
            teamStatsMap.set(team.id, {
                win_rate: Math.random() * 0.6 + 0.2, // Example: Random win rate between 20% and 80%
                pace: 95 + Math.random() * 10, // Example: Random pace between 95 and 105
                offensive_rating: 105 + Math.random() * 10, // Example: Random offensive rating between 105 and 115
                recent_form: "W-L-W-L-W" // Example: Static recent form
            });
        });

        const teamsToUpsert = allTeams.map((team: any) => {
          const stats = teamStatsMap.get(team.id) || {};
          return {
            team_name: `${team.full_name} (${team.abbreviation})`,
            win_rate: stats.win_rate || 0.5,
            pace: stats.pace || 100.0,
            offensive_rating: stats.offensive_rating || 110.0,
            recent_form: stats.recent_form || "N/A"
          };
        });

        if (teamsToUpsert.length > 0) {
          console.log(`Upserting ${teamsToUpsert.length} NBA teams...`);
          const { error: teamUpsertError } = await supabase.from("nba_team_stats").upsert(teamsToUpsert, { onConflict: "team_name" }); 
          if (teamUpsertError) throw teamUpsertError;
          console.log("Successfully upserted NBA team data.");
        } else {
          console.log("No NBA team data to upsert.");
        }

        // Fetch NBA Player Props (Season Averages)
        const playerAveragesUrl = `${nbaBaseUrl}/season_averages/general?season=${currentSeason}&season_type=regular&type=base`;
        const allPlayerAverages = await fetchAllPaginatedData(playerAveragesUrl, balldontlieApiKey);
        console.log(`Fetched ${allPlayerAverages.length} NBA player season averages.`);

        if (allPlayerAverages && allPlayerAverages.length > 0) {
            const playerStatsToUpsert = allPlayerAverages.map((avg: any) => ({
                player_name: `${avg.player?.first_name ?? 'Unknown'} ${avg.player?.last_name ?? 'Player'}`,
                team: avg.player?.team?.abbreviation ?? 'N/A',
                prop_type: 'Season Avg Pts',
                prop_value: avg.stats?.pts ?? 0,
                analysis: `Avg ${avg.stats?.pts ?? 0} pts in ${avg.stats?.games_played ?? 0} games.`,
                confidence: 3 // Placeholder confidence
            }));

            console.log(`Upserting ${playerStatsToUpsert.length} NBA player prop examples...`);
            const { error: playerUpsertError } = await supabase.from("nba_player_props").upsert(playerStatsToUpsert, { onConflict: "player_name, prop_type" });
            if (playerUpsertError) throw playerUpsertError;
            console.log("Successfully upserted NBA player prop examples.");
        } else {
            console.log("No NBA player averages data to process.");
        }
    } catch (nbaError) {
        console.error("NBA data fetch/process error:", nbaError.message);
        // Optionally log the full error object for more details
        // console.error("Full NBA Error Object:", nbaError);
    }
    console.log("--- Finished NBA Data Fetch ---");

    // --- Fetch NHL Data ---
    console.log("--- Starting NHL Data Fetch ---");
    try {
      const nhlSeasonYYYYYYYY = "20232024"; // Format required by NHL API
      const nhlGameType = 2; // 2 for Regular Season

      // Fetch NHL Standings
      const nhlStandingsData = await fetchNhlData('/v1/standings/now');
      console.log(`Fetched NHL standings with ${nhlStandingsData.standings?.length || 0} teams.`);

      // Fetch NHL Goalie Stats (for Save Percentage)
      const nhlGoalieStatsData = await fetchNhlData(`/v1/goalie-stats-leaders/${nhlSeasonYYYYYYYY}/${nhlGameType}`);
      console.log(`Fetched NHL goalie stats for ${nhlSeasonYYYYYYYY} with ${nhlGoalieStatsData.goalieStatLeaders?.length || 0} categories.`);

      const nhlTeamsToUpsert = [];
      if (nhlStandingsData.standings && nhlStandingsData.standings.length > 0) {
        // Create a map of goalie save percentages by team abbreviation for quick lookup
        const savePctCategory = nhlGoalieStatsData.goalieStatLeaders?.find((cat: any) => cat.category === 'savePct');
        const goalieLeadersMap = new Map(savePctCategory?.leaders?.map((g: any) => [g.teamAbbrev, g]) || []);

        for (const team of nhlStandingsData.standings) {
          const goalieData = goalieLeadersMap.get(team.teamAbbrev);
          nhlTeamsToUpsert.push({
            team_name: `${team.teamName?.default ?? 'Unknown Team'} (${team.teamAbbrev ?? 'N/A'})`,
            puck_line_trend: team.streakCode || 'N/A', // Using streak as a proxy for trend
            goalie_name: goalieData ? `${goalieData.firstName ?? ''} ${goalieData.lastName ?? ''}`.trim() : 'N/A',
            goalie_save_percentage: goalieData?.value ?? null,
            power_play_efficiency: team.powerPlayPct ? parseFloat(team.powerPlayPct) / 100 : null,
            // Add other relevant stats from standings if needed
          });
        }
      }

      if (nhlTeamsToUpsert.length > 0) {
        console.log(`Upserting ${nhlTeamsToUpsert.length} NHL teams...`);
        const { error: nhlTeamUpsertError } = await supabase.from("nhl_team_stats").upsert(nhlTeamsToUpsert, { onConflict: "team_name" });
        if (nhlTeamUpsertError) throw nhlTeamUpsertError;
        console.log("Successfully upserted NHL team data.");
      } else {
        console.log("No NHL team data to upsert.");
      }

      // Fetch NHL Player Props (Top Skater Stats)
      const nhlPlayerPropsMap = new Map(); // Use Map for uniqueness
      const nhlSkaterStatsData = await fetchNhlData(`/v1/skater-stats-leaders/${nhlSeasonYYYYYYYY}/${nhlGameType}`);
      console.log(`Fetched NHL skater stats with ${nhlSkaterStatsData.categories?.length || 0} categories.`);

      if (nhlSkaterStatsData.categories && nhlSkaterStatsData.categories.length > 0) {
        for (const category of nhlSkaterStatsData.categories) {
          // Limit to top 10 players per category for relevance
          if (category.leaders && category.leaders.length > 0) {
            for (const player of category.leaders.slice(0, 10)) { 
              const playerName = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
              const propType = `Season ${category.categoryLabel ?? 'Stat'}`; // e.g., "Season Goals"
              const uniqueKey = `${playerName}-${propType}`;

              const propData = {
                player_name: playerName,
                team: player.teamAbbrev ?? 'N/A',
                prop_type: propType,
                prop_value: player.value ?? 0,
                analysis: `${player.value ?? 0} ${category.categoryLabel?.toLowerCase() ?? 'stat'} in ${player.gamesPlayed ?? 0} games.`,
                confidence: Math.min(5, Math.ceil((player.value ?? 0) / 10)), // Simple confidence based on value
              };
              nhlPlayerPropsMap.set(uniqueKey, propData); // Overwrites duplicates
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
      } else {
        console.log("No NHL player props to upsert.");
      }

    } catch (nhlError) {
        console.error("NHL data fetch/process error:", nhlError.message);
        // console.error("Full NHL Error Object:", nhlError);
    }
    console.log("--- Finished NHL Data Fetch ---");

    // --- Fetch MLB Data (v29 Final) ---
    console.log("--- Starting MLB Data Fetch (v29 Final) ---");
    const mlbBaseUrl = "https://api.balldontlie.io/mlb/v1";
    try {
      // Fetch MLB Teams
      const mlbTeamsUrl = `${mlbBaseUrl}/teams`;
      const allMlbTeams = await fetchAllPaginatedData(mlbTeamsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbTeams.length} MLB teams basic info.`);

      // Create a map of teams keyed by UPPERCASE abbreviation for consistent lookup
      const mlbTeamMap = new Map(); 
      allMlbTeams.forEach(team => {
          const abbreviation = team.abbreviation?.trim().toUpperCase();
          if (abbreviation) {
              mlbTeamMap.set(abbreviation, team);
          } else {
              console.warn(`MLB Team ID ${team.id} missing abbreviation, skipping.`);
          }
      });
      console.log(`Created MLB team map with ${mlbTeamMap.size} entries keyed by abbreviation.`);

      // Fetch MLB Standings
      const mlbStandingsUrl = `${mlbBaseUrl}/standings?season=${currentSeason}`;
      const allMlbStandings = await fetchAllPaginatedData(mlbStandingsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbStandings.length} MLB team standings entries.`);

      // Create a map of standings keyed by UPPERCASE abbreviation
      const mlbStandingsMap = new Map();
      allMlbStandings.forEach(standing => {
          // Use the correct path identified in v28/v29: standing.team.abbreviation
          const abbreviation = standing.team?.abbreviation?.trim().toUpperCase(); 
          if (abbreviation) {
              mlbStandingsMap.set(abbreviation, standing);
          } else {
              // Log if a standing object doesn't have the expected structure
              console.warn(`MLB Standing object missing team abbreviation. Standing object: ${JSON.stringify(standing)}`);
          }
      });
       console.log(`Created MLB standings map with ${mlbStandingsMap.size} entries keyed by abbreviation.`);

      // Fetch MLB Player Season Stats
      const mlbPlayerStatsUrl = `${mlbBaseUrl}/season_stats?season=${currentSeason}`;
      const allMlbPlayerStats = await fetchAllPaginatedData(mlbPlayerStatsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbPlayerStats.length} MLB player season stats entries.`);

      // Aggregate player stats by team abbreviation
      const teamAggregatedStats = new Map();
      if (allMlbPlayerStats && Array.isArray(allMlbPlayerStats)) {
          console.log("Starting MLB player stats aggregation by abbreviation..."); 
          for (const stats of allMlbPlayerStats) {
            // Use player's team abbreviation for grouping
            const teamAbbreviation = stats.player?.team?.abbreviation?.trim().toUpperCase();
            if (!teamAbbreviation) continue; // Skip if no team abbreviation

            if (!teamAggregatedStats.has(teamAbbreviation)) {
              teamAggregatedStats.set(teamAbbreviation, { total_hits: 0, total_at_bats: 0, total_earned_runs: 0, total_innings_pitched: 0.0 });
            }
            const teamStats = teamAggregatedStats.get(teamAbbreviation);

            // Aggregate batting stats
            teamStats.total_hits += stats.batting_h ?? 0;
            teamStats.total_at_bats += stats.batting_ab ?? 0;

            // Aggregate pitching stats (ensure values are numbers)
            const earnedRuns = parseFloat(stats.pitching_er); // Earned Runs
            const inningsPitched = parseFloat(stats.pitching_ip); // Innings Pitched
            if (!isNaN(earnedRuns)) teamStats.total_earned_runs += earnedRuns;
            if (!isNaN(inningsPitched)) teamStats.total_innings_pitched += inningsPitched;
          }
          console.log("Finished MLB player stats aggregation loop."); 
      } else {
          console.warn("No valid MLB player stats data found for aggregation.");
      }
      console.log(`Aggregated stats for ${teamAggregatedStats.size} MLB teams keyed by abbreviation.`);

      // Combine Team Info, Standings, and Aggregated Stats
      const finalMlbTeamsToUpsert = [];
      console.log("Starting MLB team data combination (iterating over unique abbreviations)...");
      for (const teamAbbreviation of mlbTeamMap.keys()) {
          const teamInfo = mlbTeamMap.get(teamAbbreviation);
          const standing = mlbStandingsMap.get(teamAbbreviation);
          const aggregated = teamAggregatedStats.get(teamAbbreviation);

          if (!teamInfo) continue; // Should not happen if map keys are from mlbTeamMap

          const teamName = `${teamInfo.display_name ?? 'Unknown'} (${teamInfo.abbreviation ?? 'N/A'})`;
          let era = null;
          let batting_average = null;

          if (aggregated) {
              // Calculate ERA (Earned Run Average)
              if (aggregated.total_innings_pitched > 0) {
                  era = (aggregated.total_earned_runs * 9) / aggregated.total_innings_pitched;
              }
              // Calculate Batting Average
              if (aggregated.total_at_bats > 0) {
                  batting_average = aggregated.total_hits / aggregated.total_at_bats;
              }
          }
          
          // Get Wins and Losses from standings, format for win_loss_record
          const wins = standing?.wins ?? 0;
          const losses = standing?.losses ?? 0;
          const winLossRecord = `${wins}-${losses}`; // Format as "W-L"

          const teamData = {
              team_name: teamName,
              win_loss_record: winLossRecord, // Use the correct column name
              era: era, // Calculated ERA
              batting_average: batting_average // Calculated Batting Average
              // Add other fields from teamInfo or standing if needed, matching table schema
          };
          finalMlbTeamsToUpsert.push(teamData);
      }
      console.log(`Prepared ${finalMlbTeamsToUpsert.length} unique MLB teams for upsert.`);

      // Upsert MLB Team Stats
      if (finalMlbTeamsToUpsert.length > 0) {
        console.log(`Upserting ${finalMlbTeamsToUpsert.length} MLB teams...`);
        const { error: mlbTeamUpsertError } = await supabase.from("mlb_team_stats").upsert(finalMlbTeamsToUpsert, { onConflict: "team_name" });
        if (mlbTeamUpsertError) throw mlbTeamUpsertError;
        console.log("Successfully upserted MLB team data.");
      } else {
        console.log("No combined MLB team stats to upsert.");
      }

      // Process and Upsert MLB Player Props
      const finalMlbPlayerPropsMap = new Map(); // Use Map for uniqueness
      if (allMlbPlayerStats && Array.isArray(allMlbPlayerStats)) {
          for (const stats of allMlbPlayerStats) {
              const playerName = `${stats.player?.first_name ?? 'Unknown'} ${stats.player?.last_name ?? 'Player'}`;
              const teamAbbr = stats.player?.team?.abbreviation ?? 'N/A';

              // Example: Create props for Hits and Innings Pitched
              if (stats.batting_h !== null && stats.batting_h !== undefined) {
                  const propType = 'Season Hits';
                  const uniqueKey = `${playerName}-${propType}`;
                  finalMlbPlayerPropsMap.set(uniqueKey, {
                      player_name: playerName, team: teamAbbr, prop_type: propType, prop_value: stats.batting_h,
                      analysis: `${stats.batting_h} hits in ${stats.games_played ?? 0} games.`, confidence: 3
                  });
              }
              if (stats.pitching_ip !== null && stats.pitching_ip !== undefined) {
                  const propType = 'Season Innings Pitched';
                  const uniqueKey = `${playerName}-${propType}`;
                  const ipValue = parseFloat(stats.pitching_ip);
                  if (!isNaN(ipValue)) {
                      finalMlbPlayerPropsMap.set(uniqueKey, {
                          player_name: playerName, team: teamAbbr, prop_type: propType, prop_value: ipValue,
                          analysis: `${ipValue} innings pitched in ${stats.games_played ?? 0} games.`, confidence: 3
                      });
                  }
              }
              // Add more props as needed (e.g., HR, RBI, SO, ERA for individual pitchers)
          }
      }
      const finalMlbPlayerPropsToUpsert = Array.from(finalMlbPlayerPropsMap.values());

      if (finalMlbPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${finalMlbPlayerPropsToUpsert.length} unique MLB player props...`);
        const { error: mlbPlayerUpsertError } = await supabase.from("mlb_player_props").upsert(finalMlbPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
        if (mlbPlayerUpsertError) throw mlbPlayerUpsertError;
        console.log("Successfully upserted MLB player props.");
      } else {
        console.log("No MLB player props to upsert.");
      }

    } catch (mlbError) {
        console.error("MLB data fetch/process error:", mlbError.message);
        // console.error("Full MLB Error Object:", mlbError);
    }
    console.log("--- Finished MLB Data Fetch ---");

    // --- Fetch EPL Data (v35 - Direct Teams Fetch) ---
    console.log("--- Starting EPL Data Fetch (v35 - Direct Teams Fetch) ---");
    const eplBaseUrl = "https://api.balldontlie.io/epl/v1";
    try {
      // --- [v35] Fetch EPL Teams using direct fetch (no pagination) ---
      const eplTeamsUrl = `${eplBaseUrl}/teams`;
      console.log(`Fetching EPL teams directly from ${eplTeamsUrl}...`);
      let allEplTeams = [];
      const response = await fetch(eplTeamsUrl, {
        headers: {
          "Authorization": balldontlieApiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${await response.text()} fetching ${eplTeamsUrl}`);
      }
      const eplTeamsData = await response.json();
      // Check if data is in { data: [...] } or just [...] 
      if (Array.isArray(eplTeamsData.data)) {
          allEplTeams = eplTeamsData.data;
      } else if (Array.isArray(eplTeamsData)) {
          allEplTeams = eplTeamsData;
      } else {
          console.error(`Received unexpected data structure for EPL teams: ${JSON.stringify(eplTeamsData)}`);
          throw new Error("Unexpected data structure received for EPL teams.");
      }
      console.log(`Fetched ${allEplTeams.length} EPL teams basic info directly.`);
      // --- End [v35] Direct Fetch ---

      // Create map keyed by UPPERCASE abbreviation (using 'abbr')
      const eplTeamMap = new Map();
      allEplTeams.forEach(team => {
        const abbreviation = team.abbr?.trim().toUpperCase(); // Use 'abbr' for EPL
        if (abbreviation) {
          eplTeamMap.set(abbreviation, team);
        } else {
          console.warn(`EPL Team ID ${team.id} missing abbreviation ('abbr'), skipping.`);
        }
      });
      console.log(`Created EPL team map with ${eplTeamMap.size} entries keyed by abbreviation.`);

      // Fetch EPL Standings (using pagination helper)
      const eplStandingsUrl = `${eplBaseUrl}/standings?season=${eplSeason}`;
      const allEplStandings = await fetchAllPaginatedData(eplStandingsUrl, balldontlieApiKey);
      console.log(`Fetched ${allEplStandings.length} EPL team standings entries.`);

      // Create map keyed by UPPERCASE abbreviation (using 'abbr')
      const eplStandingsMap = new Map();
      allEplStandings.forEach(standing => {
        const abbreviation = standing.team?.abbr?.trim().toUpperCase(); // Use 'abbr' for EPL
        if (abbreviation) {
          eplStandingsMap.set(abbreviation, standing);
        } else {
          console.warn(`EPL Standing object missing team abbreviation ('abbr'). Standing object: ${JSON.stringify(standing)}`);
        }
      });
      console.log(`Created EPL standings map with ${eplStandingsMap.size} entries keyed by abbreviation.`);

      // Combine Team Info and Standings for Upsert
      const finalEplTeamsToUpsert = [];
      for (const teamAbbreviation of eplTeamMap.keys()) {
        const teamInfo = eplTeamMap.get(teamAbbreviation);
        const standing = eplStandingsMap.get(teamAbbreviation);

        if (!teamInfo) continue;

        const teamName = `${teamInfo.display_name ?? 'Unknown'} (${teamInfo.abbr ?? 'N/A'})`; // Use abbr
        
        const teamData = {
          team_name: teamName,
          wins: standing?.wins ?? 0,
          losses: standing?.losses ?? 0,
          goals_for: standing?.goals_for ?? 0,
          goals_against: standing?.goals_against ?? 0,
          points: standing?.points ?? 0,
        };
        finalEplTeamsToUpsert.push(teamData);
      }

      // Upsert EPL Team Stats
      if (finalEplTeamsToUpsert.length > 0) {
        console.log(`Upserting ${finalEplTeamsToUpsert.length} EPL teams...`);
        // Use confirmed table name: epl_team_stats
        const { error: eplTeamUpsertError } = await supabase.from("epl_team_stats").upsert(finalEplTeamsToUpsert, { onConflict: "team_name" });
        if (eplTeamUpsertError) throw eplTeamUpsertError;
        console.log("Successfully upserted EPL team data.");
      } else {
        console.log("No combined EPL team stats to upsert.");
      }

      // Fetch EPL Player Season Stats (using pagination helper)
      const eplPlayerStatsUrl = `${eplBaseUrl}/season_stats?season=${eplSeason}`;
      // --- [v31] Add check for valid URL before calling fetchAllPaginatedData ---
      if (typeof eplPlayerStatsUrl !== 'string' || !eplPlayerStatsUrl) {
          console.error(`[EPL Block] Invalid player stats URL constructed: ${eplPlayerStatsUrl}`);
          throw new Error(`[EPL Block] Cannot fetch player stats with invalid URL.`);
      }
      // --- End [v31] check ---
      console.log(`Constructed EPL Player Stats URL: ${eplPlayerStatsUrl}`);
      let allEplPlayerStats = [];
      try {
          console.log("Attempting to fetch EPL player stats...");
          allEplPlayerStats = await fetchAllPaginatedData(eplPlayerStatsUrl, balldontlieApiKey);
          console.log(`Fetched ${allEplPlayerStats.length} EPL player season stats entries.`);
      } catch (playerStatsError) {
          console.error(`Error fetching EPL player stats from ${eplPlayerStatsUrl}:`, playerStatsError.message);
          // Log the full error if needed
          // console.error("Full EPL Player Stats Error Object:", playerStatsError);
          // Decide if we should continue without player stats or throw
          console.warn("Proceeding without EPL player stats due to fetch error.");
          // Optionally: throw playerStatsError; // Uncomment to make the whole function fail
      }

      // Process and Upsert EPL Player Props
      const finalEplPlayerPropsMap = new Map(); // Use Map for uniqueness
      if (allEplPlayerStats && Array.isArray(allEplPlayerStats)) {
        for (const stats of allEplPlayerStats) {
          const playerName = `${stats.player?.first_name ?? 'Unknown'} ${stats.player?.last_name ?? 'Player'}`;
          const teamAbbr = stats.player?.team?.abbr ?? 'N/A'; // Use abbr

          // Example props: Goals, Assists, Yellow Cards
          const props = [
            { type: 'Season Goals', value: stats.goals },
            { type: 'Season Assists', value: stats.assists },
            { type: 'Season Yellow Cards', value: stats.yellow_cards },
            // Add more stats available in the API response as needed
          ];

          for (const prop of props) {
            if (prop.value !== null && prop.value !== undefined) {
              const uniqueKey = `${playerName}-${prop.type}`;
              finalEplPlayerPropsMap.set(uniqueKey, {
                player_name: playerName,
                team: teamAbbr,
                prop_type: prop.type,
                prop_value: prop.value,
                analysis: `${prop.value} ${prop.type.split(' ')[1]} in ${stats.games_played ?? 0} games.`,
                confidence: 3 // Placeholder confidence
              });
            }
          }
        }
      }
      const finalEplPlayerPropsToUpsert = Array.from(finalEplPlayerPropsMap.values());

      if (finalEplPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${finalEplPlayerPropsToUpsert.length} unique EPL player props...`);
        // Use confirmed table name: epl_player_props
        const { error: eplPlayerUpsertError } = await supabase.from("epl_player_props").upsert(finalEplPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
        if (eplPlayerUpsertError) throw eplPlayerUpsertError;
        console.log("Successfully upserted EPL player props.");
      } else {
        console.log("No EPL player props to upsert.");
      }

    } catch (eplError) {
      console.error("EPL data fetch/process error:", eplError.message);
      // console.error("Full EPL Error Object:", eplError);
    }
    console.log("--- Finished EPL Data Fetch ---");

    // --- Final Response ---
    console.log("Function execution completed successfully.");
    return new Response(JSON.stringify({ message: "Data update process completed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Unhandled error in function execution:", error.message);
    // console.error("Full Unhandled Error Object:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

