import React from 'react';

type BetsOfTheDayProps = {
  bets: Array<{
    sport: string;
    pick: string;
    reasoning: string;
  }>;
};

const BetsOfTheDay: React.FC<BetsOfTheDayProps> = ({ bets }) => {
  return (
    <div className="card mb-8 bets-section">
      <h1 className="text-2xl font-bold mb-4">Bets of the Day</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bets.map((bet, index) => (
          <div key={index} className="bg-white shadow-md p-4 rounded-lg border-l-4 border-gray-800">
            <div className="flex items-center mb-2">
              <span className={`
                inline-block w-3 h-3 rounded-full mr-2
                ${bet.sport === 'NBA' ? 'bg-green-500' : 
                  bet.sport === 'NHL' ? 'bg-blue-500' : 
                  bet.sport === 'MLB' ? 'bg-red-500' : 'bg-gray-500'}
              `}></span>
              <span className="font-semibold text-gray-700">{bet.sport}</span>
            </div>
            <h3 className="text-lg font-bold mb-1">{bet.pick}</h3>
            <p className="text-gray-600 text-sm">{bet.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BetsOfTheDay;
