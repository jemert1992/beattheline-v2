import React, { useContext, useState, useEffect } from 'react';
import { SportsContext } from '../context/SportsContext';
import SportSection from '../components/SportSection';

const NHLPage: React.FC = () => {
  const { nhlStats, predictions, loading, error, fetchData } = useContext(SportsContext);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Set last updated time whenever data changes
  useEffect(() => {
    if (nhlStats) {
      setLastUpdated(new Date().toLocaleString());
    }
  }, [nhlStats]);

  // Function to handle manual refresh
  const handleRefresh = () => {
    fetchData();
  };

  if (loading) return <div className="text-center py-8">Loading NHL data...</div>;
  if (error) return (
    <div className="text-center py-8">
      <p className="text-red-500">Error loading NHL data: {error}</p>
      <button 
        onClick={handleRefresh}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  );
  if (!nhlStats || !nhlStats.teams || nhlStats.teams.length === 0) 
    return (
      <div className="text-center py-8">
        <p>No NHL data available</p>
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
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
      <table className="w-full border-collapse">
        <thead className="bg-blue-100">
          <tr>
            <th className="border border-blue-200 px-4 py-2 text-left">Team</th>
            <th className="border border-blue-200 px-4 py-2 text-left">Puck Line Trend</th>
            <th className="border border-blue-200 px-4 py-2 text-left">Goalie (Save %)</th>
            {/* Add more headers based on your actual Supabase data */}
          </tr>
        </thead>
        <tbody>
          {nhlStats.teams.map((team: any, index: number) => (
            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-blue-50"}>
              <td className="border border-blue-200 px-4 py-2 font-medium">{team.teamName || team.team_name || 'N/A'}</td>
              <td className="border border-blue-200 px-4 py-2">{team.puckLineTrend || team.puck_line_trend || 'N/A'}</td>
              <td className="border border-blue-200 px-4 py-2">
                {team.goalieStats?.name || team.goalie_name ? (
                  <>
                    <span className="font-medium">{team.goalieStats?.name || team.goalie_name}</span>
                    <span className="ml-2 text-blue-700">({team.goalieStats?.savePct || team.goalie_save_percentage})</span>
                  </>
                ) : (
                  <span className="text-gray-500">No goalie data</span>
                )}
              </td>
              {/* Add more cells based on your actual Supabase data */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const predictionsContent = predictions?.nhl ? (
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center mb-3">
        <div className="w-2 h-2 rounded-full bg-blue-600 mr-2"></div>
        <h3 className="font-bold text-blue-800">{predictions.nhl.totalGoals || predictions.nhl.total_goals || "Total Goals Prediction"}</h3>
      </div>
      <div className="ml-4">
        <p className="text-sm text-gray-700 mt-2">
          <strong>Reasoning:</strong> {predictions.nhl.reasoning || "Analysis based on team stats and goalie performance"}
        </p>
        <div className="mt-3 flex items-center">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${predictions.nhl.confidence || 70}%` }}></div>
          </div>
          <span className="ml-2 text-sm font-medium text-blue-700">{predictions.nhl.confidence || 70}%</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p>No NHL predictions available</p>
    </div>
  );

  const playerProps = nhlStats.playerProps && nhlStats.playerProps.length > 0 ? (
    <div className="space-y-3">
      {nhlStats.playerProps.map((prop: any, index: number) => (
        <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="font-bold text-blue-800">
            {prop.playerName || prop.player_name} - {prop.propType || prop.prop_type} {prop.propValue || prop.prop_value}
          </p>
          <p className="text-sm text-gray-700 mt-2">{prop.analysis}</p>
          <div className="mt-3 flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${prop.confidence || 65}%` }}></div>
            </div>
            <span className="ml-2 text-sm font-medium text-blue-700">{prop.confidence || 65}%</span>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p>No NHL player props available</p>
    </div>
  );

  return (
    <SportSection
      title="NHL"
      sportClass="nhl-section" // Ensure this class is defined in index.css for blue theme
      keyFactors={keyFactors}
      predictions={predictionsContent}
      playerProps={playerProps}
    />
  );
};

export default NHLPage;
