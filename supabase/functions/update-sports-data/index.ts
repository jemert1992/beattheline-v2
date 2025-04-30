// Import necessary libraries
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { format } from "https://deno.land/std@0.203.0/datetime/format.ts"; // For date formatting

console.log("Initializing update-sports-data function (v39 Bugfixes & Enhancements)");

// --- Helper Function to fetch paginated data (BallDontLie API) ---
async function fetchAllPaginatedData(url: string, apiKey: string) {
  // ... (omitted for brevity - same as v38)
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
  // ... (omitted for brevity - same as v38)
  console.log(`Fetching NHL data from ${endpoint}...`);
  const response = await fetch(`https://api-web.nhle.com${endpoint}`);
  if (!response.ok) {
    throw new Error(`NHL API HTTP error! status: ${response.status} - ${await response.text()} fetching ${endpoint}`);
  }
  return await response.json();
}

// --- [v39] Helper function to generate AI picks with fixes and enhancements ---
function generatePicksForGame(game: any, league: string, homeStats: any, awayStats: any): any[] {
    const picks = [];
    const gameDate = game.date?.split("T")[0] || format(new Date(), "yyyy-MM-dd");
    
    let homeTeamName: string | undefined;
    let awayTeamName: string | undefined;
    let homeTeamAbbr: string | undefined;
    let awayTeamAbbr: string | undefined;

    // [v39 Fix] Ensure correct team objects are accessed based on league
    if (league === 'nba') { 
        homeTeamName = game.home_team?.full_name;
        awayTeamName = game.visitor_team?.full_name; // Correctly use visitor_team
        homeTeamAbbr = game.home_team?.abbreviation;
        awayTeamAbbr = game.visitor_team?.abbreviation;
    } else if (league === 'mlb') { 
        homeTeamName = game.home_team?.name; // MLB API uses name
        awayTeamName = game.away_team?.name; // MLB API uses away_team and name
        homeTeamAbbr = game.home_team?.abbreviation;
        awayTeamAbbr = game.away_team?.abbreviation;
    } else if (league === 'nhl') { 
        homeTeamName = game.homeTeam?.name?.default;
        awayTeamName = game.awayTeam?.name?.default;
        homeTeamAbbr = game.homeTeam?.abbrev;
        awayTeamAbbr = game.awayTeam?.abbrev;
    }

    // Fallback if names/abbrs are still missing
    homeTeamName = homeTeamName || homeTeamAbbr || 'Home';
    awayTeamName = awayTeamName || awayTeamAbbr || 'Away';
    homeTeamAbbr = homeTeamAbbr || homeTeamName; // Use name if abbr missing
    awayTeamAbbr = awayTeamAbbr || awayTeamName; // Use name if abbr missing

    const matchup = `${awayTeamName} vs ${homeTeamName}`;
    const gameId = game.id?.toString() || `${league}-${gameDate}-${awayTeamAbbr}-${homeTeamAbbr}`;

    // --- Moneyline Pick (Enhanced Analysis & Confidence) ---
    if (homeStats && awayStats) {
        let mlConfidence = 0.5;
        const reasons: string[] = [];
        let pickTeamName = homeTeamName;
        let pickValue = `Home ML (${homeTeamAbbr})`;

        if (league === 'nba' && homeStats.win_rate !== undefined && awayStats.win_rate !== undefined) {
            const winRateDiff = homeStats.win_rate - awayStats.win_rate;
            if (winRateDiff !== 0) {
                pickTeamName = winRateDiff > 0 ? homeTeamName : awayTeamName;
                pickValue = winRateDiff > 0 ? `Home ML (${homeTeamAbbr})` : `Away ML (${awayTeamAbbr})`;
                mlConfidence += winRateDiff * 0.4; // [v39] More impact from win rate
                reasons.push(`${pickTeamName} has a ${winRateDiff > 0 ? 'higher' : 'lower'} win rate (${(homeStats.win_rate * 100).toFixed(1)}% vs ${(awayStats.win_rate * 100).toFixed(1)}%).`);
            }
            if (homeStats.offensive_rating && awayStats.offensive_rating) {
                 const offRatingDiff = homeStats.offensive_rating - awayStats.offensive_rating;
                 if (offRatingDiff !== 0) {
                     mlConfidence += offRatingDiff * 0.02; // [v39] More impact from rating
                     reasons.push(`${offRatingDiff > 0 ? homeTeamName : awayTeamName} has a better offensive rating (${homeStats.offensive_rating.toFixed(1)} vs ${awayStats.offensive_rating.toFixed(1)}).`);
                 }
            }
            // Add defensive rating if available
            if (homeStats.defensive_rating && awayStats.defensive_rating) {
                 const defRatingDiff = awayStats.defensive_rating - homeStats.defensive_rating; // Lower is better
                 if (defRatingDiff !== 0) {
                     mlConfidence += defRatingDiff * 0.02; // [v39] More impact from rating
                     reasons.push(`${defRatingDiff > 0 ? homeTeamName : awayTeamName} has a better defensive rating (${homeStats.defensive_rating.toFixed(1)} vs ${awayStats.defensive_rating.toFixed(1)}).`);
                 }
            }
        } else if (league === 'nhl' && homeStats.goalie_save_percentage !== undefined && awayStats.goalie_save_percentage !== undefined) {
            const savePctDiff = homeStats.goalie_save_percentage - awayStats.goalie_save_percentage;
            const ppEffDiff = (homeStats.power_play_efficiency || 0) - (awayStats.power_play_efficiency || 0);
            if (savePctDiff !== 0) {
                pickTeamName = savePctDiff > 0 ? homeTeamName : awayTeamName;
                pickValue = savePctDiff > 0 ? `Home ML (${homeTeamAbbr})` : `Away ML (${awayTeamAbbr})`;
                mlConfidence += savePctDiff * 2.5; // [v39] More impact
                reasons.push(`${pickTeamName} has a better goalie save % (${homeStats.goalie_save_percentage.toFixed(3)} vs ${awayStats.goalie_save_percentage.toFixed(3)}).`);
            }
            if (ppEffDiff !== 0) {
                mlConfidence += ppEffDiff * 0.8; // [v39] More impact
                reasons.push(`${ppEffDiff > 0 ? homeTeamName : awayTeamName} is stronger on the power play (${(homeStats.power_play_efficiency*100).toFixed(1)}% vs ${(awayStats.power_play_efficiency*100).toFixed(1)}%).`);
            }
        } else if (league === 'mlb' && homeStats.era !== undefined && awayStats.era !== undefined) {
            const eraDiff = awayStats.era - homeStats.era; // Lower ERA is better
            const avgDiff = (homeStats.batting_average || 0) - (awayStats.batting_average || 0);
            if (eraDiff !== 0) {
                pickTeamName = eraDiff > 0 ? homeTeamName : awayTeamName;
                pickValue = eraDiff > 0 ? `Home ML (${homeTeamAbbr})` : `Away ML (${awayTeamAbbr})`;
                mlConfidence += eraDiff * 0.1; // [v39] More impact
                reasons.push(`${pickTeamName} has a lower ERA (${homeStats.era.toFixed(2)} vs ${awayStats.era.toFixed(2)}).`);
            }
             if (avgDiff !== 0) {
                mlConfidence += avgDiff * 1.0; // [v39] More impact
                reasons.push(`${avgDiff > 0 ? homeTeamName : awayTeamName} boasts a higher team batting average (${homeStats.batting_average.toFixed(3)} vs ${awayStats.batting_average.toFixed(3)}).`);
            }
        }

        const finalExplanation = reasons.length > 0 ? reasons.join(' ') : "Based on available stats.";
        picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'moneyline',
            pick_team: pickTeamName,
            pick_value: pickValue,
            confidence: Math.min(0.99, Math.max(0.01, mlConfidence)).toFixed(2), // [v39] Wider clamp
            explanation: finalExplanation,
        });
    }

    // --- Spread Pick (Enhanced Analysis & Confidence - Still Placeholder Value) ---
    if (homeStats && awayStats) {
        let spConfidence = 0.5;
        const reasons: string[] = [];
        let pickTeamName = homeTeamName;
        let pickTeamAbbr = homeTeamAbbr;
        let spreadValue = '+1.5'; // Default placeholder

        if (league === 'nba' && homeStats.win_rate !== undefined && awayStats.win_rate !== undefined) {
            const winRateDiff = homeStats.win_rate - awayStats.win_rate;
            pickTeamName = winRateDiff > 0 ? homeTeamName : awayTeamName;
            pickTeamAbbr = winRateDiff > 0 ? homeTeamAbbr : awayTeamAbbr;
            spreadValue = winRateDiff > 0 ? '-3.5' : '+3.5'; // Generic placeholder spread
            spConfidence += winRateDiff * 0.3; // [v39] Adjusted impact
            reasons.push(`Win rate difference favors ${pickTeamName} (${(homeStats.win_rate * 100).toFixed(1)}% vs ${(awayStats.win_rate * 100).toFixed(1)}%).`);
            if (homeStats.offensive_rating && awayStats.offensive_rating) {
                 const offRatingDiff = homeStats.offensive_rating - awayStats.offensive_rating;
                 if (offRatingDiff !== 0) {
                     spConfidence += offRatingDiff * 0.015;
                     reasons.push(`Offensive rating difference (${homeStats.offensive_rating.toFixed(1)} vs ${awayStats.offensive_rating.toFixed(1)}) ${Math.sign(winRateDiff) === Math.sign(offRatingDiff) ? 'supports' : 'contradicts'} the pick.`);
                 }
            }
        } 
        // Add similar logic for NHL/MLB spreads if desired
        else {
             reasons.push(`Spread pick based on general stats (Spread value ${spreadValue} is placeholder).`);
        }

        const finalExplanation = reasons.join(' ');
         picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'spread',
            pick_team: pickTeamName,
            pick_value: `${pickTeamAbbr} ${spreadValue}`,
            confidence: Math.min(0.98, Math.max(0.02, spConfidence)).toFixed(2), // [v39] Wider clamp
            explanation: finalExplanation,
        });
    }

    // --- Total Pick (Enhanced Analysis & Confidence) ---
    if (homeStats && awayStats) {
        let totConfidence = 0.5;
        const reasons: string[] = [];
        let pickValue = 'Over 200.5'; // Default placeholder
        let totalLine = 200.5; // Base placeholder

        if (league === 'nba' && homeStats.offensive_rating !== undefined && awayStats.offensive_rating !== undefined) {
            const combinedOffRating = homeStats.offensive_rating + awayStats.offensive_rating;
            const combinedDefRating = (homeStats.defensive_rating || 115) + (awayStats.defensive_rating || 115);
            const avgPace = ((homeStats.pace || 100) + (awayStats.pace || 100)) / 2;
            totalLine = 220.5; // NBA placeholder line
            // Simple model: Higher off rating/pace suggests Over, higher def rating suggests Under
            const estimatedTotal = combinedOffRating * (avgPace / 100) - (combinedDefRating - 230) * 0.5; // Basic projection
            pickValue = estimatedTotal > totalLine ? `Over ${totalLine}` : `Under ${totalLine}`;
            totConfidence = 0.5 + (estimatedTotal - totalLine) * 0.025; // [v39] Adjusted impact
            reasons.push(`Combined offensive rating (${combinedOffRating.toFixed(1)}) and average pace (${avgPace.toFixed(1)}) point towards ${pickValue}.`);
            if (homeStats.defensive_rating && awayStats.defensive_rating) {
                 reasons.push(`Combined defensive rating is ${combinedDefRating.toFixed(1)}.`);
            }
        } else if (league === 'nhl' && homeStats.goalie_save_percentage !== undefined && awayStats.goalie_save_percentage !== undefined) {
            const avgSavePct = (homeStats.goalie_save_percentage + awayStats.goalie_save_percentage) / 2;
            const avgPP = ((homeStats.power_play_efficiency || 0.15) + (awayStats.power_play_efficiency || 0.15)) / 2;
            totalLine = 6.5; // NHL placeholder line
            pickValue = (avgSavePct < 0.905 || avgPP > 0.20) ? `Over ${totalLine}` : `Under ${totalLine}`;
            totConfidence = 0.5 + (0.905 - avgSavePct) * 4 + (avgPP - 0.20) * 1.5; // [v39] Adjusted impact
            reasons.push(`Average goalie save % (${avgSavePct.toFixed(3)}) ${avgSavePct < 0.905 ? 'favors Over' : 'favors Under'}.`);
            reasons.push(`Average PP efficiency (${(avgPP*100).toFixed(1)}%) ${avgPP > 0.20 ? 'favors Over' : 'favors Under'}.`);
        } else if (league === 'mlb' && homeStats.era !== undefined && awayStats.era !== undefined) {
            const avgERA = (homeStats.era + awayStats.era) / 2;
            const avgAVG = ((homeStats.batting_average || 0.250) + (awayStats.batting_average || 0.250)) / 2;
            totalLine = 8.5; // MLB placeholder line
            pickValue = (avgERA > 4.2 || avgAVG > 0.260) ? `Over ${totalLine}` : `Under ${totalLine}`;
            totConfidence = 0.5 + (avgERA - 4.2) * 0.1 + (avgAVG - 0.260) * 2.0; // [v39] Adjusted impact
            reasons.push(`Average ERA (${avgERA.toFixed(2)}) ${avgERA > 4.2 ? 'favors Over' : 'favors Under'}.`);
            reasons.push(`Average batting average (${avgAVG.toFixed(3)}) ${avgAVG > 0.260 ? 'favors Over' : 'favors Under'}.`);
        }
         else {
             reasons.push(`Total pick based on general stats (Line value ${totalLine} is placeholder).`);
             pickValue = `Over ${totalLine}`; // Default to Over placeholder
        }

        const finalExplanation = reasons.join(' ');
        picks.push({
            game_date: gameDate,
            league: league,
            game_id: gameId,
            matchup: matchup,
            pick_type: 'total',
            pick_team: null, 
            pick_value: pickValue,
            confidence: Math.min(0.98, Math.max(0.02, totConfidence)).toFixed(2), // [v39] Wider clamp
            explanation: finalExplanation,
        });
    }

    return picks;
}

