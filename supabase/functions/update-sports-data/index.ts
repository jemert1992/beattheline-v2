// Import necessary libraries
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { format } from "https://deno.land/std@0.203.0/datetime/format.ts"; // For date formatting

console.log("Initializing update-sports-data function (v38 Improved Analysis)");

// --- Helper Function to fetch paginated data (BallDontLie API) ---
async function fetchAllPaginatedData(url: string, apiKey: string) {
  // ... (omitted for brevity - same as v37)
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
    // console.log(`Fetching page ${page} from ${currentUrl.split("?")[0]}...`); // Less verbose logging
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
  // ... (omitted for brevity - same as v37)
  console.log(`Fetching NHL data from ${endpoint}...`);
  const response = await fetch(`https://api-web.nhle.com${endpoint}`);
  if (!response.ok) {
    throw new Error(`NHL API HTTP error! status: ${response.status} - ${await response.text()} fetching ${endpoint}`);
  }
  return await response.json();
}

// --- [v38] Helper function to generate AI picks with improved analysis ---
function generatePicksForGame(game: any, league: string, homeStats: any, awayStats: any): any[] {
    const picks = [];
    const gameDate = game.date?.split("T")[0] || format(new Date(), "yyyy-MM-dd");
    
    let homeTeamName: string | undefined;
    let awayTeamName: string | undefined;
    let homeTeamAbbr: string | undefined;
    let awayTeamAbbr: string | undefined;

    if (league === 'nba' || league === 'mlb') { 
        homeTeamName = game.home_team?.full_name;
        awayTeamName = game.visitor_team?.full_name;
        homeTeamAbbr = game.home_team?.abbreviation;
        awayTeamAbbr = game.visitor_team?.abbreviation;
    } else if (league === 'nhl') { 
        homeTeamName = game.homeTeam?.name?.default;
        awayTeamName = game.awayTeam?.name?.default;
        homeTeamAbbr = game.homeTeam?.abbrev;
        awayTeamAbbr = game.awayTeam?.abbrev;
    }

    homeTeamName = homeTeamName || homeTeamAbbr || 'Home';
    awayTeamName = awayTeamName || awayTeamAbbr || 'Away';

    const matchup = `${awayTeamName} vs ${homeTeamName}`;
    const gameId = game.id?.toString() || `${league}-${gameDate}-${awayTeamName}-${homeTeamName}`;

    let confidence = 0.5; 
    let explanation = "Based on basic stats comparison.";

    // --- Moneyline Pick (Improved Analysis) ---
    if (homeStats && awayStats) {
        let mlConfidence = 0.5;
        let mlExplanation = "Analysis pending.";
        let pickTeamName = homeTeamName; // Default to home
        let pickValue = `Home ML (${homeTeamAbbr || homeTeamName})`;

        if (league === 'nba' && homeStats.win_rate !== undefined && awayStats.win_rate !== undefined) {
            const winRateDiff = homeStats.win_rate - awayStats.win_rate;
            pickTeamName = winRateDiff > 0 ? homeTeamName : awayTeamName;
            pickValue = winRateDiff > 0 ? `Home ML (${homeTeamAbbr || homeTeamName})` : `Away ML (${awayTeamAbbr || awayTeamName})`;
            mlConfidence = 0.5 + Math.abs(winRateDiff) * 0.2;
            mlExplanation = `${pickTeamName} has a higher win rate (${(Math.max(homeStats.win_rate, awayStats.win_rate) * 100).toFixed(1)}%).`;
            // Add offensive rating comparison
            if (homeStats.offensive_rating && awayStats.offensive_rating) {
                 const offRatingDiff = homeStats.offensive_rating - awayStats.offensive_rating;
                 if (Math.sign(winRateDiff) === Math.sign(offRatingDiff)) {
                     mlExplanation += ` Also boasts a better offensive rating (${homeStats.offensive_rating.toFixed(1)} vs ${awayStats.offensive_rating.toFixed(1)}).`;
                     mlConfidence += 0.05;
                 } else {
                     mlExplanation += ` However, ${winRateDiff > 0 ? awayTeamName : homeTeamName} has a better offensive rating (${awayStats.offensive_rating.toFixed(1)} vs ${homeStats.offensive_rating.toFixed(1)}).`;
                     mlConfidence -= 0.03;
                 }
            }
        } else if (league === 'nhl' && homeStats.goalie_save_percentage !== undefined && awayStats.goalie_save_percentage !== undefined) {
            // Example NHL Logic: Better Save % and PP %
            const savePctDiff = homeStats.goalie_save_percentage - awayStats.goalie_save_percentage;
            const ppEffDiff = (homeStats.power_play_efficiency || 0) - (awayStats.power_play_efficiency || 0);
            pickTeamName = savePctDiff > 0 ? homeTeamName : awayTeamName;
            pickValue = savePctDiff > 0 ? `Home ML (${homeTeamAbbr || homeTeamName})` : `Away ML (${awayTeamAbbr || awayTeamName})`;
            mlConfidence = 0.5 + Math.abs(savePctDiff) * 1.5 + ppEffDiff * 0.5; // Weighted confidence
            mlExplanation = `${pickTeamName} has a better goalie save % (${(Math.max(homeStats.goalie_save_percentage, awayStats.goalie_save_percentage)).toFixed(3)}).`;
            if (Math.sign(savePctDiff) === Math.sign(ppEffDiff) && ppEffDiff !== 0) {
                mlExplanation += ` Also stronger on the power play (${(Math.max(homeStats.power_play_efficiency, awayStats.power_play_efficiency)*100).toFixed(1)}%).`;
            }
        } else if (league === 'mlb' && homeStats.era !== undefined && awayStats.era !== undefined) {
            // Example MLB Logic: Lower ERA and Higher Batting Avg
            const eraDiff = awayStats.era - homeStats.era; // Lower ERA is better
            const avgDiff = (homeStats.batting_average || 0) - (awayStats.batting_average || 0);
            pickTeamName = eraDiff > 0 ? homeTeamName : awayTeamName;
            pickValue = eraDiff > 0 ? `Home ML (${homeTeamAbbr || homeTeamName})` : `Away ML (${awayTeamAbbr || awayTeamName})`;
            mlConfidence = 0.5 + Math.abs(eraDiff) * 0.05 + avgDiff * 0.5; // Weighted confidence
            mlExplanation = `${pickTeamName} has a lower ERA (${(Math.min(homeStats.era, awayStats.era)).toFixed(2)}).`;
             if (Math.sign(eraDiff) === Math.sign(avgDiff) && avgDiff !== 0) {
                mlExplanation += ` Also boasts a higher team batting average (${(Math.max(homeStats.batting_average, awayStats.batting_average)).toFixed(3)}).`;
            }
        }

        picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'moneyline',
            pick_team: pickTeamName,
            pick_value: pickValue,
            confidence: Math.min(0.95, Math.max(0.05, mlConfidence)).toFixed(2), // Clamp confidence
            explanation: mlExplanation,
        });
    }

    // --- Spread Pick (Improved Analysis - Still Placeholder Value) ---
    if (homeStats && awayStats) {
        let spConfidence = 0.5;
        let spExplanation = "Analysis pending.";
        let pickTeamName = homeTeamName;
        let pickTeamAbbr = homeTeamAbbr;
        let spreadValue = '+1.5'; // Default placeholder

        // Use similar logic as ML but adjust confidence/explanation for spread context
        if (league === 'nba' && homeStats.win_rate !== undefined && awayStats.win_rate !== undefined) {
            const winRateDiff = homeStats.win_rate - awayStats.win_rate;
            pickTeamName = winRateDiff > 0 ? homeTeamName : awayTeamName;
            pickTeamAbbr = winRateDiff > 0 ? homeTeamAbbr : awayTeamAbbr;
            spreadValue = winRateDiff > 0 ? '-3.5' : '+3.5'; // Generic placeholder spread
            spConfidence = 0.5 + Math.abs(winRateDiff) * 0.15; 
            spExplanation = `Predicting ${pickTeamName} (${(Math.max(homeStats.win_rate, awayStats.win_rate) * 100).toFixed(1)}% win rate) to cover the spread based on statistical advantage.`;
            if (homeStats.offensive_rating && awayStats.offensive_rating) {
                 const offRatingDiff = homeStats.offensive_rating - awayStats.offensive_rating;
                 if (Math.sign(winRateDiff) !== Math.sign(offRatingDiff)) {
                     spExplanation += ` Note: Opponent has higher offensive rating.`;
                     spConfidence -= 0.05;
                 }
            }
        } 
        // Add similar logic for NHL/MLB spreads if desired
        else {
             spExplanation = `Predicting ${pickTeamName} to cover based on general stats (Spread value is placeholder).`;
        }

         picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'spread',
            pick_team: pickTeamName,
            pick_value: `${pickTeamAbbr || pickTeamName} ${spreadValue}`,
            confidence: Math.min(0.90, Math.max(0.10, spConfidence)).toFixed(2),
            explanation: spExplanation,
        });
    }

    // --- Total Pick (Improved Analysis) ---
    if (homeStats && awayStats) {
        let totConfidence = 0.5;
        let totExplanation = "Analysis pending.";
        let pickValue = 'Over 200.5'; // Default placeholder
        const placeholderLine = 200.5; // Base placeholder

        if (league === 'nba' && homeStats.offensive_rating !== undefined && awayStats.offensive_rating !== undefined) {
            const combinedOffRating = homeStats.offensive_rating + awayStats.offensive_rating;
            const avgPace = ((homeStats.pace || 100) + (awayStats.pace || 100)) / 2;
            // Simple model: Higher rating/pace suggests Over
            const estimatedTotal = combinedOffRating * (avgPace / 100); // Very basic projection
            const totalLine = 220.5; // NBA placeholder line
            pickValue = estimatedTotal > totalLine ? `Over ${totalLine}` : `Under ${totalLine}`;
            totConfidence = 0.5 + Math.abs(estimatedTotal - totalLine) * 0.015; 
            totExplanation = `Combined offensive rating (${combinedOffRating.toFixed(1)}) and average pace (${avgPace.toFixed(1)}) suggest ${pickValue}.`;
        } else if (league === 'nhl' && homeStats.goalie_save_percentage !== undefined && awayStats.goalie_save_percentage !== undefined) {
            const avgSavePct = (homeStats.goalie_save_percentage + awayStats.goalie_save_percentage) / 2;
            const avgPP = ((homeStats.power_play_efficiency || 0.15) + (awayStats.power_play_efficiency || 0.15)) / 2;
            const totalLine = 6.5; // NHL placeholder line
            // Simple model: Lower save % / higher PP % suggests Over
            pickValue = (avgSavePct < 0.905 || avgPP > 0.20) ? `Over ${totalLine}` : `Under ${totalLine}`;
            totConfidence = 0.5 + (0.905 - avgSavePct) * 2 + (avgPP - 0.20) * 1; 
            totExplanation = `Average goalie save % (${avgSavePct.toFixed(3)}) and PP efficiency (${(avgPP*100).toFixed(1)}%) suggest ${pickValue}.`;
        } else if (league === 'mlb' && homeStats.era !== undefined && awayStats.era !== undefined) {
            const avgERA = (homeStats.era + awayStats.era) / 2;
            const avgAVG = ((homeStats.batting_average || 0.250) + (awayStats.batting_average || 0.250)) / 2;
            const totalLine = 8.5; // MLB placeholder line
            // Simple model: Higher ERA / higher AVG suggests Over
            pickValue = (avgERA > 4.2 || avgAVG > 0.260) ? `Over ${totalLine}` : `Under ${totalLine}`;
            totConfidence = 0.5 + (avgERA - 4.2) * 0.05 + (avgAVG - 0.260) * 1.5; 
            totExplanation = `Average ERA (${avgERA.toFixed(2)}) and batting average (${avgAVG.toFixed(3)}) suggest ${pickValue}.`;
        }
         else {
             totExplanation = `Total pick based on general stats (Line value ${placeholderLine} is placeholder).`;
             pickValue = `Over ${placeholderLine}`; // Default to Over placeholder
        }

        picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'total',
            pick_team: null, 
            pick_value: pickValue,
            confidence: Math.min(0.90, Math.max(0.10, totConfidence)).toFixed(2),
            explanation: totExplanation,
        });
    }

    return picks;
}

