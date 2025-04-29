import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

// Define types for our context
type SportsContextType = {
  nbaStats: any;
  nhlStats: any;
  mlbStats: any;
  predictions: any;
  loading: boolean;
  error: string | null;
};

// Create context with default values
export const SportsContext = createContext<SportsContextType>({
  nbaStats: null,
  nhlStats: null,
  mlbStats: null,
  predictions: null,
  loading: false,
  error: null,
});

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

  // In a real implementation, we would connect to Supabase here
  // const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_KEY');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Mock data for demonstration purposes
        // In a real implementation, we would fetch from Supabase
        
        // NBA mock data
        setNbaStats({
          teams: [
            {
              teamName: 'Golden State Warriors',
              winRate: 0.650,
              pace: 102.3,
              offensiveRating: 114.2,
              recentForm: '4-1'
            },
            {
              teamName: 'Los Angeles Lakers',
              winRate: 0.580,
              pace: 99.8,
              offensiveRating: 112.5,
              recentForm: '3-2'
            },
            {
              teamName: 'Boston Celtics',
              winRate: 0.720,
              pace: 98.6,
              offensiveRating: 116.7,
              recentForm: '5-0'
            }
          ],
          playerProps: [
            {
              playerName: 'Stephen Curry',
              team: 'Golden State Warriors',
              propType: 'Points',
              propValue: 28.5,
              analysis: 'Over - Curry has exceeded this total in 7 of last 10 games'
            },
            {
              playerName: 'LeBron James',
              team: 'Los Angeles Lakers',
              propType: 'Assists',
              propValue: 8.5,
              analysis: 'Under - James has been focusing more on scoring recently'
            }
          ]
        });
        
        // NHL mock data
        setNhlStats({
          teams: [
            {
              teamName: 'Toronto Maple Leafs',
              puckLineTrend: '+1.5 (80% cover rate)',
              goalieStats: {
                name: 'Jack Campbell',
                savePct: 0.918,
                goalsAgainstAvg: 2.45
              }
            },
            {
              teamName: 'Tampa Bay Lightning',
              puckLineTrend: '-1.5 (65% cover rate)',
              goalieStats: {
                name: 'Andrei Vasilevskiy',
                savePct: 0.925,
                goalsAgainstAvg: 2.21
              }
            }
          ],
          playerProps: [
            {
              playerName: 'Auston Matthews',
              team: 'Toronto Maple Leafs',
              propType: 'Shots on Goal',
              propValue: 4.5,
              analysis: 'Over - Matthews is averaging 5.3 shots per game'
            }
          ]
        });
        
        // MLB mock data
        setMlbStats({
          teams: [
            {
              teamName: 'New York Yankees',
              firstInningTrend: '62% scoring rate',
              pitcherStats: {
                name: 'Gerrit Cole',
                era: 3.12,
                firstInningEra: 2.85
              }
            },
            {
              teamName: 'Los Angeles Dodgers',
              firstInningTrend: '58% scoring rate',
              pitcherStats: {
                name: 'Clayton Kershaw',
                era: 2.95,
                firstInningEra: 3.10
              }
            }
          ],
          playerProps: [
            {
              playerName: 'Gerrit Cole',
              team: 'New York Yankees',
              propType: 'Strikeouts',
              propValue: 7.5,
              analysis: 'Over - Cole has recorded 8+ strikeouts in 6 consecutive starts'
            }
          ]
        });
        
        // Predictions mock data
        setPredictions({
          nba: {
            gameOutcome: 'Warriors to win vs. Lakers (65% probability)',
            reasoning: 'Superior pace and 3-point shooting'
          },
          nhl: {
            totalGoals: 'Under 6.5 goals in Maple Leafs vs. Lightning (70% probability)',
            reasoning: 'Strong goaltending on both sides'
          },
          mlb: {
            firstInning: 'Yankees vs. Dodgers - First inning run (Yes, 65% probability)',
            reasoning: 'Both teams have high first-inning scoring rates'
          },
          betsOfTheDay: [
            {
              sport: 'NBA',
              pick: 'Warriors to win vs. Lakers',
              reasoning: 'Superior pace and 3-point shooting'
            },
            {
              sport: 'NHL',
              pick: 'Under 6.5 goals in Maple Leafs vs. Lightning',
              reasoning: 'Strong goaltending on both sides'
            },
            {
              sport: 'MLB',
              pick: 'Yankees vs. Dodgers - First inning run (Yes)',
              reasoning: 'Both teams have high first-inning scoring rates'
            },
            {
              sport: 'NBA',
              pick: 'Stephen Curry Over 28.5 Points',
              reasoning: 'Curry has exceeded this total in 7 of last 10 games'
            },
            {
              sport: 'MLB',
              pick: 'Gerrit Cole Over 7.5 Strikeouts',
              reasoning: 'Cole has recorded 8+ strikeouts in 6 consecutive starts'
            }
          ]
        });
        
        setLoading(false);
      } catch (err) {
        setError('Error fetching data');
        setLoading(false);
        console.error(err);
      }
    };

    fetchData();
  }, []);

  return (
    <SportsContext.Provider value={{ nbaStats, nhlStats, mlbStats, predictions, loading, error }}>
      {children}
    </SportsContext.Provider>
  );
};