// --- [v39] Helper function to generate Player Prop AI picks (Error Fix) ---
function generatePlayerPropPicks(league: string, playerPropsData: any[]): any[] {
    const picks = [];
    const gameDate = format(new Date(), "yyyy-MM-dd");

    // Simple placeholder: Pick top 5 props based on highest numeric value found
    const validProps = playerPropsData.filter(p => {
        // [v39 Fix] Check if prop_value is a string before using match
        if (typeof p.prop_value !== 'string') return false;
        const match = p.prop_value.match(/([0-9.]+)/);
        return match && !isNaN(parseFloat(match[0]));
    });

    const sortedProps = validProps
        .sort((a, b) => parseFloat(b.prop_value.match(/([0-9.]+)/)[0]) - parseFloat(a.prop_value.match(/([0-9.]+)/)[0]))
        .slice(0, 5);

    console.log(`[v39] Found ${validProps.length} valid props, selecting top ${sortedProps.length} for ${league.toUpperCase()}.`);

    for (const prop of sortedProps) {
        const confidence = 0.3 + Math.random() * 0.4; // [v39] Slightly wider random confidence for placeholder
        const explanation = `Phase 1 Placeholder: Pick based on prop value. Deeper player analysis requires additional data (e.g., game logs, matchups).`;
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Configuration ---
    const balldontlieApiKey = "9047df76-eb37-4f81-8586-f7ae336027dc"; 
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // const currentSeason = 2023; // Not currently used effectively
    // const nhlSeasonYYYYYYYY = "20232024"; // Not currently used effectively
    // const nhlGameType = 2; // Not currently used effectively
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
                // [v39 Fix] Use abbreviation directly as key, handle potential nulls
                const teamKey = team.team_name?.match(/\(([^)]+)\)/)?.[1]?.toUpperCase(); 
                if (teamKey) {
                    leagueStatsMap.set(teamKey, team);
                } else {
                    console.warn(`[v39] Could not determine abbreviation key for team: ${team.team_name} in ${league}`);
                    // Fallback: Try using full name if abbr fails
                    const fallbackKey = team.team_name?.toUpperCase();
                    if (fallbackKey && !fallbackKey.includes('(')) { // Avoid using the name if it still has abbr
                         leagueStatsMap.set(fallbackKey, team);
                         console.log(`[v39] Using fallback key: ${fallbackKey}`);
                    }
                }
            });
            allTeamStats.set(league, leagueStatsMap);
            console.log(`Loaded ${leagueStatsMap.size} team stats for ${league.toUpperCase()}.`);
        }
    }

    // --- [v39] Fetch Schedules and Generate AI Picks --- 
    console.log("--- Starting AI Picks Generation (Phase 1 - v39 Fixes) ---");
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
            // [v39 Fix] Ensure keys are consistently uppercase abbreviations
            const homeTeamKey = game.home_team?.abbreviation?.toUpperCase();
            const awayTeamKey = game.visitor_team?.abbreviation?.toUpperCase(); 
            if (homeTeamKey && awayTeamKey) {
                const homeStats = nbaTeamStatsMap.get(homeTeamKey);
                const awayStats = nbaTeamStatsMap.get(awayTeamKey);
                if (homeStats && awayStats) {
                    const gamePicks = generatePicksForGame(game, 'nba', homeStats, awayStats);
                    allGeneratedPicks = allGeneratedPicks.concat(gamePicks);
                } else {
                    console.warn(`[v39] Missing stats for NBA game: ${awayTeamKey} @ ${homeTeamKey}. Check stats table keys.`);
                }
            } else {
                 console.warn(`[v39] Missing team abbreviation in NBA game data: ${JSON.stringify(game)}`);
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
                     console.warn(`[v39] Missing stats for MLB game: ${awayTeamKey} @ ${homeTeamKey}. Check stats table keys.`);
                }
            } else {
                 console.warn(`[v39] Missing team abbreviation in MLB game data: ${JSON.stringify(game)}`);
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
             // [v39 Fix] Ensure keys are consistently uppercase abbreviations
             const homeTeamKey = game.homeTeam?.abbrev?.toUpperCase();
             const awayTeamKey = game.awayTeam?.abbrev?.toUpperCase();
             if (homeTeamKey && awayTeamKey) {
                const homeStats = nhlTeamStatsMap.get(homeTeamKey);
                const awayStats = nhlTeamStatsMap.get(awayTeamKey);
                if (homeStats && awayStats) {
                    const gamePicks = generatePicksForGame(game, 'nhl', homeStats, awayStats);
                    allGeneratedPicks = allGeneratedPicks.concat(gamePicks);
                } else {
                     console.warn(`[v39] Missing stats for NHL game: ${awayTeamKey} @ ${homeTeamKey}. Check stats table keys.`);
                }
            } else {
                 console.warn(`[v39] Missing team abbreviation in NHL game data: ${JSON.stringify(game)}`);
            }
        }

        // --- [v39] Generate Player Prop Picks (Error Fix) ---
        for (const league of leagues) {
            const playerPropsTable = `${league}_player_props`;
            console.log(`Fetching player props from ${playerPropsTable} for AI picks...`);
            const { data: propsData, error: propsError } = await supabase
                .from(playerPropsTable)
                .select('player_name, team, prop_type, prop_value')
                .limit(200); // Fetch more props to increase chance of getting valid ones
            
            if (propsError) {
                console.error(`Error fetching player props for ${league}:`, propsError);
            } else if (propsData && propsData.length > 0) {
                try {
                    const playerPicks = generatePlayerPropPicks(league, propsData);
                    allGeneratedPicks = allGeneratedPicks.concat(playerPicks);
                    console.log(`Generated ${playerPicks.length} placeholder player prop picks for ${league.toUpperCase()}.`);
                } catch (propGenError) {
                     console.error(`[v39] Error during player prop pick generation for ${league}:`, propGenError.message);
                     // Continue with other leagues even if one fails
                }
            } else {
                 console.log(`No player props found in ${playerPropsTable} to generate picks.`);
            }
        }

        // --- Upsert Generated Picks ---
        if (allGeneratedPicks.length > 0) {
            console.log(`[v39] Attempting to upsert ${allGeneratedPicks.length} AI picks...`);
            // Delete old picks for today first
            const { error: deleteError } = await supabase
                .from('ai_picks')
                .delete()
                .eq('game_date', today);
            if (deleteError) {
                console.error("Error deleting old AI picks:", deleteError);
                // Don't stop, try upserting anyway
            } else {
                console.log(`Deleted old picks for ${today}.`);
            }

            // Upsert new picks
            const { error: picksUpsertError } = await supabase
                .from("ai_picks")
                .upsert(allGeneratedPicks);
            if (picksUpsertError) {
                 console.error("[v39] AI Picks upsert error:", picksUpsertError);
                 throw picksUpsertError; // Throw error to indicate failure
            } else {
                console.log("[v39] Successfully upserted AI picks.");
            }
        } else {
            console.log("[v39] No AI picks were generated for today.");
        }

    } catch (picksError) {
        console.error("[v39] AI Picks generation/upsert block error:", picksError.message);
        // Log the error but allow the rest of the function (stats updates) to proceed
    }
    console.log("--- Finished AI Picks Generation ---");

    // --- [Keep Existing Data Fetching Logic Below] ---
    // ... (NBA, NHL, MLB data fetching/processing code remains here, omitted for brevity) ...
    // --- Fetch NBA Data ---
    console.log("--- Starting NBA Data Fetch ---");
    try {
        const nbaBaseUrl = "https://api.balldontlie.io/v1";
        const nbaTeamsUrl = `${nbaBaseUrl}/teams`;
        const allTeams = await fetchAllPaginatedData(nbaTeamsUrl, balldontlieApiKey);
        
        // Fetch actual NBA team stats/standings (replace placeholder)
        // [v39] Using placeholder stats for now - real stats fetching needs implementation
        const teamStatsMap = new Map(); 
        allTeams.forEach(team => {
            teamStatsMap.set(team.id, {
                win_rate: Math.random() * 0.6 + 0.2, 
                pace: 95 + Math.random() * 10, 
                offensive_rating: 105 + Math.random() * 10, 
                defensive_rating: 105 + Math.random() * 10, // Added placeholder def rating
                recent_form: "W-L-W-L-W" 
            });
        });

        const teamsToUpsert = allTeams.map((team: any) => {
          const stats = teamStatsMap.get(team.id) || {};
          // [v39] Ensure team_name format matches key used in stats map
          const teamAbbr = team.abbreviation?.toUpperCase();
          const teamName = team.full_name;
          return {
            team_name: `${teamName} (${teamAbbr})`, // Consistent format
            win_rate: stats.win_rate || 0.5,
            pace: stats.pace || 100.0,
            offensive_rating: stats.offensive_rating || 110.0,
            defensive_rating: stats.defensive_rating || 115.0, // Added placeholder def rating
            recent_form: stats.recent_form || "N/A"
          };
        });

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
                 // [v39] Ensure team_name format matches key used in stats map
                const teamAbbr = standing.teamAbbrev?.default?.toUpperCase();
                const teamName = standing.teamName?.default;
                if (teamName && teamAbbr) {
                    nhlTeamsToUpsert.push({
                        team_name: `${teamName} (${teamAbbr})`, // Consistent format
                        puck_line_trend: "L10: 6-4", // Placeholder
                        goalie_name: "Goalie Name", // Placeholder
                        goalie_save_percentage: 0.900 + Math.random() * 0.03, // Placeholder
                        power_play_efficiency: 0.15 + Math.random() * 0.1 // Placeholder
                    });
                } else {
                    console.warn(`[v39] Missing name/abbr for NHL standing: ${JSON.stringify(standing)}`);
                }
            });
        }
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

        // [v39] Using placeholder stats for now - real stats fetching needs implementation
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
            // [v39] Ensure team_name format matches key used in stats map
            const teamAbbr = team.abbreviation?.toUpperCase();
            const teamName = team.name; // MLB API uses name
            return {
                team_name: `${teamName} (${teamAbbr})`, // Consistent format
                win_loss_record: stats.win_loss_record || "0-0",
                era: stats.era || 4.00,
                batting_average: stats.batting_average || 0.250
            };
        });

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

