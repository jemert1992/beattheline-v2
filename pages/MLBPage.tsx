import React, { useContext } from 'react';
import { SportsContext } from '../context/SportsContext';
import SportSection from '../components/SportSection';

const MLBPage: React.FC = () => {
  const { mlbStats, predictions, loading, error } = useContext(SportsContext);

  if (loading) return <div className="text-center py-8">Loading MLB data...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error loading MLB data: {error}</div>;
  if (!mlbStats) return <div className="text-center py-8">No MLB data available</div>;

  const keyFactors = (
    <table className="w-full">
      <thead>
        <tr>
          <th>Team</th>
          <th>First Inning Trend</th>
          <th>Pitcher ERA</th>
        </tr>
      </thead>
      <tbody>
        {mlbStats.teams.map((team: any, index: number) => (
          <tr key={index}>
            <td>{team.teamName}</td>
            <td>{team.firstInningTrend}</td>
            <td>{team.pitcherStats.era}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const predictionsContent = (
    <div className="p-3 bg-gray-100 rounded">
      <p className="font-medium">{predictions.mlb.firstInning}</p>
      <p className="text-sm text-gray-600 mt-2">
        <strong>Reasoning:</strong> {predictions.mlb.reasoning}
      </p>
    </div>
  );

  const playerProps = (
    <div className="space-y-3">
      {mlbStats.playerProps.map((prop: any, index: number) => (
        <div key={index} className="p-3 bg-gray-100 rounded">
          <p className="font-medium">{prop.playerName} - {prop.propType} {prop.propValue}</p>
          <p className="text-sm text-gray-600 mt-1">{prop.analysis}</p>
        </div>
      ))}
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
