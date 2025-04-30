// Import necessary libraries
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { format } from "https://deno.land/std@0.203.0/datetime/format.ts"; // For date formatting

console.log("Initializing update-sports-data function (v36 AI Picks Phase 1)");

// --- Helper Function to fetch paginated data (BallDontLie API) ---
async function fetchAllPaginatedData(url: string, apiKey: string) {
  if (typeof url !== 'string' || !url) {
    console.error(`[fetchAllPaginatedData] Received invalid URL: ${url}`);
    throw new Error(`[fetchAllPaginatedData] Attempted to fetch with an invalid URL.`);
  }

  let allData: any[] = [];
  let nextCursor: string | null = null;
  let page = 1;

  do {
    if (typeof url !== 'string') {
        console.error(`[fetchAllPaginatedData] URL became invalid within loop: ${url}`);
        throw new Error(`[fetchAllPaginatedData] URL became invalid within loop.`);
    }
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
    if (Array.isArray(pageData.data)) {
        allData = allData.concat(pageData.data);
    } else {
        console.warn(`Received non-array data on page ${page} for ${url.split("?")[0]}, stopping pagination.`);
        if (Array.isArray(pageData)) {
            console.log(`Assuming non-paginated array response for ${url.split("?")[0]}`);
            allData = pageData;
        } else {
             console.error(`Received unexpected data structure (not an array or {data: []}) for ${url.split("?")[0]}`);
        }
        break; 
    }
    nextCursor = pageData.meta?.next_cursor;
    page++;
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

// --- Helper function to generate simple AI picks ---
function generatePicksForGame(game: any, league: string, homeStats: any, awayStats: any): any[] {
    const picks = [];
    const gameDate = game.date?.split('T')[0] || format(new Date(), "yyyy-MM-dd");
    const matchup = `${game.away_team?.name || game.awayTeam?.name?.default || 'Away'} vs ${game.home_team?.name || game.homeTeam?.name?.default || 'Home'}`;
    const gameId = game.id?.toString() || `${league}-${gameDate}-${matchup}`;

    // Basic Confidence Logic (Placeholder)
    let confidence = 0.5; // Base confidence
    let explanation = "Based on basic stats comparison.";

    // --- Moneyline Pick (Example: Higher Win Rate) ---
    if (homeStats?.win_rate !== undefined && awayStats?.win_rate !== undefined) {
        const winRateDiff = homeStats.win_rate - awayStats.win_rate;
        const pickTeam = winRateDiff > 0 ? (game.home_team?.name || game.homeTeam?.name?.default) : (game.away_team?.name || game.awayTeam?.name?.default);
        confidence = 0.5 + Math.abs(winRateDiff) * 0.2; // Scale confidence by win rate diff
        explanation = `${pickTeam} has a higher win rate (${(Math.max(homeStats.win_rate, awayStats.win_rate)*100).toFixed(1)}%).`;
        picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'moneyline',
            pick_team: pickTeam,
            pick_value: winRateDiff > 0 ? 'Home ML' : 'Away ML', // Placeholder value
            confidence: Math.min(0.9, Math.max(0.1, confidence)).toFixed(2),
            explanation: explanation,
        });
    }

    // --- Spread Pick (Placeholder - Needs Odds Data) ---
    // This requires actual spread lines which we don't have yet.
    // For now, let's just pick the 'better' team based on win rate to cover a generic spread.
    if (homeStats?.win_rate !== undefined && awayStats?.win_rate !== undefined) {
        const winRateDiff = homeStats.win_rate - awayStats.win_rate;
        const pickTeam = winRateDiff > 0 ? (game.home_team?.name || game.homeTeam?.name?.default) : (game.away_team?.name || game.awayTeam?.name?.default);
        const spreadValue = winRateDiff > 0 ? '-3.5' : '+3.5'; // Generic placeholder spread
        confidence = 0.5 + Math.abs(winRateDiff) * 0.15; // Slightly lower confidence for spread
        explanation = `Predicting ${pickTeam} to cover based on win rate difference.`;
         picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'spread',
            pick_team: pickTeam,
            pick_value: `${pickTeam} ${spreadValue}`,
            confidence: Math.min(0.85, Math.max(0.15, confidence)).toFixed(2),
            explanation: explanation,
        });
    }

    // --- Total Pick (Example: Based on combined Off Rating for NBA) ---
    if (league === 'nba' && homeStats?.offensive_rating !== undefined && awayStats?.offensive_rating !== undefined) {
        const combinedRating = homeStats.offensive_rating + awayStats.offensive_rating;
        const totalLine = 220.5; // Generic placeholder total
        const pickValue = combinedRating > totalLine ? `Over ${totalLine}` : `Under ${totalLine}`;
        confidence = 0.5 + Math.abs(combinedRating - totalLine) * 0.01; // Simple confidence based on diff from line
        explanation = `Combined offensive rating (${combinedRating.toFixed(1)}) compared to placeholder line ${totalLine}.`;
        picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'total',
            pick_team: null, // No team for totals
            pick_value: pickValue,
            confidence: Math.min(0.8, Math.max(0.2, confidence)).toFixed(2),
            explanation: explanation,
        });
    }
    // TODO: Add similar logic for NHL/MLB totals based on relevant stats

    return picks;
}

