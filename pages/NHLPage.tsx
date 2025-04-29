import React, { useContext } from 'react';
import { SportsContext } from '../context/SportsContext';
import SportSection from '../components/SportSection';

const NHLPage: React.FC = () => {
  const { nhlStats, predictions, loading, error } = useContext(SportsContext);

  if (loading) return <div className="text-center py-8">Loading NHL data...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error loading NHL data: {error}</div>;
  if (!nhlStats) return <div className="text-center py-8">No NHL data available</div>;

  const keyFactors = (
    <table className="w-full">
      <thead>
        <tr>
          <th>Team</th>
          <th>Puck Line Trend</th>
          <th>Goalie Save %</th>
        </tr>
      </thead>
      <tbody>
        {nhlStats.teams.map((team: any, index: number) => (
          <tr key={index}>
            <td>{team.teamName}</td>
            <td>{team.puckLineTrend}</td>
            <td>{team.goalieStats.savePct}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const predictionsContent = (
    <div className="p-3 bg-gray-100 rounded">
      <p className="font-medium">{predictions.nhl.totalGoals}</p>
      <p className="text-sm text-gray-600 mt-2">
        <strong>Reasoning:</strong> {predictions.nhl.reasoning}
      </p>
    </div>
  );

  const playerProps = (
    <div className="space-y-3">
      {nhlStats.playerProps.map((prop: any, index: number) => (
        <div key={index} className="p-3 bg-gray-100 rounded">
          <p className="font-medium">{prop.playerName} - {prop.propType} {prop.propValue}</p>
          <p className="text-sm text-gray-600 mt-1">{prop.analysis}</p>
        </div>
      ))}
    </div>
  );

  return (
    <SportSection
      title="NHL"
      sportClass="nhl-section"
      keyFactors={keyFactors}
      predictions={predictionsContent}
      playerProps={playerProps}
    />
  );
};

export default NHLPage;