// --- [v38] Helper function to generate Player Prop AI picks (Improved Placeholder Text) ---
function generatePlayerPropPicks(league: string, playerPropsData: any[]): any[] {
    const picks = [];
    const gameDate = format(new Date(), "yyyy-MM-dd");

    // Simple placeholder: Pick top 5 props based on some arbitrary logic (e.g., highest value)
    const sortedProps = playerPropsData
        .filter(p => p.prop_value && !isNaN(parseFloat(p.prop_value.match(/([0-9.]+)/)?.[0])))
        .sort((a, b) => parseFloat(b.prop_value.match(/([0-9.]+)/)?.[0]) - parseFloat(a.prop_value.match(/([0-9.]+)/)?.[0]))
        .slice(0, 5);

    for (const prop of sortedProps) {
        const confidence = 0.5 + Math.random() * 0.2; // Random confidence for now
        const explanation = `Phase 1 Placeholder: Pick based on prop value. Deeper player analysis requires additional data (e.g., game logs, matchups).`; // [v38] Updated placeholder text
        picks.push({
            game_date: gameDate,
            league: league,
            game_id: null, 
            matchup: `${prop.player_name} (${prop.team})`, 
            pick_type: `player_${prop.prop_type}`, 
            pick_team: prop.player_name, 
            pick_value: prop.prop_value, 
            confidence: confidence.toFixed(2),
            explanation: explanation,
        });
    }
    return picks;
}


