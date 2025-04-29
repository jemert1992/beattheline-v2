import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="bg-gray-800 text-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="text-xl font-bold">Sports Analytics Platform</div>
          <div className="flex space-x-1">
            <Link 
              to="/nba" 
              className={`tab ${path === '/' || path === '/nba' ? 'tab-active bg-green-500 text-white' : 'tab-inactive'}`}
            >
              NBA
            </Link>
            <Link 
              to="/nhl" 
              className={`tab ${path === '/nhl' ? 'tab-active bg-blue-500 text-white' : 'tab-inactive'}`}
            >
              NHL
            </Link>
            <Link 
              to="/mlb" 
              className={`tab ${path === '/mlb' ? 'tab-active bg-red-500 text-white' : 'tab-inactive'}`}
            >
              MLB
            </Link>
            <Link 
              to="/bets-of-the-day" 
              className={`tab ${path === '/bets-of-the-day' ? 'tab-active bg-yellow-500 text-black' : 'tab-inactive'}`}
            >
              Bets of the Day
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
