import React, { useContext, useState, useEffect } from 'react';
import { SportsContext } from '../context/SportsContext';

const BetsOfTheDayPage: React.FC = () => {
  const { predictions, loading, error, fetchData } = useContext(SportsContext);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Set last updated time whenever data changes
  useEffect(() => {
    if (predictions?.betsOfTheDay) {
      setLastUpdated(new Date().toLocaleString());
    }
  }, [predictions]);

  // Function to handle manual refresh
  const handleRefresh = () => {
    fetchData();
  };

  if (loading) return <div className="text-center py-8">Loading Bets of the Day...</div>;
  if (error) return (
    <div className="text-center py-8">
      <p className="text-red-500">Error loading Bets of the Day: {error}</p>
      <button 
        onClick={handleRefresh}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  );
  if (!predictions || !predictions.betsOfTheDay || predictions.betsOfTheDay.length === 0) 
    return (
      <div className="text-center py-8">
        <p>No Bets of the Day available</p>
        <button 
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Data
        </button>
      </div>
    );

  // Helper to get sport-specific color class
  const getSportColor = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'nba': return 'green';
      case 'nhl': return 'blue';
      case 'mlb': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Bets of the Day</h2>
        <div>
          <p className="text-sm text-gray-500 mb-1 text-right">Last updated: {lastUpdated}</p>
          <button 
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Refresh Bets
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {predictions.betsOfTheDay.map((bet: any, index: number) => {
          const sportColor = getSportColor(bet.sport);
          return (
            <div 
              key={index} 
              className={`bg-${sportColor}-50 border border-${sportColor}-200 rounded-lg shadow-md p-5 transition-transform transform hover:scale-105`}
            >
              <div className="flex items-center mb-3">
                <span className={`inline-block px-3 py-1 text-xs font-semibold text-${sportColor}-800 bg-${sportColor}-200 rounded-full mr-3`}>
                  {bet.sport}
                </span>
                <h3 className={`text-lg font-bold text-${sportColor}-800`}>{bet.pick}</h3>
              </div>
              <p className="text-sm text-gray-700 mb-4">{bet.reasoning}</p>
              {bet.confidence && (
                <div className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className={`bg-${sportColor}-600 h-2.5 rounded-full`} style={{ width: `${bet.confidence}%` }}></div>
                  </div>
                  <span className={`ml-3 text-sm font-medium text-${sportColor}-700`}>{bet.confidence}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BetsOfTheDayPage;