// --- Main Function Handler ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Configuration ---
    const balldontlieApiKey = "9047df76-eb37-4f81-8586-f7ae336027dc"; 
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const currentSeason = 2023; 
    const nhlSeasonYYYYYYYY = "20232024";
    const nhlGameType = 2; // Regular Season
    const today = format(new Date(), "yyyy-MM-dd");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase environment variables not set.");
    }
    if (!balldontlieApiKey) {
      throw new Error("BallDontLie API key not set.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    console.log("Supabase client created.");

    // --- Fetch All Current Team Stats from Supabase --- 
    const allTeamStats = new Map();
    const leagues = ['nba', 'nhl', 'mlb']; // Add 'epl' back if needed
    for (const league of leagues) {
        const tableName = `${league}_team_stats`;
        console.log(`Fetching current team stats from ${tableName}...`);
        const { data: statsData, error: statsError } = await supabase
            .from(tableName)
            .select('*'); // Fetch all columns for now
        if (statsError) {
            console.error(`Error fetching stats from ${tableName}:`, statsError);
        } else if (statsData) {
            const leagueStatsMap = new Map();
            statsData.forEach(team => {
                // Use a consistent key, e.g., full team name or abbreviation if available and consistent
                // Assuming team_name is like "Team Name (ABV)"
                const teamKey = team.team_name?.match(/\(([^)]+)\)/)?.[1] || team.team_name; // Extract ABV or use full name
                if (teamKey) {
                    leagueStatsMap.set(teamKey.toUpperCase(), team);
                }
            });
            allTeamStats.set(league, leagueStatsMap);
            console.log(`Loaded ${leagueStatsMap.size} team stats for ${league.toUpperCase()}.`);
        }
    }

    // --- [v36] Fetch Schedules and Generate AI Picks --- 
    console.log("--- Starting AI Picks Generation (Phase 1) ---");
    let allGeneratedPicks: any[] = [];
    try {
        // --- NBA Schedule & Picks ---
        const nbaBaseUrl = "https://api.balldontlie.io/v1";
        const nbaScheduleUrl = `${nbaBaseUrl}/games?dates[]=${today}`;
        const nbaTeamStatsMap = allTeamStats.get('nba') || new Map();
        console.log(`Fetching NBA schedule for ${today}...`);
        const nbaGames = await fetchAllPaginatedData(nbaScheduleUrl, balldontlieApiKey);
        console.log(`Fetched ${nbaGames.length} NBA games for today.`);
        for (const game of nbaGames) {
            const homeTeamKey = game.home_team?.abbreviation?.toUpperCase();
            const awayTeamKey = game.visitor_team?.abbreviation?.toUpperCase();
            if (homeTeamKey && awayTeamKey) {
                const homeStats = nbaTeamStatsMap.get(homeTeamKey);
                const awayStats = nbaTeamStatsMap.get(awayTeamKey);
                if (homeStats && awayStats) {
                    const gamePicks = generatePicksForGame(game, 'nba', homeStats, awayStats);
                    allGeneratedPicks = allGeneratedPicks.concat(gamePicks);
                } else {
                    console.warn(`Missing stats for NBA game: ${awayTeamKey} @ ${homeTeamKey}`);
                }
            }
        }

        // --- MLB Schedule & Picks ---
        const mlbBaseUrl = "https://api.balldontlie.io/mlb/v1";
        const mlbScheduleUrl = `${mlbBaseUrl}/games?dates[]=${today}`;
        const mlbTeamStatsMap = allTeamStats.get('mlb') || new Map();
        console.log(`Fetching MLB schedule for ${today}...`);
        const mlbGames = await fetchAllPaginatedData(mlbScheduleUrl, balldontlieApiKey);
        console.log(`Fetched ${mlbGames.length} MLB games for today.`);
         for (const game of mlbGames) {
            // MLB API uses 'home_team_name' and 'away_team_name', need abbreviation mapping if stats use it
            // Assuming stats map uses abbreviation key like NBA
            const homeTeamKey = game.home_team?.abbreviation?.toUpperCase(); 
            const awayTeamKey = game.away_team?.abbreviation?.toUpperCase();
             if (homeTeamKey && awayTeamKey) {
                const homeStats = mlbTeamStatsMap.get(homeTeamKey);
                const awayStats = mlbTeamStatsMap.get(awayTeamKey);
                if (homeStats && awayStats) {
                    // Need to adapt generatePicksForGame for MLB stats (e.g., ERA, AVG)
                    const gamePicks = generatePicksForGame(game, 'mlb', homeStats, awayStats); 
                    allGeneratedPicks = allGeneratedPicks.concat(gamePicks);
                } else {
                     console.warn(`Missing stats for MLB game: ${awayTeamKey} @ ${homeTeamKey}`);
                }
            }
        }

        // --- NHL Schedule & Picks ---
        const nhlScheduleUrl = `/v1/schedule/${today}`;
        const nhlTeamStatsMap = allTeamStats.get('nhl') || new Map();
        console.log(`Fetching NHL schedule for ${today}...`);
        const nhlScheduleData = await fetchNhlData(nhlScheduleUrl);
        const nhlGames = nhlScheduleData?.gameWeek?.[0]?.games || []; // Path might vary, adjust based on actual response
        console.log(`Fetched ${nhlGames.length} NHL games for today.`);
        for (const game of nhlGames) {
             const homeTeamKey = game.homeTeam?.abbrev?.toUpperCase();
             const awayTeamKey = game.awayTeam?.abbrev?.toUpperCase();
             if (homeTeamKey && awayTeamKey) {
                const homeStats = nhlTeamStatsMap.get(homeTeamKey);
                const awayStats = nhlTeamStatsMap.get(awayTeamKey);
                if (homeStats && awayStats) {
                    // Need to adapt generatePicksForGame for NHL stats (e.g., Save %, PP%)
                    const gamePicks = generatePicksForGame(game, 'nhl', homeStats, awayStats);
                    allGeneratedPicks = allGeneratedPicks.concat(gamePicks);
                } else {
                     console.warn(`Missing stats for NHL game: ${awayTeamKey} @ ${homeTeamKey}`);
                }
            }
        }

        // --- Upsert Generated Picks ---
        if (allGeneratedPicks.length > 0) {
            console.log(`Upserting ${allGeneratedPicks.length} AI picks...`);
            // Clear old picks for today before inserting new ones?
            // Optional: Delete old picks for the current date first
            const { error: deleteError } = await supabase
                .from('ai_picks')
                .delete()
                .eq('game_date', today);
            if (deleteError) {
                console.error("Error deleting old AI picks:", deleteError);
            } else {
                console.log(`Deleted old picks for ${today}.`);
            }

            const { error: picksUpsertError } = await supabase
                .from("ai_picks")
                .upsert(allGeneratedPicks);
            if (picksUpsertError) throw picksUpsertError;
            console.log("Successfully upserted AI picks.");
        } else {
            console.log("No AI picks generated for today.");
        }

    } catch (picksError) {
        console.error("AI Picks generation/upsert error:", picksError.message);
    }
    console.log("--- Finished AI Picks Generation ---");

    // --- [Keep Existing Data Fetching Logic Below] ---
    // ... (NBA, NHL, MLB data fetching/processing code remains here) ...
    // --- Fetch NBA Data ---
    console.log("--- Starting NBA Data Fetch ---");
    try {
        const nbaBaseUrl = "https://api.balldontlie.io/v1";
        const nbaTeamsUrl = `${nbaBaseUrl}/teams`;
        const allTeams = await fetchAllPaginatedData(nbaTeamsUrl, balldontlieApiKey);
        console.log(`Fetched ${allTeams.length} NBA teams basic info.`);
        
        // Fetch actual NBA team stats/standings (replace placeholder)
        // Example: Fetch standings (might require paid tier or different endpoint)
        // For now, using placeholder stats again for demonstration
        const teamStatsMap = new Map(); 
        allTeams.forEach(team => {
            teamStatsMap.set(team.id, {
                win_rate: Math.random() * 0.6 + 0.2, 
                pace: 95 + Math.random() * 10, 
                offensive_rating: 105 + Math.random() * 10, 
                recent_form: "W-L-W-L-W" 
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
    }
    console.log("--- Finished NBA Data Fetch ---");

    // --- Fetch NHL Data ---
    console.log("--- Starting NHL Data Fetch ---");
    try {
      // Fetch NHL Standings
      const nhlStandingsData = await fetchNhlData('/v1/standings/now');
      console.log(`Fetched NHL standings with ${nhlStandingsData.standings?.length || 0} teams.`);

      // Fetch NHL Goalie Stats (for Save Percentage)
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
      } else {
        console.log("No NHL team data to upsert.");
      }

      // Fetch NHL Player Props (Top Skater Stats)
      const nhlPlayerPropsMap = new Map(); 
      const nhlSkaterStatsData = await fetchNhlData(`/v1/skater-stats-leaders/${nhlSeasonYYYYYYYY}/${nhlGameType}`);
      console.log(`Fetched NHL skater stats with ${nhlSkaterStatsData.categories?.length || 0} categories.`);

      if (nhlSkaterStatsData.categories && nhlSkaterStatsData.categories.length > 0) {
        for (const category of nhlSkaterStatsData.categories) {
          if (category.leaders && category.leaders.length > 0) {
            for (const player of category.leaders.slice(0, 10)) { 
              const playerName = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
              const propType = `Season ${category.categoryLabel ?? 'Stat'}`; 
              const uniqueKey = `${playerName}-${propType}`;

              const propData = {
                player_name: playerName,
                team: player.teamAbbrev ?? 'N/A',
                prop_type: propType,
                prop_value: player.value ?? 0,
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
      } else {
        console.log("No NHL player props to upsert.");
      }

    } catch (nhlError) {
        console.error("NHL data fetch/process error:", nhlError.message);
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

      const mlbStandingsMap = new Map();
      allMlbStandings.forEach(standing => {
          const abbreviation = standing.team?.abbreviation?.trim().toUpperCase(); 
          if (abbreviation) {
              mlbStandingsMap.set(abbreviation, standing);
          } else {
              console.warn(`MLB Standing object missing team abbreviation. Standing object: ${JSON.stringify(standing)}`);
          }
      });
       console.log(`Created MLB standings map with ${mlbStandingsMap.size} entries keyed by abbreviation.`);

      // Fetch MLB Player Season Stats
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

            const earnedRuns = parseFloat(stats.pitching_er);
            const inningsPitchedStr = stats.pitching_ip;
            let inningsPitchedNum = 0.0;
            if (inningsPitchedStr) {
                const parts = inningsPitchedStr.split('.');
                const wholeInnings = parseInt(parts[0]) || 0;
                const partialInnings = parseInt(parts[1]) || 0;
                inningsPitchedNum = wholeInnings + (partialInnings / 3.0);
            }
            if (!isNaN(earnedRuns)) {
                teamStats.total_earned_runs += earnedRuns;
            }
            if (!isNaN(inningsPitchedNum)) {
                teamStats.total_innings_pitched += inningsPitchedNum;
            }
          }
          console.log(`Finished aggregating MLB player stats for ${teamAggregatedStats.size} teams.`);
      } else {
          console.log("No MLB player stats data found or data is not an array.");
      }

      // Combine Standings with Aggregated Stats
      const mlbTeamsToUpsert = [];
      console.log("Combining MLB standings with aggregated stats...");
      for (const [abbreviation, team] of mlbTeamMap.entries()) {
          const standing = mlbStandingsMap.get(abbreviation);
          const aggregated = teamAggregatedStats.get(abbreviation);

          if (!standing) {
              console.warn(`No standing found for MLB team ${abbreviation}, skipping.`);
              continue;
          }

          const teamData = {
              team_name: `${team.display_name} (${abbreviation})`,
              win_loss_record: `${standing.wins ?? 0}-${standing.losses ?? 0}`,
              era: (aggregated && aggregated.total_innings_pitched > 0) 
                   ? (aggregated.total_earned_runs * 9 / aggregated.total_innings_pitched).toFixed(2) 
                   : null,
              batting_average: (aggregated && aggregated.total_at_bats > 0) 
                             ? (aggregated.total_hits / aggregated.total_at_bats).toFixed(3) 
                             : null,
          };
          mlbTeamsToUpsert.push(teamData);
      }
      console.log(`Prepared ${mlbTeamsToUpsert.length} MLB teams for upsert.`);

      if (mlbTeamsToUpsert.length > 0) {
        console.log(`Upserting ${mlbTeamsToUpsert.length} MLB teams...`);
        const { error: mlbTeamUpsertError } = await supabase.from("mlb_team_stats").upsert(mlbTeamsToUpsert, { onConflict: "team_name" });
        if (mlbTeamUpsertError) throw mlbTeamUpsertError;
        console.log("Successfully upserted MLB team data.");
      } else {
        console.log("No MLB team data to upsert.");
      }

      // Process MLB Player Props (Using Season Stats)
      const mlbPlayerPropsMap = new Map(); // Use Map for uniqueness
      if (allMlbPlayerStats && Array.isArray(allMlbPlayerStats)) {
          console.log("Processing MLB player props...");
          for (const stats of allMlbPlayerStats) {
              const playerName = `${stats.player?.first_name ?? 'Unknown'} ${stats.player?.last_name ?? 'Player'}`;
              const teamAbbreviation = stats.player?.team?.abbreviation ?? 'N/A';

              // Example Prop 1: Hits
              if (stats.batting_h !== undefined && stats.batting_h > 0) { // Only add if stat exists
                  const propTypeHits = 'Season Hits';
                  const uniqueKeyHits = `${playerName}-${propTypeHits}`;
                  mlbPlayerPropsMap.set(uniqueKeyHits, {
                      player_name: playerName,
                      team: teamAbbreviation,
                      prop_type: propTypeHits,
                      prop_value: stats.batting_h,
                      analysis: `${stats.batting_h} hits in ${stats.games_played ?? 0} games.`,
                      confidence: Math.min(5, Math.ceil((stats.batting_h ?? 0) / 10)),
                  });
              }
              
              // Example Prop 2: ERA (for pitchers)
              const earnedRuns = parseFloat(stats.pitching_er);
              const inningsPitchedStr = stats.pitching_ip;
              let inningsPitchedNum = 0.0;
              if (inningsPitchedStr) {
                  const parts = inningsPitchedStr.split('.');
                  const wholeInnings = parseInt(parts[0]) || 0;
                  const partialInnings = parseInt(parts[1]) || 0;
                  inningsPitchedNum = wholeInnings + (partialInnings / 3.0);
              }
              if (!isNaN(earnedRuns) && inningsPitchedNum > 0) { // Only add if valid ERA can be calculated
                  const era = (earnedRuns * 9 / inningsPitchedNum);
                  const propTypeERA = 'Season ERA';
                  const uniqueKeyERA = `${playerName}-${propTypeERA}`;
                  mlbPlayerPropsMap.set(uniqueKeyERA, {
                      player_name: playerName,
                      team: teamAbbreviation,
                      prop_type: propTypeERA,
                      prop_value: era.toFixed(2),
                      analysis: `ERA of ${era.toFixed(2)} over ${inningsPitchedNum.toFixed(1)} innings.`,
                      confidence: Math.max(1, 5 - Math.floor(era)), // Lower ERA = higher confidence (simple)
                  });
              }
          }
          console.log(`Generated ${mlbPlayerPropsMap.size} unique MLB player props.`);
      }
      const mlbPlayerPropsToUpsert = Array.from(mlbPlayerPropsMap.values());

      if (mlbPlayerPropsToUpsert.length > 0) {
        console.log(`Upserting ${mlbPlayerPropsToUpsert.length} unique MLB player props...`);
        const { error: mlbPlayerUpsertError } = await supabase.from("mlb_player_props").upsert(mlbPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
        if (mlbPlayerUpsertError) throw mlbPlayerUpsertError;
        console.log("Successfully upserted MLB player props.");
      } else {
        console.log("No MLB player props to upsert.");
      }

    } catch (mlbError) {
        console.error("MLB data fetch/process error:", mlbError.message);
    }
    console.log("--- Finished MLB Data Fetch ---");

    // --- [v35] Fetch EPL Data (Direct Fetch for Teams) ---
    // --- [v36] Skipping EPL for now ---
    /*
    console.log("--- Starting EPL Data Fetch (v35 Direct Teams) ---");
    const eplBaseUrl = "https://api.balldontlie.io/epl/v1";
    try {
        // Fetch EPL Teams (Direct Fetch - v35)
        const eplTeamsUrl = `${eplBaseUrl}/teams`; // No season or per_page
        console.log(`Fetching EPL teams directly from ${eplTeamsUrl}...`);
        const eplTeamsResponse = await fetch(eplTeamsUrl, {
            headers: { "Authorization": balldontlieApiKey },
        });
        if (!eplTeamsResponse.ok) {
            throw new Error(`HTTP error! status: ${eplTeamsResponse.status} - ${await eplTeamsResponse.text()} fetching ${eplTeamsUrl}`);
        }
        const eplTeamsData = await eplTeamsResponse.json();
        const allEplTeams = Array.isArray(eplTeamsData?.data) ? eplTeamsData.data : (Array.isArray(eplTeamsData) ? eplTeamsData : []);
        console.log(`Fetched ${allEplTeams.length} EPL teams basic info directly.`);

        // Create EPL Team Map
        const eplTeamMap = new Map();
        allEplTeams.forEach(team => {
            if (team.id) {
                eplTeamMap.set(team.id, team);
            } else {
                console.warn(`EPL Team object missing ID: ${JSON.stringify(team)}`);
            }
        });
        console.log(`Created EPL team map with ${eplTeamMap.size} entries.`);

        // Fetch EPL Standings (Using helper, assuming pagination works here)
        const eplStandingsUrl = `${eplBaseUrl}/standings?season=${eplSeason}`;
        const allEplStandings = await fetchAllPaginatedData(eplStandingsUrl, balldontlieApiKey);
        console.log(`Fetched ${allEplStandings.length} EPL team standings entries.`);

        // Combine Standings and Team Info
        const eplTeamsToUpsert = [];
        for (const standing of allEplStandings) {
            const teamInfo = eplTeamMap.get(standing.team_id);
            if (teamInfo) {
                eplTeamsToUpsert.push({
                    team_name: `${teamInfo.name} (${teamInfo.short_code || 'N/A'})`,
                    wins: standing.wins ?? 0,
                    losses: standing.losses ?? 0,
                    goals_for: standing.goals_for ?? 0,
                    goals_against: standing.goals_against ?? 0,
                    points: standing.points ?? 0,
                });
            } else {
                console.warn(`No team info found for EPL standing team ID: ${standing.team_id}`);
            }
        }

        if (eplTeamsToUpsert.length > 0) {
            console.log(`Upserting ${eplTeamsToUpsert.length} EPL teams...`);
            const { error: eplTeamUpsertError } = await supabase.from("epl_team_stats").upsert(eplTeamsToUpsert, { onConflict: "team_name" });
            if (eplTeamUpsertError) throw eplTeamUpsertError;
            console.log("Successfully upserted EPL team data.");
        } else {
            console.log("No EPL team data to upsert.");
        }

        // Fetch EPL Player Stats (Using helper)
        const eplPlayerStatsUrl = `${eplBaseUrl}/player_stats?season=${eplSeason}`;
        const allEplPlayerStats = await fetchAllPaginatedData(eplPlayerStatsUrl, balldontlieApiKey);
        console.log(`Fetched ${allEplPlayerStats.length} EPL player stats entries.`);

        // Process EPL Player Props (Example: Top Scorers)
        const eplPlayerPropsMap = new Map();
        if (allEplPlayerStats && Array.isArray(allEplPlayerStats)) {
            // Sort by goals and take top 20
            allEplPlayerStats.sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0));
            for (const stats of allEplPlayerStats.slice(0, 20)) {
                const playerName = `${stats.player?.first_name ?? 'Unknown'} ${stats.player?.last_name ?? 'Player'}`;
                const teamInfo = eplTeamMap.get(stats.team_id);
                const teamAbbreviation = teamInfo?.short_code ?? 'N/A';
                const propType = 'Season Goals';
                const uniqueKey = `${playerName}-${propType}`;

                if (stats.goals > 0) { // Only add players with goals
                    eplPlayerPropsMap.set(uniqueKey, {
                        player_name: playerName,
                        team: teamAbbreviation,
                        prop_type: propType,
                        prop_value: stats.goals,
                        analysis: `${stats.goals} goals in ${stats.appearances ?? 0} appearances.`,
                        confidence: Math.min(5, Math.ceil((stats.goals ?? 0) / 5)),
                    });
                }
            }
        }
        const eplPlayerPropsToUpsert = Array.from(eplPlayerPropsMap.values());

        if (eplPlayerPropsToUpsert.length > 0) {
            console.log(`Upserting ${eplPlayerPropsToUpsert.length} unique EPL player props (top scorers)...`);
            const { error: eplPlayerUpsertError } = await supabase.from("epl_player_props").upsert(eplPlayerPropsToUpsert, { onConflict: "player_name, prop_type" });
            if (eplPlayerUpsertError) throw eplPlayerUpsertError;
            console.log("Successfully upserted EPL player props.");
        } else {
            console.log("No EPL player props to upsert.");
        }

    } catch (eplError) {
        console.error("EPL data fetch/process error:", eplError.message);
    }
    console.log("--- Finished EPL Data Fetch ---");
    */

    // --- Final Response ---
    console.log("Function execution completed successfully.");
    return new Response(JSON.stringify({ message: "Sports data update process finished." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Unhandled error in function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

