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
    allData = allData.concat(pageData.data);
    nextCursor = pageData.meta?.next_cursor;
    page++;

    // Add a small delay to avoid hitting rate limits too quickly
    await new Promise(resolve => setTimeout(resolve, 200)); 

  } while (nextCursor);

  return allData;
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
    const currentSeason = 2023; // TODO: Make this dynamic or configurable

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
    // 1. Fetch All Teams (Basic Info)
    const nbaTeamsUrl = "https://api.balldontlie.io/v1/teams";
    const allTeams = await fetchAllPaginatedData(nbaTeamsUrl, balldontlieApiKey);
    console.log(`Fetched ${allTeams.length} NBA teams basic info.`);

    // 2. Fetch Team Standings (for Win Rate)
    // Note: This endpoint seems to be per season, need to confirm structure
    // Assuming a structure that gives wins/losses per team
    // TODO: Find the correct endpoint for team standings/stats if this isn't it
    // Placeholder: Fetching basic team data again, need to replace with actual standings/stats endpoint
    const teamStatsMap = new Map(); 
    // Example: Fetching standings might look like:
    // const standingsUrl = `https://api.balldontlie.io/v1/standings?season=${currentSeason}`;
    // const standingsData = await fetchAllPaginatedData(standingsUrl, balldontlieApiKey);
    // Process standingsData to populate teamStatsMap with win_rate, etc.
    console.log("Placeholder: Need to implement actual team stats/standings fetch.");
    // For now, use placeholders for team stats
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
        // Add balldontlie team ID for easier linking if needed
        // balldontlie_id: team.id 
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
    // TODO: Decide if this goes into nba_player_props or a new nba_player_stats table
    // For now, logging the structure of the first player's stats
    if (allPlayerAverages.length > 0) {
        console.log("Sample Player Average Data:", JSON.stringify(allPlayerAverages[0], null, 2));
        // Example processing (adapt based on actual needs and table structure)
        const playerStatsToUpsert = allPlayerAverages.map((avg: any) => ({
            player_name: `${avg.player.first_name} ${avg.player.last_name}`, 
            team: avg.player.team?.abbreviation || 'N/A', // Assuming team info is nested
            prop_type: 'Season Avg Pts', // Example prop type
            prop_value: avg.stats?.pts || 0, // Example: Points per game
            analysis: `Avg ${avg.stats?.pts || 0} pts in ${avg.stats?.games_played || 0} games.`, // Example analysis
            confidence: 3, // Placeholder confidence
            // Add other stats like assists (ast), rebounds (reb), fg_pct etc.
            // balldontlie_player_id: avg.player.id
        }));

        console.log(`Upserting ${playerStatsToUpsert.length} NBA player prop examples...`);
        // Upsert into nba_player_props (adjust table/columns as needed)
        const { error: playerUpsertError } = await supabase
            .from("nba_player_props") // Adjust table name if needed
            .upsert(playerStatsToUpsert, { onConflict: "player_name, prop_type" }); // Example conflict columns
        if (playerUpsertError) throw playerUpsertError;
        console.log("Successfully upserted NBA player prop examples.");
    }

    console.log("--- Finished NBA Data Fetch ---");

    // --- Fetch NHL Data ---
    console.log("--- Starting NHL Data Fetch ---");
    
    // Helper function to fetch data from NHL API
    async function fetchNhlData(endpoint: string) {
      console.log(`Fetching NHL data from ${endpoint}...`);
      const response = await fetch(`https://api-web.nhle.com${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`NHL API HTTP error! status: ${response.status} - ${await response.text()} fetching ${endpoint}`);
      }
      
      return await response.json();
    }
    
    try {
      // 1. Fetch NHL Standings for team records
      const nhlStandings = await fetchNhlData('/v1/standings/now');
      console.log(`Fetched NHL standings with ${nhlStandings.standings?.length || 0} teams.`);
      
      // 2. Fetch NHL Goalie Stats Leaders
      const nhlGoalieStats = await fetchNhlData('/v1/goalie-stats-leaders/current');
      console.log(`Fetched NHL goalie stats with ${nhlGoalieStats.goalieStatLeaders?.length || 0} categories.`);
      
      // 3. Process and map NHL team data for upsert
      const nhlTeamsToUpsert = [];
      
      if (nhlStandings.standings && nhlStandings.standings.length > 0) {
        // Map standings data to team stats
        for (const team of nhlStandings.standings) {
          // Find goalie data for this team if available
          let goalieData = null;
          if (nhlGoalieStats.goalieStatLeaders && nhlGoalieStats.goalieStatLeaders.length > 0) {
            // Look for save percentage category
            const savePctCategory = nhlGoalieStats.goalieStatLeaders.find(
              (category: any) => category.category === 'savePct'
            );
            
            if (savePctCategory && savePctCategory.leaders && savePctCategory.leaders.length > 0) {
              // Find a goalie from this team
              goalieData = savePctCategory.leaders.find(
                (goalie: any) => goalie.teamAbbrev === team.teamAbbrev
              );
            }
          }
          
          nhlTeamsToUpsert.push({
            team_name: `${team.teamName.default} (${team.teamAbbrev})`,
            puck_line_trend: team.streakCode || 'N/A', // Using streak as a proxy for puck line trend
            goalie_name: goalieData ? goalieData.firstName + ' ' + goalieData.lastName : 'N/A',
            goalie_save_percentage: goalieData ? goalieData.value : null,
            power_play_efficiency: team.powerPlayPct ? parseFloat(team.powerPlayPct) / 100 : null, // Convert percentage to decimal
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
      const nhlSkaterStats = await fetchNhlData('/v1/skater-stats-leaders/current?categories=points,goals,assists&limit=50');
      console.log(`Fetched NHL skater stats with ${nhlSkaterStats.categories?.length || 0} categories.`);
      
      if (nhlSkaterStats.categories && nhlSkaterStats.categories.length > 0) {
        // Process each category (points, goals, assists)
        for (const category of nhlSkaterStats.categories) {
          if (category.leaders && category.leaders.length > 0) {
            // Take top players from each category
            for (const player of category.leaders.slice(0, 10)) { // Top 10 players per category
              nhlPlayerPropsToUpsert.push({
                player_name: `${player.firstName} ${player.lastName}`,
                team: player.teamAbbrev || 'N/A',
                prop_type: `Season ${category.categoryLabel}`,
                prop_value: player.value,
                analysis: `${player.value} ${category.categoryLabel.toLowerCase()} in ${player.gamesPlayed} games.`,
                confidence: Math.min(5, Math.ceil(player.value / 10)), // Simple confidence calculation based on value
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
      console.error("NHL data fetch error:", nhlError.message);
      // Continue with other sports even if NHL fails
    }
    
    console.log("--- Finished NHL Data Fetch ---");

    // --- Fetch MLB Data ---
    console.log("--- Starting MLB Data Fetch ---");
    
    try {
      // 1. Fetch MLB Teams (Basic Info)
      // Assuming endpoint structure similar to NBA
      const mlbTeamsUrl = "https://api.balldontlie.io/v1/mlb/teams"; 
      const allMlbTeams = await fetchAllPaginatedData(mlbTeamsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbTeams.length} MLB teams basic info.`);
      
      // 2. Fetch MLB Team Stats (Standings, ERA, Batting Avg)
      // TODO: Find the correct endpoint for MLB team stats (ERA, batting avg, etc.)
      // Placeholder: Using random data for now
      const mlbTeamStatsMap = new Map();
      allMlbTeams.forEach(team => {
        mlbTeamStatsMap.set(team.id, {
          era: (Math.random() * 3 + 2.5).toFixed(2), // Random ERA between 2.50 and 5.50
          batting_average: (Math.random() * 0.05 + 0.230).toFixed(3), // Random AVG between .230 and .280
          recent_form: "W-L-W-W-L" // Placeholder
        });
      });
      console.log("Placeholder: Need to implement actual MLB team stats fetch.");
      
      // 3. Upsert MLB Team Stats
      const mlbTeamsToUpsert = allMlbTeams.map((team: any) => {
        const stats = mlbTeamStatsMap.get(team.id) || {};
        return {
          team_name: `${team.full_name} (${team.abbreviation})`, 
          era: stats.era || 4.00,
          batting_average: stats.batting_average || 0.250,
          recent_form: stats.recent_form || "N/A",
        };
      });
      
      if (mlbTeamsToUpsert.length > 0) {
        console.log(`Upserting ${mlbTeamsToUpsert.length} MLB teams...`);
        // Ensure UNIQUE constraint exists on team_name in mlb_team_stats table
        const { error: mlbTeamUpsertError } = await supabase
          .from("mlb_team_stats")
          .upsert(mlbTeamsToUpsert, { onConflict: "team_name" }); 
        if (mlbTeamUpsertError) throw mlbTeamUpsertError;
        console.log("Successfully upserted MLB team data.");
      } else {
        console.log("No MLB team data to upsert.");
      }
      
      // 4. Fetch MLB Player Stats (Pitcher ERA, Batter Stats)
      // TODO: Find the correct endpoint for MLB player stats (pitcher ERA, batter HR/AVG, etc.)
      // Placeholder: Fetching NBA player averages again as a placeholder structure
      const mlbPlayerStatsUrl = `https://api.balldontlie.io/v1/mlb/season_averages/general?season=${currentSeason}&season_type=regular&type=base`;
      const allMlbPlayerStats = await fetchAllPaginatedData(mlbPlayerStatsUrl, balldontlieApiKey);
      console.log(`Fetched ${allMlbPlayerStats.length} MLB player stats examples (using placeholder endpoint).`);
      console.log("Placeholder: Need to implement actual MLB player stats fetch.");
      
      // 5. Process and Upsert MLB Player Props
      const mlbPlayerPropsToUpsert = [];
      if (allMlbPlayerStats.length > 0) {
        // Example processing (adapt based on actual MLB stats structure)
        allMlbPlayerStats.slice(0, 50).forEach((avg: any) => { // Limit processing for example
          // Example Pitcher Prop (ERA)
          if (avg.stats?.era) { // Check if ERA exists (placeholder)
             mlbPlayerPropsToUpsert.push({
                player_name: `${avg.player.first_name} ${avg.player.last_name} (P)`, 
                team: avg.player.team?.abbreviation || 'N/A',
                prop_type: 'Season ERA',
                prop_value: avg.stats.era,
                analysis: `ERA: ${avg.stats.era} in ${avg.stats.games_pitched || 0} games.`, 
                confidence: 3, // Placeholder
             });
          }
          // Example Batter Prop (Home Runs)
          if (avg.stats?.hr) { // Check if HR exists (placeholder)
             mlbPlayerPropsToUpsert.push({
                player_name: `${avg.player.first_name} ${avg.player.last_name} (B)`, 
                team: avg.player.team?.abbreviation || 'N/A',
                prop_type: 'Season HR',
                prop_value: avg.stats.hr,
                analysis: `${avg.stats.hr} HR in ${avg.stats.games_played || 0} games.`, 
                confidence: 3, // Placeholder
             });
          }
        });
      }
      
      // 6. Upsert MLB Player Props
      if (mlbPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${mlbPlayerPropsToUpsert.length} MLB player props...`);
        // Ensure UNIQUE constraint exists on player_name, prop_type in mlb_player_props table
        const { error: mlbPlayerUpsertError } = await supabase
          .from("mlb_player_props")
          .upsert(mlbPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
        if (mlbPlayerUpsertError) throw mlbPlayerUpsertError;
        console.log("Successfully upserted MLB player props.");
      } else {
        console.log("No MLB player props to upsert.");
      }
      
    } catch (mlbError) {
      console.error("MLB data fetch error:", mlbError.message);
      // Continue with other processes even if MLB fails
    }
    
    console.log("--- Finished MLB Data Fetch ---");

    // --- TODO: Generate and store Predictions ---
    console.log("--- Generating Predictions (TODO) ---");
    // Implement prediction logic based on fetched stats

    // --- TODO: Generate and store Bets of the Day ---
    console.log("--- Generating Bets of the Day (TODO) ---");
    // Implement logic to select top bets

    // Return success response
    return new Response(JSON.stringify({ message: "Sports data update process completed for NBA, NHL, MLB (partially)." }), {
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

