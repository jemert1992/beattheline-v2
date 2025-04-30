// Import necessary libraries
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Initializing update-sports-data function");

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
        // Optionally break or handle differently if partial data is acceptable
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
    const currentSeason = 2023; // Use 2023 for NBA/MLB/EPL as per docs/errors

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
        // 1. Fetch All Teams (Basic Info)
        const nbaTeamsUrl = "https://api.balldontlie.io/v1/teams";
        const allTeams = await fetchAllPaginatedData(nbaTeamsUrl, balldontlieApiKey);
        console.log(`Fetched ${allTeams.length} NBA teams basic info.`);

        // 2. Fetch Team Standings (for Win Rate)
        // TODO: Find the correct endpoint for team standings/stats if this isn't it
        const teamStatsMap = new Map(); 
        console.log("Placeholder: Need to implement actual team stats/standings fetch.");
        allTeams.forEach(team => {
            teamStatsMap.set(team.id, {
                win_rate: Math.random() * 0.6 + 0.2, // Random placeholder
                pace: 95 + Math.random() * 10, // Random placeholder
                offensive_rating: 105 + Math.random() * 10, // Random placeholder
                recent_form: "W-L-W-L-W" // Placeholder
            });
        });

        // 3. Upsert NBA Team Stats
        const teamsToUpsert = allTeams.map((team: any) => {
          const stats = teamStatsMap.get(team.id) || {};
          return {
            team_name: `${team.full_name} (${team.abbreviation})`, 
            win_rate: stats.win_rate || 0.5, 
            pace: stats.pace || 100.0, 
            offensive_rating: stats.offensive_rating || 110.0, 
            recent_form: stats.recent_form || "N/A",
          };
        });

        if (teamsToUpsert.length > 0) {
          console.log(`Upserting ${teamsToUpsert.length} NBA teams...`);
          const { error: teamUpsertError } = await supabase
            .from("nba_team_stats")
            .upsert(teamsToUpsert, { onConflict: "team_name" }); 
          if (teamUpsertError) throw teamUpsertError;
          console.log("Successfully upserted NBA team data.");
        } else {
          console.log("No NBA team data to upsert.");
        }

        // 4. Fetch Player Season Averages (General Base Stats)
        const playerAveragesUrl = `https://api.balldontlie.io/v1/season_averages/general?season=${currentSeason}&season_type=regular&type=base`;
        const allPlayerAverages = await fetchAllPaginatedData(playerAveragesUrl, balldontlieApiKey);
        console.log(`Fetched ${allPlayerAverages.length} NBA player season averages.`);

        // 5. Process and Upsert Player Props/Stats
        if (allPlayerAverages && allPlayerAverages.length > 0) { // Check if array exists and is not empty
            console.log("Sample Player Average Data:", JSON.stringify(allPlayerAverages[0], null, 2));
            const playerStatsToUpsert = allPlayerAverages.map((avg: any) => ({
                // Safely access player and team data
                player_name: `${avg.player?.first_name ?? 'Unknown'} ${avg.player?.last_name ?? 'Player'}`, 
                team: avg.player?.team?.abbreviation ?? 'N/A',
                prop_type: 'Season Avg Pts',
                // Safely access stats data
                prop_value: avg.stats?.pts ?? 0,
                analysis: `Avg ${avg.stats?.pts ?? 0} pts in ${avg.stats?.games_played ?? 0} games.`,
                confidence: 3,
            }));

            console.log(`Upserting ${playerStatsToUpsert.length} NBA player prop examples...`);
            const { error: playerUpsertError } = await supabase
                .from("nba_player_props")
                .upsert(playerStatsToUpsert, { onConflict: "player_name, prop_type" });
            if (playerUpsertError) throw playerUpsertError;
            console.log("Successfully upserted NBA player prop examples.");
        } else {
             console.log("No NBA player averages data to process.");
        }
    } catch (nbaError) {
        console.error("NBA data fetch/process error:", nbaError.message);
    }
    console.log("--- Finished NBA Data Fetch ---");

    // --- Fetch NHL Data ---
    console.log("--- Starting NHL Data Fetch ---");
    
    try {
      // Define the NHL season and game type to fetch
      const nhlSeasonYYYYYYYY = "20232024"; // YYYYYYYY format
      const nhlGameType = 2; // 2 for regular season
      // 1. Fetch NHL Standings for team records
      const nhlStandings = await fetchNhlData('/v1/standings/now');
      console.log(`Fetched NHL standings with ${nhlStandings.standings?.length || 0} teams.`);
      
      // 2. Fetch NHL Goalie Stats Leaders for the specified season
      const nhlGoalieStats = await fetchNhlData(`/v1/goalie-stats-leaders/${nhlSeasonYYYYYYYY}/${nhlGameType}`);
      console.log(`Fetched NHL goalie stats for ${nhlSeasonYYYYYYYY} with ${nhlGoalieStats.goalieStatLeaders?.length || 0} categories.`);
      
      // 3. Process and map NHL team data for upsert
      const nhlTeamsToUpsert = [];
      
      if (nhlStandings.standings && nhlStandings.standings.length > 0) {
        for (const team of nhlStandings.standings) {
          let goalieData = null;
          // Safely access goalie stats
          if (nhlGoalieStats.goalieStatLeaders && nhlGoalieStats.goalieStatLeaders.length > 0) {
            const savePctCategory = nhlGoalieStats.goalieStatLeaders.find(
              (category: any) => category.category === 'savePct'
            );
            if (savePctCategory && savePctCategory.leaders && savePctCategory.leaders.length > 0) {
              goalieData = savePctCategory.leaders.find(
                (goalie: any) => goalie.teamAbbrev === team.teamAbbrev
              );
            }
          }
          
          nhlTeamsToUpsert.push({
            team_name: `${team.teamName?.default ?? 'Unknown Team'} (${team.teamAbbrev ?? 'N/A'})`,
            puck_line_trend: team.streakCode || 'N/A',
            goalie_name: goalieData ? `${goalieData.firstName ?? ''} ${goalieData.lastName ?? ''}`.trim() : 'N/A',
            goalie_save_percentage: goalieData?.value ?? null,
            power_play_efficiency: team.powerPlayPct ? parseFloat(team.powerPlayPct) / 100 : null,
          });
        }
      }
      
      // 4. Upsert NHL Team Stats
      if (nhlTeamsToUpsert.length > 0) {
        console.log(`Upserting ${nhlTeamsToUpsert.length} NHL teams...`);
        const { error: nhlTeamUpsertError } = await supabase
          .from("nhl_team_stats")
          .upsert(nhlTeamsToUpsert, { onConflict: "team_name" });
        if (nhlTeamUpsertError) throw nhlTeamUpsertError;
        console.log("Successfully upserted NHL team data.");
      } else {
        console.log("No NHL team data to upsert.");
      }
      
      // 5. Process and map NHL player data for props
      const nhlPlayerPropsToUpsert = [];
      
      // Fetch skater stats for points, goals, etc.
      const nhlSkaterStats = await fetchNhlData(`/v1/skater-stats-leaders/${nhlSeasonYYYYYYYY}/${nhlGameType}`);
      console.log(`Fetched NHL skater stats with ${nhlSkaterStats.categories?.length || 0} categories.`);
      
      // Safely access skater stats
      if (nhlSkaterStats.categories && nhlSkaterStats.categories.length > 0) {
        for (const category of nhlSkaterStats.categories) {
          if (category.leaders && category.leaders.length > 0) {
            // Limit processing to top 10 leaders per category for brevity
            for (const player of category.leaders.slice(0, 10)) {
              nhlPlayerPropsToUpsert.push({
                player_name: `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim(),
                team: player.teamAbbrev ?? 'N/A',
                prop_type: `Season ${category.categoryLabel ?? 'Stat'}`, // Use categoryLabel safely
                prop_value: player.value ?? 0,
                analysis: `${player.value ?? 0} ${category.categoryLabel?.toLowerCase() ?? 'stat'} in ${player.gamesPlayed ?? 0} games.`,
                confidence: Math.min(5, Math.ceil((player.value ?? 0) / 10)), // Calculate confidence safely
              });
            }
          }
        }
      }
      
      // 6. Upsert NHL Player Props
      if (nhlPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${nhlPlayerPropsToUpsert.length} NHL player props...`);
        const { error: nhlPlayerUpsertError } = await supabase
          .from("nhl_player_props")
          .upsert(nhlPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
        if (nhlPlayerUpsertError) throw nhlPlayerUpsertError;
        console.log("Successfully upserted NHL player props.");
      } else {
        console.log("No NHL player props to upsert.");
      }
      
    } catch (nhlError) {
      console.error("NHL data fetch/process error:", nhlError.message);
    }
    
    console.log("--- Finished NHL Data Fetch ---");

    // --- Fetch MLB Data ---
    console.log("--- Starting MLB Data Fetch ---");
    const mlbBaseUrl = "https://api.balldontlie.io/mlb/v1";
    try {
      // 1. Fetch MLB Teams
      const mlbTeamsUrl = `${mlbBaseUrl}/teams`;
      const allMlbTeams = await fetchAllPaginatedData(mlbTeamsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbTeams.length} MLB teams basic info.`);
      const mlbTeamMap = new Map(allMlbTeams.map(team => [team.id, team]));

      // 2. Fetch MLB Team Standings (Requires ALL-STAR tier)
      const mlbStandingsUrl = `${mlbBaseUrl}/standings?season=2023`; // Use 2023 season
      const allMlbStandings = await fetchAllPaginatedData(mlbStandingsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbStandings.length} MLB team standings entries.`);

      // 3. Fetch MLB Player Season Stats (Requires GOAT tier)
      const mlbPlayerStatsUrl = `${mlbBaseUrl}/season_stats?season=${currentSeason}`;
      const allMlbPlayerStats = await fetchAllPaginatedData(mlbPlayerStatsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbPlayerStats.length} MLB player season stats entries.`);

      // 4. Aggregate Player Stats by Team to calculate ERA and AVG
      const teamAggregatedStats = new Map();
      // Check if allMlbPlayerStats exists and is an array
      if (allMlbPlayerStats && Array.isArray(allMlbPlayerStats)) {
          for (const stats of allMlbPlayerStats) {
            // Safely access team id
            if (!stats?.team?.id) continue; // Skip players without a team ID

            const teamId = stats.team.id;
            if (!teamAggregatedStats.has(teamId)) {
              teamAggregatedStats.set(teamId, {
                total_hits: 0,
                total_at_bats: 0,
                total_earned_runs: 0,
                total_innings_pitched: 0.0,
              });
            }
            const teamStats = teamAggregatedStats.get(teamId);

            // Aggregate batting stats safely
            teamStats.total_hits += stats.hits ?? 0;
            teamStats.total_at_bats += stats.at_bats ?? 0;

            // Aggregate pitching stats safely (ensure values are numbers)
            const earnedRuns = parseFloat(stats.earned_runs);
            const inningsPitched = parseFloat(stats.innings_pitched);
            if (!isNaN(earnedRuns)) {
                teamStats.total_earned_runs += earnedRuns;
            }
            if (!isNaN(inningsPitched)) {
                teamStats.total_innings_pitched += inningsPitched;
            }
          }
      } else {
          console.warn("No valid MLB player stats data found for aggregation.");
      }
      console.log(`Aggregated stats for ${teamAggregatedStats.size} MLB teams.`);

      // 5. Data already fetched in step 2

      // 6. Combine Standings and Aggregated Stats, Ensure Uniqueness
      const finalMlbTeamsToUpsertMap = new Map();
      // Check if allMlbStandings exists and is an array
      if (allMlbStandings && Array.isArray(allMlbStandings)) {
          for (const standing of allMlbStandings) {
            const teamInfo = mlbTeamMap.get(standing.team_id);
            // Safely access team info and properties
            if (!teamInfo) continue; // Skip if we don't have basic info for the team

            const teamName = `${teamInfo.display_name ?? 'Unknown'} (${teamInfo.abbreviation ?? 'N/A'})`;
            const aggregated = teamAggregatedStats.get(standing.team_id);

            let teamBattingAverage = null;
            if (aggregated && aggregated.total_at_bats > 0) {
              teamBattingAverage = aggregated.total_hits / aggregated.total_at_bats;
            }

            let teamEra = null;
            if (aggregated && aggregated.total_innings_pitched > 0) {
              teamEra = (aggregated.total_earned_runs / aggregated.total_innings_pitched) * 9;
            }

            // Use teamName as the key to ensure uniqueness
            finalMlbTeamsToUpsertMap.set(teamName, {
              team_name: teamName,
              win_loss_record: `${standing.wins ?? 0}-${standing.losses ?? 0}`,
              batting_average: teamBattingAverage !== null ? parseFloat(teamBattingAverage.toFixed(3)) : null,
              era: teamEra !== null ? parseFloat(teamEra.toFixed(2)) : null,
            });
          }
      } else {
          console.warn("No valid MLB standings data found for processing.");
      }

      const finalMlbTeamsToUpsert = Array.from(finalMlbTeamsToUpsertMap.values());

      // 7. Upsert Combined MLB Team Stats
      if (finalMlbTeamsToUpsert.length > 0) {
        console.log(`Upserting ${finalMlbTeamsToUpsert.length} unique MLB teams stats with aggregated ERA/AVG...`);
        const { error: mlbTeamUpsertError } = await supabase
          .from("mlb_team_stats")
          .upsert(finalMlbTeamsToUpsert, { onConflict: "team_name" });
        if (mlbTeamUpsertError) throw mlbTeamUpsertError;
        console.log("Successfully upserted combined MLB team stats.");
      } else {
        console.log("No combined MLB team stats to upsert.");
      }

      // 8. Process and Upsert MLB Player Props
      const mlbPlayerPropsToUpsert = [];
      // Add check for allMlbPlayerStats existence and length
      if (allMlbPlayerStats && allMlbPlayerStats.length > 0) {
        console.log("Sample MLB Player Stat Data:", JSON.stringify(allMlbPlayerStats[0], null, 2));
        for (const stats of allMlbPlayerStats) {
          // Defensive check: Ensure stats and stats.player exist before accessing properties
          if (!stats || !stats.player) {
            console.warn("Skipping MLB player stat record due to missing player data:", stats);
            continue; // Skip this iteration if essential player data is missing
          }

          // Safely access player name parts using nullish coalescing
          const playerName = `${stats.player.first_name ?? 'Unknown'} ${stats.player.last_name ?? 'Player'}`;
          // Safely access team abbreviation using optional chaining and nullish coalescing
          const teamAbbr = stats.team?.abbreviation ?? 'N/A';

          // Use nullish coalescing for games played/pitched in analysis strings
          const gamesPlayedOrPitched = stats.games_pitched ?? stats.games_played ?? 0;
          const gamesPlayed = stats.games_played ?? 0;
          const gamesPitched = stats.games_pitched ?? 0;


          // Add Pitcher ERA if available
          if (stats.era !== null && stats.era !== undefined) {
             mlbPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season ERA',
                prop_value: stats.era,
                analysis: `ERA: ${stats.era} in ${gamesPlayedOrPitched} games`,
                confidence: 3, // Placeholder confidence
             });
          }
          // Add Batting Average if available
          if (stats.avg !== null && stats.avg !== undefined) {
             mlbPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season AVG',
                prop_value: stats.avg,
                analysis: `AVG: ${stats.avg} in ${gamesPlayed} games`,
                confidence: 3, // Placeholder confidence
             });
          }
           // Add Home Runs if available
          if (stats.hr !== null && stats.hr !== undefined) {
             mlbPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season HR',
                prop_value: stats.hr,
                analysis: `${stats.hr} HR in ${gamesPlayed} games`,
                confidence: 3, // Placeholder confidence
             });
          }
          // Add RBIs if available
          if (stats.rbi !== null && stats.rbi !== undefined) {
             mlbPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season RBI',
                prop_value: stats.rbi,
                analysis: `${stats.rbi} RBI in ${gamesPlayed} games`,
                confidence: 3, // Placeholder confidence
             });
          }
          // Add Pitcher Wins if available
          // Check games_pitched > 0 and safely access wins
          if (gamesPitched > 0 && stats.wins !== null && stats.wins !== undefined) {
             mlbPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season Wins (Pitcher)',
                prop_value: stats.wins,
                analysis: `${stats.wins} Wins in ${gamesPitched} games pitched`,
                confidence: 3, // Placeholder confidence
             });
          }
        }
      }

      if (mlbPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${mlbPlayerPropsToUpsert.length} MLB player props...`);
        // Upsert in chunks to avoid potential payload size limits
        const chunkSize = 500;
        for (let i = 0; i < mlbPlayerPropsToUpsert.length; i += chunkSize) {
            const chunk = mlbPlayerPropsToUpsert.slice(i, i + chunkSize);
            console.log(`Upserting MLB player props chunk ${i / chunkSize + 1}...`);
            const { error: mlbPlayerUpsertError } = await supabase
              .from("mlb_player_props")
              .upsert(chunk, { onConflict: "player_name, prop_type" });
            if (mlbPlayerUpsertError) throw mlbPlayerUpsertError;
        }
        console.log("Successfully upserted MLB player props.");
      } else {
        console.log("No MLB player props to upsert.");
      }

    } catch (mlbError) {
      console.error("MLB data fetch/process error:", mlbError.message);
    }
    console.log("--- Finished MLB Data Fetch ---");

    // --- Fetch EPL Data ---
    console.log("--- Starting EPL Data Fetch ---");
    // Assuming EPL API follows a similar pattern, adjust base URL if needed
    const eplBaseUrl = "https://api.balldontlie.io/epl/v1"; // Placeholder - Verify correct URL
    try {
      // 1. Fetch EPL Teams
      const eplTeamsUrl = `${eplBaseUrl}/teams`;
      const allEplTeams = await fetchAllPaginatedData(eplTeamsUrl, balldontlieApiKey);
      console.log(`Fetched ${allEplTeams.length} EPL teams basic info.`);
      const eplTeamMap = new Map(allEplTeams.map(team => [team.id, team]));

      // 2. Fetch EPL Team Standings (Assuming endpoint exists and user has access)
      // Using currentSeason (e.g., 2023) for consistency, adjust if needed
      const eplStandingsUrl = `${eplBaseUrl}/team-standings?season=${currentSeason}`;
      const allEplStandings = await fetchAllPaginatedData(eplStandingsUrl, balldontlieApiKey);
      console.log(`Fetched ${allEplStandings.length} EPL team standings entries.`);

      // 3. Process and Upsert EPL Team Stats
      const eplTeamsToUpsert = [];
      // Check if allEplStandings exists and is an array
      if (allEplStandings && Array.isArray(allEplStandings)) {
          for (const standing of allEplStandings) {
            const teamInfo = eplTeamMap.get(standing.team_id);
            // Safely access team info and properties
            eplTeamsToUpsert.push({
              team_name: teamInfo ? `${teamInfo.display_name ?? 'Unknown'} (${teamInfo.abbreviation ?? 'N/A'})` : `Unknown Team (${standing.team_id})`,
              points: standing.points ?? 0,
              goal_difference: standing.goal_difference ?? 0,
              form: standing.form ?? 'N/A', // Assuming API provides 'form'
            });
          }
      } else {
          console.warn("No valid EPL standings data found for processing.");
      }

      if (eplTeamsToUpsert.length > 0) {
        console.log(`Upserting ${eplTeamsToUpsert.length} EPL teams stats...`);
        // Use placeholder table name - user needs to confirm/create
        const { error: eplTeamUpsertError } = await supabase
          .from("epl_team_stats") 
          .upsert(eplTeamsToUpsert, { onConflict: "team_name" });
        if (eplTeamUpsertError) throw eplTeamUpsertError;
        console.log("Successfully upserted EPL team stats.");
      } else {
        console.log("No EPL team stats to upsert.");
      }

      // 4. Fetch EPL Player Season Stats (Assuming endpoint exists and user has access)
      const eplPlayerStatsUrl = `${eplBaseUrl}/player-season-stats?season=${currentSeason}`;
      const allEplPlayerStats = await fetchAllPaginatedData(eplPlayerStatsUrl, balldontlieApiKey);
      console.log(`Fetched ${allEplPlayerStats.length} EPL player season stats entries.`);

      // 5. Process and Upsert EPL Player Props
      const eplPlayerPropsToUpsert = [];
      // Check if allEplPlayerStats exists and is an array
      if (allEplPlayerStats && Array.isArray(allEplPlayerStats)) {
        console.log("Sample EPL Player Stat Data:", JSON.stringify(allEplPlayerStats[0], null, 2));
        for (const stats of allEplPlayerStats) {
          // Defensive check: Ensure stats and stats.player exist before accessing properties
          if (!stats || !stats.player) {
            console.warn("Skipping EPL player stat record due to missing player data:", stats);
            continue; // Skip this iteration if essential player data is missing
          }
          // Safely access player name parts using nullish coalescing
          const playerName = `${stats.player.first_name ?? 'Unknown'} ${stats.player.last_name ?? 'Player'}`;
          // Safely access team abbreviation using optional chaining and nullish coalescing
          const teamAbbr = stats.team?.abbreviation ?? 'N/A';
          // Use nullish coalescing for games played
          const gamesPlayed = stats.games_played ?? 0;

          // Add Goals if available
          if (stats.goals !== null && stats.goals !== undefined) {
             eplPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season Goals',
                prop_value: stats.goals,
                analysis: `${stats.goals} Goals in ${gamesPlayed} games`,
                confidence: 3, // Placeholder confidence
             });
          }
          // Add Assists if available
          if (stats.assists !== null && stats.assists !== undefined) {
             eplPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season Assists',
                prop_value: stats.assists,
                analysis: `${stats.assists} Assists in ${gamesPlayed} games`,
                confidence: 3, // Placeholder confidence
             });
          }
          // Add Clean Sheets (Goalkeepers) if available
          if (stats.clean_sheets !== null && stats.clean_sheets !== undefined) {
             eplPlayerPropsToUpsert.push({
                player_name: playerName,
                team: teamAbbr,
                prop_type: 'Season Clean Sheets',
                prop_value: stats.clean_sheets,
                analysis: `${stats.clean_sheets} Clean Sheets in ${gamesPlayed} games`,
                confidence: 3, // Placeholder confidence
             });
          }
        }
      } else {
          console.warn("No valid EPL player stats data found for processing.");
      }

      if (eplPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${eplPlayerPropsToUpsert.length} EPL player props...`);
        // Use placeholder table name - user needs to confirm/create
        const chunkSize = 500;
        for (let i = 0; i < eplPlayerPropsToUpsert.length; i += chunkSize) {
            const chunk = eplPlayerPropsToUpsert.slice(i, i + chunkSize);
            console.log(`Upserting EPL player props chunk ${i / chunkSize + 1}...`);
            const { error: eplPlayerUpsertError } = await supabase
              .from("epl_player_props") 
              .upsert(chunk, { onConflict: "player_name, prop_type" });
            if (eplPlayerUpsertError) throw eplPlayerUpsertError;
        }
        console.log("Successfully upserted EPL player props.");
      } else {
        console.log("No EPL player props to upsert.");
      }

    } catch (eplError) {
      console.error("EPL data fetch/process error:", eplError.message);
      // Don't throw error, just log it, so other sports can continue
    }
    console.log("--- Finished EPL Data Fetch ---");

    // --- TODO: Generate and store Predictions ---
    console.log("--- Generating Predictions (TODO) ---");

    // --- TODO: Generate and store Bets of the Day ---
    console.log("--- Generating Bets of the Day (TODO) ---");

    // Return success response including all sports attempted
    return new Response(JSON.stringify({ message: "Sports data update process completed for NBA, NHL, MLB, and EPL (placeholder)." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Function error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

console.log("update-sports-data function handler registered.");