// --- Main Function Handler ---
serve(async (req) => {
  // ... (omitted for brevity - same as v37, calls new generate functions) ...
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
    const leagues = ['nba', 'nhl', 'mlb']; 
    for (const league of leagues) {
        const tableName = `${league}_team_stats`;
        console.log(`Fetching current team stats from ${tableName}...`);
        const { data: statsData, error: statsError } = await supabase
            .from(tableName)
            .select('*'); 
        if (statsError) {
            console.error(`Error fetching stats from ${tableName}:`, statsError);
        } else if (statsData) {
            const leagueStatsMap = new Map();
            statsData.forEach(team => {
                const teamKey = team.team_name?.match(/\(([^)]+)\)/)?.[1]?.toUpperCase() || team.team_name?.toUpperCase(); 
                if (teamKey) {
                    leagueStatsMap.set(teamKey, team);
                } else {
                    console.warn(`Could not determine key for team: ${JSON.stringify(team)} in ${league}`);
                }
            });
            allTeamStats.set(league, leagueStatsMap);
            console.log(`Loaded ${leagueStatsMap.size} team stats for ${league.toUpperCase()}.`);
        }
    }

    // --- [v38] Fetch Schedules and Generate AI Picks --- 
    console.log("--- Starting AI Picks Generation (Phase 1 - Improved Analysis) ---");
    let allGeneratedPicks: any[] = [];
    try {
        // --- NBA Schedule & Team Picks ---
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

        // --- MLB Schedule & Team Picks ---
        const mlbBaseUrl = "https://api.balldontlie.io/mlb/v1";
        const mlbScheduleUrl = `${mlbBaseUrl}/games?dates[]=${today}`;
        const mlbTeamStatsMap = allTeamStats.get('mlb') || new Map();
        console.log(`Fetching MLB schedule for ${today}...`);
        const mlbGames = await fetchAllPaginatedData(mlbScheduleUrl, balldontlieApiKey);
        console.log(`Fetched ${mlbGames.length} MLB games for today.`);
         for (const game of mlbGames) {
            const homeTeamKey = game.home_team?.abbreviation?.toUpperCase(); 
            const awayTeamKey = game.away_team?.abbreviation?.toUpperCase(); 
             if (homeTeamKey && awayTeamKey) {
                const homeStats = mlbTeamStatsMap.get(homeTeamKey);
                const awayStats = mlbTeamStatsMap.get(awayTeamKey);
                if (homeStats && awayStats) {
                    const gamePicks = generatePicksForGame(game, 'mlb', homeStats, awayStats); 
                    allGeneratedPicks = allGeneratedPicks.concat(gamePicks);
                } else {
                     console.warn(`Missing stats for MLB game: ${awayTeamKey} @ ${homeTeamKey}`);
                }
            }
        }

        // --- NHL Schedule & Team Picks ---
        const nhlScheduleUrl = `/v1/schedule/${today}`;
        const nhlTeamStatsMap = allTeamStats.get('nhl') || new Map();
        console.log(`Fetching NHL schedule for ${today}...`);
        const nhlScheduleData = await fetchNhlData(nhlScheduleUrl);
        const nhlGames = nhlScheduleData?.gameWeek?.[0]?.games || [];
        console.log(`Fetched ${nhlGames.length} NHL games for today.`);
        for (const game of nhlGames) {
             const homeTeamKey = game.homeTeam?.abbrev?.toUpperCase();
             const awayTeamKey = game.awayTeam?.abbrev?.toUpperCase();
             if (homeTeamKey && awayTeamKey) {
                const homeStats = nhlTeamStatsMap.get(homeTeamKey);
                const awayStats = nhlTeamStatsMap.get(awayTeamKey);
                if (homeStats && awayStats) {
                    const gamePicks = generatePicksForGame(game, 'nhl', homeStats, awayStats);
                    allGeneratedPicks = allGeneratedPicks.concat(gamePicks);
                } else {
                     console.warn(`Missing stats for NHL game: ${awayTeamKey} @ ${homeTeamKey}`);
                }
            }
        }

        // --- [v38] Generate Player Prop Picks (Improved Placeholder Text) ---
        for (const league of leagues) {
            const playerPropsTable = `${league}_player_props`;
            console.log(`Fetching player props from ${playerPropsTable} for AI picks...`);
            const { data: propsData, error: propsError } = await supabase
                .from(playerPropsTable)
                .select('player_name, team, prop_type, prop_value')
                .limit(100); 
            
            if (propsError) {
                console.error(`Error fetching player props for ${league}:`, propsError);
            } else if (propsData && propsData.length > 0) {
                const playerPicks = generatePlayerPropPicks(league, propsData);
                allGeneratedPicks = allGeneratedPicks.concat(playerPicks);
                console.log(`Generated ${playerPicks.length} placeholder player prop picks for ${league.toUpperCase()}.`);
            }
        }

        // --- Upsert Generated Picks ---
        if (allGeneratedPicks.length > 0) {
            console.log(`Upserting ${allGeneratedPicks.length} AI picks...`);
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
        // console.log(`Fetched ${allTeams.length} NBA teams basic info.`); // Less verbose
        
        // Fetch actual NBA team stats/standings (replace placeholder)
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

        // console.log(`Prepared ${teamsToUpsert.length} NBA teams for upsert...`); // Less verbose
        const { error: upsertError } = await supabase
            .from("nba_team_stats")
            .upsert(teamsToUpsert, { onConflict: "team_name" });
        if (upsertError) throw upsertError;
        console.log("Successfully upserted NBA team stats.");

    } catch (nbaError) {
        console.error("NBA data fetch/process error:", nbaError.message);
    }
    console.log("--- Finished NBA Data Fetch ---");

    // --- Fetch NHL Data ---
    console.log("--- Starting NHL Data Fetch ---");
    try {
        const nhlStandingsData = await fetchNhlData(`/v1/standings/${today}`);
        const nhlTeamsToUpsert: any[] = [];
        if (nhlStandingsData?.standings) {
            nhlStandingsData.standings.forEach((standing: any) => {
                nhlTeamsToUpsert.push({
                    team_name: `${standing.teamName?.default} (${standing.teamAbbrev?.default})`,
                    puck_line_trend: "L10: 6-4", // Placeholder
                    goalie_name: "Goalie Name", // Placeholder
                    goalie_save_percentage: 0.900 + Math.random() * 0.03, // Placeholder
                    power_play_efficiency: 0.15 + Math.random() * 0.1 // Placeholder
                });
            });
        }
        // console.log(`Prepared ${nhlTeamsToUpsert.length} NHL teams for upsert...`); // Less verbose
        const { error: nhlUpsertError } = await supabase
            .from("nhl_team_stats")
            .upsert(nhlTeamsToUpsert, { onConflict: "team_name" });
        if (nhlUpsertError) throw nhlUpsertError;
        console.log("Successfully upserted NHL team stats.");

    } catch (nhlError) {
        console.error("NHL data fetch/process error:", nhlError.message);
    }
    console.log("--- Finished NHL Data Fetch ---");

    // --- Fetch MLB Data ---
    console.log("--- Starting MLB Data Fetch ---");
    try {
        const mlbBaseUrl = "https://api.balldontlie.io/mlb/v1";
        const mlbTeamsUrl = `${mlbBaseUrl}/teams`;
        const allMlbTeams = await fetchAllPaginatedData(mlbTeamsUrl, balldontlieApiKey);
        // console.log(`Fetched ${allMlbTeams.length} MLB teams basic info.`); // Less verbose

        const mlbTeamStatsMap = new Map();
        allMlbTeams.forEach(team => {
            mlbTeamStatsMap.set(team.id, {
                win_loss_record: `${Math.floor(Math.random() * 10 + 5)}-${Math.floor(Math.random() * 10 + 5)}`, // Placeholder
                era: (3.5 + Math.random() * 1.5).toFixed(2),
                batting_average: (0.240 + Math.random() * 0.03).toFixed(3)
            });
        });

        const mlbTeamsToUpsert = allMlbTeams.map((team: any) => {
            const stats = mlbTeamStatsMap.get(team.id) || {};
            return {
                team_name: `${team.name} (${team.abbreviation})`,
                win_loss_record: stats.win_loss_record || "0-0",
                era: stats.era || 4.00,
                batting_average: stats.batting_average || 0.250
            };
        });

        // console.log(`Prepared ${mlbTeamsToUpsert.length} MLB teams for upsert...`); // Less verbose
        const { error: mlbUpsertError } = await supabase
            .from("mlb_team_stats")
            .upsert(mlbTeamsToUpsert, { onConflict: "team_name" });
        if (mlbUpsertError) throw mlbUpsertError;
        console.log("Successfully upserted MLB team stats.");

    } catch (mlbError) {
        console.error("MLB data fetch/process error:", mlbError.message);
    }
    console.log("--- Finished MLB Data Fetch ---");

    // --- [End of Existing Data Fetching Logic] ---

    console.log("Function execution finished successfully.");
    return new Response(JSON.stringify({ message: "Sports data update cycle completed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Main function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

