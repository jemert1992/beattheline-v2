import React, { useContext } from 'react';
import { SportsContext } from '../context/SportsContext';
import BetsOfTheDay from '../components/BetsOfTheDay';

const BetsOfTheDayPage: React.FC = () => {
  const { predictions, loading, error } = useContext(SportsContext);

  if (loading) return <div className="text-center py-8">Loading Bets of the Day...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error loading data: {error}</div>;
  if (!predictions) return <div className="text-center py-8">No predictions available</div>;

  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Today's Top Analytical Picks</h1>
      <p className="text-gray-600 mb-6">
        Our algorithm analyzes key factors across NBA, NHL, and MLB to identify the strongest analytical edges.
        These picks are for analysis purposes only.
      </p>
      <BetsOfTheDay bets={predictions.betsOfTheDay} />
    </>
  );
};

export default BetsOfTheDayPage;
