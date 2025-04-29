import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define types for our context data (replace 'any' with specific types later if possible)
type TeamStats = any; // Define specific type based on your schema
type PlayerProps = any; // Define specific type based on your schema
type Predictions = any; // Define specific type based on your schema

type SportsContextType = {
  nbaStats: { teams: TeamStats[], playerProps: PlayerProps[] } | null;
  nhlStats: { teams: TeamStats[], playerProps: PlayerProps[] } | null;
  mlbStats: { teams: TeamStats[], playerProps: PlayerProps[] } | null;
  predictions: Predictions | null;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>; // Add function to allow manual refresh
};

// Create context with default values
export const SportsContext = createContext<SportsContextType>({
  nbaStats: null,
  nhlStats: null,
  mlbStats: null,
  predictions: null,
  loading: true, // Start loading initially
  error: null,
  fetchData: async () => {}, // Default empty function
});

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error("Supabase URL or Anon Key is missing. Check environment variables.");
}

// Create a provider component
type SportsContextProviderProps = {
  children: ReactNode;
};

export const SportsContextProvider: React.FC<SportsContextProviderProps> = ({ children }) => {
  const [nbaStats, setNbaStats] = useState<any>(null);
  const [nhlStats, setNhlStats] = useState<any>(null);
  const [mlbStats, setMlbStats] = useState<any>(null);
  const [predictions, setPredictions] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!supabase) {
      setError("Supabase client not initialized. Check environment variables.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch data from Supabase tables
      // Replace table names ('nba_team_stats', 'nba_player_props', etc.) 
      // with your actual table names from supabase-schema.md

      // --- NBA Data --- 
      const { data: nbaTeamData, error: nbaTeamError } = await supabase
        .from('nba_team_stats') // Replace with your actual table name
        .select('*'); 
      const { data: nbaPlayerData, error: nbaPlayerError } = await supabase
        .from('nba_player_props') // Replace with your actual table name
        .select('*');
      if (nbaTeamError || nbaPlayerError) throw new Error(`NBA Fetch Error: ${nbaTeamError?.message || nbaPlayerError?.message}`);
      setNbaStats({ teams: nbaTeamData || [], playerProps: nbaPlayerData || [] });

      // --- NHL Data --- 
      const { data: nhlTeamData, error: nhlTeamError } = await supabase
        .from('nhl_team_stats') // Replace with your actual table name
        .select('*');
      const { data: nhlPlayerData, error: nhlPlayerError } = await supabase
        .from('nhl_player_props') // Replace with your actual table name
        .select('*');
      if (nhlTeamError || nhlPlayerError) throw new Error(`NHL Fetch Error: ${nhlTeamError?.message || nhlPlayerError?.message}`);
      setNhlStats({ teams: nhlTeamData || [], playerProps: nhlPlayerData || [] });

      // --- MLB Data --- 
      const { data: mlbTeamData, error: mlbTeamError } = await supabase
        .from('mlb_team_stats') // Replace with your actual table name
        .select('*');
      const { data: mlbPlayerData, error: mlbPlayerError } = await supabase
        .from('mlb_player_props') // Replace with your actual table name
        .select('*');
      if (mlbTeamError || mlbPlayerError) throw new Error(`MLB Fetch Error: ${mlbTeamError?.message || mlbPlayerError?.message}`);
      setMlbStats({ teams: mlbTeamData || [], playerProps: mlbPlayerData || [] });

      // --- Predictions Data --- 
      // Fetch NBA, NHL, MLB predictions and Bets of the Day
      // This structure assumes you have separate tables or a combined one
      const { data: nbaPredData, error: nbaPredError } = await supabase
        .from('nba_predictions') // Replace with your actual table name
        .select('*')
        .limit(1); // Example: Fetch latest prediction
      const { data: nhlPredData, error: nhlPredError } = await supabase
        .from('nhl_predictions') // Replace with your actual table name
        .select('*')
        .limit(1);
      const { data: mlbPredData, error: mlbPredError } = await supabase
        .from('mlb_predictions') // Replace with your actual table name
        .select('*')
        .limit(1);
      const { data: betsData, error: betsError } = await supabase
        .from('bets_of_the_day') // Replace with your actual table name
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5); // Example: Fetch latest 5 bets
        
      if (nbaPredError || nhlPredError || mlbPredError || betsError) {
          throw new Error(`Prediction Fetch Error: ${nbaPredError?.message || nhlPredError?.message || mlbPredError?.message || betsError?.message}`);
      }
      
      // Combine predictions into a single object for the context
      setPredictions({
          nba: nbaPredData?.[0] || null, // Get the first record or null
          nhl: nhlPredData?.[0] || null,
          mlb: mlbPredData?.[0] || null,
          betsOfTheDay: betsData || []
      });

      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching data from Supabase:", err);
      setError(err.message || 'An unknown error occurred while fetching data.');
      setLoading(false);
      // Optionally clear old data on error
      // setNbaStats(null);
      // setNhlStats(null);
      // setMlbStats(null);
      // setPredictions(null);
    }
  };

  useEffect(() => {
    fetchData(); // Fetch data on initial component mount
  }, []);

  return (
    <SportsContext.Provider value={{ nbaStats, nhlStats, mlbStats, predictions, loading, error, fetchData }}>
      {children}
    </SportsContext.Provider>
  );
};

