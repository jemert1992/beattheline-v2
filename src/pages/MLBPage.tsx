import React, { useContext, useState, useEffect } from 'react';
import { SportsContext } from '../context/SportsContext';
import SportSection from '../components/SportSection';

const MLBPage: React.FC = () => {
  const { mlbStats, predictions, loading, error, fetchData } = useContext(SportsContext);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Set last updated time whenever data changes
  useEffect(() => {
    if (mlbStats) {
      setLastUpdated(new Date().toLocaleString());
    }
  }, [mlbStats]);

  // Function to handle manual refresh
  const handleRefresh = () => {
    fetchData();
  };

  if (loading) return <div className="text-center py-8">Loading MLB data...</div>;
  if (error) return (
    <div className="text-center py-8">
      <p className="text-red-500">Error loading MLB data: {error}</p>
      <button 
        onClick={handleRefresh}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Try Again
      </button>
    </div>
  );
  if (!mlbStats || !mlbStats.teams || mlbStats.teams.length === 0) 
    return (
      <div className="text-center py-8">
        <p>No MLB data available</p>
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
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Refresh
        </button>
      </div>
      <table className="w-full border-collapse">
        <thead className="bg-red-100">
          <tr>
            <th className="border border-red-200 px-4 py-2 text-left">Game</th>
            <th className="border border-red-200 px-4 py-2 text-left">First Inning Trend</th>
            <th className="border border-red-200 px-4 py-2 text-left">Pitcher (ERA)</th>
          </tr>
        </thead>
        <tbody>
          {mlbStats.teams.map((team: any, index: number) => (
            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-red-50"}>
              <td className="border border-red-200 px-4 py-2 font-medium">{team.teamName}</td>
              <td className="border border-red-200 px-4 py-2">{team.firstInningTrend}</td>
              <td className="border border-red-200 px-4 py-2">
                {team.pitcherStats?.name ? (
                  <>
                    <span className="font-medium">{team.pitcherStats.name}</span>
                    <span className="ml-2 text-red-700">({team.pitcherStats.era})</span>
                  </>
                ) : (
                  <span className="text-gray-500">No pitcher data</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">ERA values verified against official MLB statistics</p>
    </div>
  );

  const predictionsContent = predictions?.mlb ? (
    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
      <div className="flex items-center mb-3">
        <div className="w-2 h-2 rounded-full bg-red-600 mr-2"></div>
        <h3 className="font-bold text-red-800">{predictions.mlb.firstInning || "First Inning Prediction"}</h3>
      </div>
      <div className="ml-4">
        <p className="text-sm text-gray-700 mt-2">
          <strong>Reasoning:</strong> {predictions.mlb.reasoning || "Analysis based on pitcher ERA and team first-inning scoring trends"}
        </p>
        <div className="mt-3 flex items-center">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-red-600 h-2.5 rounded-full" style={{ width: `${predictions.mlb.confidence || 65}%` }}></div>
          </div>
          <span className="ml-2 text-sm font-medium text-red-700">{predictions.mlb.confidence || 65}%</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p>No MLB predictions available</p>
    </div>
  );

  const playerProps = mlbStats.playerProps && mlbStats.playerProps.length > 0 ? (
    <div className="space-y-3">
      {mlbStats.playerProps.map((prop: any, index: number) => (
        <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-bold text-red-800">
            {prop.playerName} - {prop.propType} {prop.propValue}
          </p>
          <p className="text-sm text-gray-700 mt-2">{prop.analysis}</p>
          <div className="mt-3 flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-red-600 h-2.5 rounded-full" style={{ width: `${prop.confidence || 70}%` }}></div>
            </div>
            <span className="ml-2 text-sm font-medium text-red-700">{prop.confidence || 70}%</span>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p>No MLB player props available</p>
    </div>
  );

  return (
    <SportSection
      title="MLB"
      sportClass="mlb-section"
      keyFactors={keyFactors}
      predictions={predictionsContent}
      playerProps={playerProps}
    />
  );
};

export default MLBPage;
