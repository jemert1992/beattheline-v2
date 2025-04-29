import React, { useContext, useState, useEffect } from 'react';
import { SportsContext } from '../context/SportsContext';
import SportSection from '../components/SportSection';

const NBAPage: React.FC = () => {
  const { nbaStats, predictions, loading, error, fetchData } = useContext(SportsContext);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Set last updated time whenever data changes
  useEffect(() => {
    if (nbaStats) {
      setLastUpdated(new Date().toLocaleString());
    }
  }, [nbaStats]);

  // Function to handle manual refresh
  const handleRefresh = () => {
    fetchData();
  };

  if (loading) return <div className="text-center py-8">Loading NBA data...</div>;
  if (error) return (
    <div className="text-center py-8">
      <p className="text-red-500">Error loading NBA data: {error}</p>
      <button 
        onClick={handleRefresh}
        className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Try Again
      </button>
    </div>
  );
  if (!nbaStats || !nbaStats.teams || nbaStats.teams.length === 0) 
    return (
      <div className="text-center py-8">
        <p>No NBA data available</p>
        <button 
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Data
        </button>
      </div>
    );

  const keyFactors = (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Refresh
        </button>
      </div>
      <table className="w-full border-collapse">
        <thead className="bg-green-100">
          <tr>
            <th className="border border-green-200 px-4 py-2 text-left">Team</th>
            <th className="border border-green-200 px-4 py-2 text-left">Win Rate</th>
            <th className="border border-green-200 px-4 py-2 text-left">Pace</th>
            <th className="border border-green-200 px-4 py-2 text-left">Off. Rating</th>
            {/* Add more headers based on your actual Supabase data */}
          </tr>
        </thead>
        <tbody>
          {nbaStats.teams.map((team: any, index: number) => (
            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-green-50"}>
              <td className="border border-green-200 px-4 py-2 font-medium">{team.teamName || team.team_name || 'N/A'}</td>
              <td className="border border-green-200 px-4 py-2">{team.winRate ? (team.winRate * 100).toFixed(1) + '%' : 'N/A'}</td>
              <td className="border border-green-200 px-4 py-2">{team.pace || 'N/A'}</td>
              <td className="border border-green-200 px-4 py-2">{team.offensiveRating || team.offensive_rating || 'N/A'}</td>
              {/* Add more cells based on your actual Supabase data */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const predictionsContent = predictions?.nba ? (
    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-center mb-3">
        <div className="w-2 h-2 rounded-full bg-green-600 mr-2"></div>
        <h3 className="font-bold text-green-800">{predictions.nba.gameOutcome || predictions.nba.game_outcome || "Game Prediction"}</h3>
      </div>
      <div className="ml-4">
        <p className="text-sm text-gray-700 mt-2">
          <strong>Reasoning:</strong> {predictions.nba.reasoning || "Analysis based on team stats and recent form"}
        </p>
        <div className="mt-3 flex items-center">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${predictions.nba.confidence || 65}%` }}></div>
          </div>
          <span className="ml-2 text-sm font-medium text-green-700">{predictions.nba.confidence || 65}%</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p>No NBA predictions available</p>
    </div>
  );

  const playerProps = nbaStats.playerProps && nbaStats.playerProps.length > 0 ? (
    <div className="space-y-3">
      {nbaStats.playerProps.map((prop: any, index: number) => (
        <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="font-bold text-green-800">
            {prop.playerName || prop.player_name} - {prop.propType || prop.prop_type} {prop.propValue || prop.prop_value}
          </p>
          <p className="text-sm text-gray-700 mt-2">{prop.analysis}</p>
          <div className="mt-3 flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${prop.confidence || 70}%` }}></div>
            </div>
            <span className="ml-2 text-sm font-medium text-green-700">{prop.confidence || 70}%</span>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p>No NBA player props available</p>
    </div>
  );

  return (
    <SportSection
      title="NBA"
      sportClass="nba-section" // Ensure this class is defined in index.css for green theme
      keyFactors={keyFactors}
      predictions={predictionsContent}
      playerProps={playerProps}
    />
  );
};

export default NBAPage;
