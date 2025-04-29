// Supabase client configuration for the frontend
// This file connects the React frontend to the Supabase backend

import { createClient } from '@supabase/supabase-js';

// In a production environment, these would be environment variables
// For Replit compatibility, we're keeping them in a separate config file
// that can be easily updated
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_KEY';

// Initialize the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// NBA data fetching functions
export async function fetchNBATeams() {
  const { data, error } = await supabase
    .from('nba_teams')
    .select('*')
    .order('team_name');
  
  if (error) {
    console.error('Error fetching NBA teams:', error);
    throw error;
  }
  
  return data;
}

export async function fetchNBATeamStats() {
  const { data, error } = await supabase
    .from('nba_team_stats')
    .select(`
      *,
      team:team_id(team_id, team_name, team_abbreviation)
    `)
    .eq('season', '2024-25');
  
  if (error) {
    console.error('Error fetching NBA team stats:', error);
    throw error;
  }
  
  return data;
}

export async function fetchNBAPlayerProps() {
  const { data, error } = await supabase
    .from('nba_player_props')
    .select(`
      *,
      player:player_id(player_id, first_name, last_name),
      game:game_id(game_id, game_date, home_team_id, away_team_id)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error fetching NBA player props:', error);
    throw error;
  }
  
  return data;
}

export async function fetchNBAPredictions() {
  const { data, error } = await supabase
    .from('nba_predictions')
    .select(`
      *,
      game:game_id(game_id, game_date, home_team_id, away_team_id),
      winner:predicted_winner_team_id(team_id, team_name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error fetching NBA predictions:', error);
    throw error;
  }
  
  return data;
}

// NHL data fetching functions
export async function fetchNHLTeams() {
  const { data, error } = await supabase
    .from('nhl_teams')
    .select('*')
    .order('team_name');
  
  if (error) {
    console.error('Error fetching NHL teams:', error);
    throw error;
  }
  
  return data;
}

export async function fetchNHLTeamStats() {
  const { data, error } = await supabase
    .from('nhl_team_stats')
    .select(`
      *,
      team:team_id(team_id, team_name, team_abbreviation)
    `)
    .eq('season', '2024-25');
  
  if (error) {
    console.error('Error fetching NHL team stats:', error);
    throw error;
  }
  
  return data;
}

export async function fetchNHLGoalieStats() {
  const { data, error } = await supabase
    .from('nhl_goalie_stats')
    .select(`
      *,
      goalie:player_id(player_id, first_name, last_name, team_id)
    `)
    .eq('season', '2024-25');
  
  if (error) {
    console.error('Error fetching NHL goalie stats:', error);
    throw error;
  }
  
  return data;
}

export async function fetchNHLPredictions() {
  const { data, error } = await supabase
    .from('nhl_predictions')
    .select(`
      *,
      game:game_id(game_id, game_date, home_team_id, away_team_id)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error fetching NHL predictions:', error);
    throw error;
  }
  
  return data;
}

// MLB data fetching functions
export async function fetchMLBTeams() {
  const { data, error } = await supabase
    .from('mlb_teams')
    .select('*')
    .order('team_name');
  
  if (error) {
    console.error('Error fetching MLB teams:', error);
    throw error;
  }
  
  return data;
}

export async function fetchMLBTeamStats() {
  const { data, error } = await supabase
    .from('mlb_team_stats')
    .select(`
      *,
      team:team_id(team_id, team_name, team_abbreviation)
    `)
    .eq('season', '2025');
  
  if (error) {
    console.error('Error fetching MLB team stats:', error);
    throw error;
  }
  
  return data;
}

export async function fetchMLBPitcherStats() {
  const { data, error } = await supabase
    .from('mlb_pitcher_stats')
    .select(`
      *,
      pitcher:player_id(player_id, first_name, last_name, team_id)
    `)
    .eq('season', '2025');
  
  if (error) {
    console.error('Error fetching MLB pitcher stats:', error);
    throw error;
  }
  
  return data;
}

export async function fetchMLBPredictions() {
  const { data, error } = await supabase
    .from('mlb_predictions')
    .select(`
      *,
      game:game_id(game_id, game_date, home_team_id, away_team_id)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error fetching MLB predictions:', error);
    throw error;
  }
  
  return data;
}

// Bets of the Day fetching function
export async function fetchBetsOfTheDay() {
  const { data, error } = await supabase
    .from('bets_of_the_day')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching Bets of the Day:', error);
    throw error;
  }
  
  return data;
}

// Export the Supabase client for direct access if needed
export { supabase };
