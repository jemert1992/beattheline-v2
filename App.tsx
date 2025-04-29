import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import NBAPage from './pages/NBAPage';
import NHLPage from './pages/NHLPage';
import MLBPage from './pages/MLBPage';
import BetsOfTheDayPage from './pages/BetsOfTheDayPage';
import { SportsContextProvider } from './context/SportsContext';

const App: React.FC = () => {
  return (
    <SportsContextProvider>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<NBAPage />} />
            <Route path="/nba" element={<NBAPage />} />
            <Route path="/nhl" element={<NHLPage />} />
            <Route path="/mlb" element={<MLBPage />} />
            <Route path="/bets-of-the-day" element={<BetsOfTheDayPage />} />
          </Routes>
        </main>
        <footer className="bg-gray-800 text-white p-4 text-center">
          <p>© 2025 Sports Analytics Platform - For Analysis Only</p>
        </footer>
      </div>
    </SportsContextProvider>
  );
};

export default App;
