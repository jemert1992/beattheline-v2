import React from 'react';

type SportSectionProps = {
  title: string;
  sportClass: string;
  keyFactors: React.ReactNode;
  predictions: React.ReactNode;
  playerProps: React.ReactNode;
};

const SportSection: React.FC<SportSectionProps> = ({ 
  title, 
  sportClass, 
  keyFactors, 
  predictions, 
  playerProps 
}) => {
  return (
    <div className={`card mb-8 ${sportClass}`}>
      <h1 className="text-2xl font-bold mb-4">{title} Analysis</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Key Factors</h2>
          {keyFactors}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Predictions</h2>
          {predictions}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Player Props</h2>
          {playerProps}
        </div>
      </div>
    </div>
  );
};

export default SportSection;
