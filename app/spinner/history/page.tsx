'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import MobileHeader from '@/components/spinner-user/MobileHeader';
import MobileNavigation from '@/components/spinner-user/MobileNavigation';
import { formatDate } from '@/lib/utils';
import { Trophy, Calendar, Clock, Award, XCircle, CheckCircle, Users, DollarSign, ShoppingBag, Package, TrendingUp } from 'lucide-react';
import api from '@/app/utils/api';

interface SpinnerHistory {
  _id: string;
  winnerId: {
    _id: string;
    phone: string;
  };
  winnerItemId: {
    _id: string;
    name: string;
    price: number;
  };
  winnerItemName: string;
  winnerItemPrice: number;
  totalValue: number;
  numberOfItems: number;
  selectedItems: Array<{
    _id: string;
    name: string;
    price: number;
  }>;
  createdAt: string;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [games, setGames] = useState<SpinnerHistory[]>([]);
  const [activeTab, setActiveTab] = useState('games');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError('');
        
        // Fetch spinner history for the current user
        const response = await api.get(`/spinner/history/user/${user._id}`);
        const spinnerHistory: SpinnerHistory[] = response.data;
        
        // Sort by date (newest first)
        spinnerHistory.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setGames(spinnerHistory);
        
      } catch (error: any) {
        console.error('Failed to fetch history:', error);
        setError(error.response?.data?.error || 'Failed to fetch history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  if (!user) {
    return null;
  }

  // Helper function to format date strings
  const formatDateString = (dateString: string) => {
    return formatDate(new Date(dateString));
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate statistics for Games tab
  const calculateGameStats = () => {
    const totalGames = games.length;
    const totalSoldValue = games.reduce((sum, game) => sum + game.totalValue, 0);
    
    return { totalGames, totalSoldValue };
  };

  // Calculate statistics for Earnings tab
  const calculateEarningsStats = () => {
    // Filter games where the current user is the winner
    const userWonGames = games.filter(game => game.winnerId._id === user._id);
    
    const totalGames = userWonGames.length;
    
    // Calculate total winner item price (total value of items user won)
    const totalWinnerItemPrice = userWonGames.reduce((sum, game) => sum + game.winnerItemPrice, 0);
    
    // Calculate total sold value in games user won
    const totalSoldValue = userWonGames.reduce((sum, game) => sum + game.totalValue, 0);
    
    // Calculate profit: total sold minus total winner item price
    const profit = totalSoldValue - totalWinnerItemPrice;
    
    return { totalGames, profit, totalWinnerItemPrice, totalSoldValue };
  };

  const GameHistory = () => {
    const { totalGames, totalSoldValue } = calculateGameStats();
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-lg shadow-md"
      >
        {/* Two Stats Cards for Games Tab */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{totalGames}</p>
            <p className="text-sm text-blue-600">Total Games</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalSoldValue)}
            </p>
            <p className="text-sm text-green-600">Total Sold Value</p>
          </div>
        </div>
        
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <Clock className="mr-2 h-5 w-5 text-blue-600" />
          Recent Spinner Games
        </h2>
        
        {error ? (
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex justify-between items-center p-4 border-b border-gray-100 animate-pulse">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                  <div className="ml-3">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No spinner games played yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => {
              const isWinner = game.winnerId._id === user._id;
              
              return (
                <motion.div
                  key={game._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-full ${isWinner ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {isWinner ? (
                          <Trophy className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium">Spinner Game #{game._id.slice(-4)}</p>
                        <p className="text-sm text-gray-500">
                          {formatDateString(game.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isWinner ? 'text-green-600' : 'text-gray-600'}`}>
                        {isWinner ? 'Won' : 'Lost'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {game.numberOfItems} items
                      </p>
                    </div>
                  </div>
                  
                  {/* Winner Item Information */}
                  <div className="bg-blue-50 p-3 rounded-lg mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-blue-800">Winner Item</p>
                        <p className="text-sm text-blue-600">{game.winnerItemName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-800">{formatCurrency(game.winnerItemPrice)}</p>
                        <p className="text-xs text-blue-600">Price</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Game Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Total Sold Value</p>
                      <p className="font-semibold">{formatCurrency(game.totalValue)}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Items in Game</p>
                      <p className="font-semibold">{game.numberOfItems}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded col-span-2">
                      <p className="text-gray-500">Selected Items</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {game.selectedItems.slice(0, 3).map((item, index) => (
                          <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {item.name}
                          </span>
                        ))}
                        {game.selectedItems.length > 3 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            +{game.selectedItems.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  };

  const EarningsHistory = () => {
    const { totalGames, profit, totalWinnerItemPrice, totalSoldValue } = calculateEarningsStats();
    
    if (games.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-lg shadow-md"
        >
          {/* Two Stats Cards for Earnings Tab */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">0</p>
              <p className="text-sm text-blue-600">Games Won</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(0)}
              </p>
              <p className="text-sm text-green-600">Profit</p>
            </div>
          </div>
          
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No earnings history yet.</p>
          </div>
        </motion.div>
      );
    }

    // Filter games where the current user is the winner
    const userWonGames = games.filter(game => game.winnerId._id === user._id);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-lg shadow-md"
      >
        {/* Two Stats Cards for Earnings Tab */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{totalGames}</p>
            <p className="text-sm text-blue-600">Games Won</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(profit)}
            </p>
            <p className="text-sm text-green-600">Profit</p>
            <p className="text-xs text-gray-500 mt-1">
              (Sold: {formatCurrency(totalSoldValue)} - Won: {formatCurrency(totalWinnerItemPrice)})
            </p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4 flex items-center">
          <DollarSign className="mr-2 h-5 w-5 text-green-600" />
          Your Earnings
        </h2>

        {/* Earnings Summary */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg text-center mb-6">
          <p className="text-3xl font-bold text-green-600">{formatCurrency(totalWinnerItemPrice)}</p>
          <p className="text-sm text-green-600">Total Value of Won Items</p>
          <p className="text-xs text-gray-500 mt-1">
            Profit: {formatCurrency(profit)} from {totalGames} wins
          </p>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((item) => (
              <div key={item} className="flex justify-between items-center p-4 border-b border-gray-100 animate-pulse">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                  <div className="ml-3">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : userWonGames.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No earnings yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userWonGames.map((game) => (
              <motion.div
                key={game._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-between items-center p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-green-100">
                    <Trophy className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="font-medium">{game.winnerItemName}</p>
                    <p className="text-sm text-gray-500">
                      Game #{game._id.slice(-4)} • {formatDateString(game.createdAt)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {game.numberOfItems} items • Sold Value: {formatCurrency(game.totalValue)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <p className="font-semibold text-green-600">
                      +{formatCurrency(game.winnerItemPrice)}
                    </p>
                    <p className="text-xs text-gray-500">Item Value</p>
                  </div>
                  <div className="mt-2">
                    <p className={`font-semibold ${game.totalValue - game.winnerItemPrice >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {game.totalValue - game.winnerItemPrice >= 0 ? '+' : ''}{formatCurrency(game.totalValue - game.winnerItemPrice)}
                    </p>
                    <p className="text-xs text-gray-500">Game Profit</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <MobileHeader title="Spinner History" />
      
      <div className="p-4 px-0 space-y-6 pb-24 pt-16">
        {/* Tab Navigation */}
        <div className="flex bg-white rounded-lg shadow-sm p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-md text-center font-medium ${activeTab === 'games' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('games')}
          >
            <div className="flex items-center justify-center">
              <Clock className="h-4 w-4 mr-2" />
              Games
            </div>
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-md text-center font-medium ${activeTab === 'earnings' ? 'bg-green-100 text-green-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('earnings')}
          >
            <div className="flex items-center justify-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Earnings
            </div>
          </button>
        </div>
        
        {activeTab === 'games' ? <GameHistory /> : <EarningsHistory />}
      </div>

      <MobileNavigation />
    </div>
  );
}