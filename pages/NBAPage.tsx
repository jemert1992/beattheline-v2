import React, { useContext } from 'react';
import { SportsContext } from '../context/SportsContext';
import SportSection from '../components/SportSection';

const NBAPage: React.FC = () => {
  const { nbaStats, predictions, loading, error } = useContext(SportsContext);

  if (loading) return <div className="text-center py-8">Loading NBA data...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error loading NBA data: {error}</div>;
  if (!nbaStats) return <div className="text-center py-8">No NBA data available</div>;

  const keyFactors = (
    <table className="w-full">
      <thead>
        <tr>
          <th>Team</th>
          <th>Win Rate</th>
          <th>Pace</th>
        </tr>
      </thead>
      <tbody>
        {nbaStats.teams.map((team: any, index: number) => (
          <tr key={index}>
            <td>{team.teamName}</td>
            <td>{(team.winRate * 100).toFixed(1)}%</td>
            <td>{team.pace}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const predictionsContent = (
    <div className="p-3 bg-gray-100 rounded">
      <p className="font-medium">{predictions.nba.gameOutcome}</p>
      <p className="text-sm text-gray-600 mt-2">
        <strong>Reasoning:</strong> {predictions.nba.reasoning}
      </p>
    </div>
  );

  const playerProps = (
    <div className="space-y-3">
      {nbaStats.playerProps.map((prop: any, index: number) => (
        <div key={index} className="p-3 bg-gray-100 rounded">
          <p className="font-medium">{prop.playerName} - {prop.propType} {prop.propValue}</p>
          <p className="text-sm text-gray-600 mt-1">{prop.analysis}</p>
        </div>
      ))}
    </div>
  );

  return (
    <SportSection
      title="NBA"
      sportClass="nba-section"
      keyFactors={keyFactors}
      predictions={predictionsContent}
      playerProps={playerProps}
    />
  );
};

export default NBAPage;
