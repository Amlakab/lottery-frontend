'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Close as CloseIcon } from '@mui/icons-material';
import MobileHeader from '@/components/spinner-user/MobileHeader';
import MobileNavigation from '@/components/spinner-user/MobileNavigation';
import api from '@/app/utils/api';

interface ItemType {
  _id: string;
  itemId: string;
  name: string;
  price: number;
  image?: string;
}

interface SelectedItemWithCount extends ItemType {
  count: number;
}

interface UserType {
  _id: string;
  phone: string;
  wallet: number;
}

// Global image cache
const imageCache = new Map<string, string>();

type GameView = 'lobby' | 'game';

// ItemCard component moved outside to avoid hook conditional issue
const ItemCard = React.memo(function ItemCard({
  item,
  selectedItems,
  loadedImages,
  loadImageForItem,
  handleItemClick
}: {
  item: ItemType;
  selectedItems: SelectedItemWithCount[];
  loadedImages: Set<string>;
  loadImageForItem: (itemId: string) => void;
  handleItemClick: (item: ItemType) => void;
}) {
  const selectedItem = selectedItems.find(selected => selected._id === item._id);
  const isSelected = !!selectedItem;
  const isImageLoaded = Array.from(loadedImages).includes(item._id);
  
  const handleImageHover = () => {
    if (!isImageLoaded && !imageCache.has(item._id)) {
      loadImageForItem(item._id);
    }
  };

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      onClick={() => handleItemClick(item)}
      className={`cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-yellow-400 bg-yellow-50 transform scale-105' 
          : 'bg-white hover:bg-gray-50'
      } rounded-lg border border-gray-200 p-3 flex flex-col items-center w-full relative mb-4`}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold z-10">
          {selectedItem.count}
        </div>
      )}

      <div 
        className="w-full h-40 mb-3 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center"
        onMouseEnter={handleImageHover}
        onTouchStart={handleImageHover}
      >
        {isImageLoaded && item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <div className="text-gray-400 text-sm">
            {isImageLoaded ? 'No image' : 'Loading...'}
          </div>
        )}
      </div>

      <div className="text-center w-full">
        <div className="font-semibold text-gray-900 text-sm mb-1 truncate w-full">
          {item.name}
        </div>
        <div className="text-xs text-gray-500 mb-1 truncate w-full">
          ID: {item.itemId}
        </div>
        <div className="text-green-600 font-bold text-lg">
          {item.price} Birr
        </div>
      </div>

      <div className={`mt-2 w-6 h-6 rounded-full flex items-center justify-center ${
        isSelected ? 'bg-green-500' : 'bg-gray-200'
      }`}>
        {isSelected && (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </motion.div>
  );
});

import React from 'react';

export default function SpinnerPage() {
  const [currentView, setCurrentView] = useState<GameView>('lobby');
  
  // Common states
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  
  // Lobby states
  const [items, setItems] = useState<ItemType[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItemWithCount[]>([]);
  const [soldValue, setSoldValue] = useState<number>(0);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [selectedItemForCount, setSelectedItemForCount] = useState<ItemType | null>(null);
  const [itemCount, setItemCount] = useState<number>(1);
  
  // Game states
  const [gameItems, setGameItems] = useState<ItemType[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerItem, setWinnerItem] = useState<ItemType | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  
  // Audio refs
  const gameStartedAudioRef = useRef<HTMLAudioElement | null>(null);
  const spinnerAudioRef = useRef<HTMLAudioElement | null>(null);
  const winnerAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch initial data
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        // Fetch user
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          window.location.href = '/auth/login';
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        if (!parsedUser?._id) {
          window.location.href = '/auth/login';
          return;
        }

        // Fetch user data
        const userResponse = await api.get(`/user/${parsedUser._id}`, {
          signal: controller.signal
        });
        const userData: UserType = userResponse.data.data || userResponse.data;
        
        if (isMounted) {
          setUser(userData);
        }

        // Fetch items
        const itemsResponse = await api.get('/items', {
          signal: controller.signal
        });
        
        const itemsData: ItemType[] = itemsResponse.data.map((item: any) => ({
          ...item,
          image: undefined
        }));
        
        if (isMounted) {
          setItems(itemsData);
        }

        // Load saved data from localStorage
        const savedSoldValue = localStorage.getItem('spinnerSoldValue');
        if (savedSoldValue && isMounted) {
          setSoldValue(parseInt(savedSoldValue) || 0);
        }

        const savedSelectedItems = localStorage.getItem('spinnerSelectedItems');
        if (savedSelectedItems && isMounted) {
          try {
            const parsedItems: SelectedItemWithCount[] = JSON.parse(savedSelectedItems);
            const matchedItems = parsedItems
              .map(savedItem => {
                const foundItem = itemsData.find(item => item._id === savedItem._id);
                return foundItem ? { ...foundItem, count: savedItem.count || 1 } : null;
              })
              .filter((item): item is SelectedItemWithCount => item !== null);
            
            setSelectedItems(matchedItems);
          } catch (error) {
            console.error('Failed to parse saved items:', error);
            localStorage.removeItem('spinnerSelectedItems');
          }
        }

        // Lazy load images in background
        if (isMounted) {
          loadImagesInBackground(itemsData);
        }

      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('Failed to fetch data:', err);
        if (isMounted && err.response?.status !== 401) {
          window.location.href = '/auth/login';
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Load images in background
  const loadImagesInBackground = useCallback(async (itemsData: ItemType[]) => {
    const itemsToLoad = itemsData.slice(0, 10);
    
    const imagePromises = itemsToLoad.map(async (item) => {
      if (imageCache.has(item._id)) {
        return { itemId: item._id, imageUrl: imageCache.get(item._id)! };
      }

      try {
        const imageResponse = await api.get(`/items/${item._id}/image`, {
          responseType: 'arraybuffer'
        });
        
        const blob = new Blob([imageResponse.data], { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);
        
        imageCache.set(item._id, imageUrl);
        
        return { itemId: item._id, imageUrl };
      } catch (error) {
        console.warn('Failed to load image for item:', item._id);
        return null;
      }
    });

    const batchSize = 2;
    for (let i = 0; i < imagePromises.length; i += batchSize) {
      const batch = imagePromises.slice(i, i + batchSize);
      const results = await Promise.all(batch);
      
      results.forEach(result => {
        if (result) {
          setItems(prev => prev.map(item => 
            item._id === result.itemId ? { ...item, image: result.imageUrl } : item
          ));
          setLoadedImages(prev => new Set([...Array.from(prev), result.itemId]));
        }
      });
      
      if (i + batchSize < imagePromises.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, []);

  // Load image for specific item
  const loadImageForItem = useCallback(async (itemId: string) => {
    const loadedImagesArray = Array.from(loadedImages);
    if (imageCache.has(itemId) || loadedImagesArray.includes(itemId)) return;
    
    try {
      const imageResponse = await api.get(`/items/${itemId}/image`, {
        responseType: 'arraybuffer'
      });
      
      const blob = new Blob([imageResponse.data], { type: 'image/jpeg' });
      const imageUrl = URL.createObjectURL(blob);
      
      imageCache.set(itemId, imageUrl);
      
      setItems(prev => prev.map(item => 
        item._id === itemId ? { ...item, image: imageUrl } : item
      ));
      setLoadedImages(prev => new Set([...Array.from(prev), itemId]));
    } catch (error) {
      console.warn('Failed to load image for item:', itemId);
    }
  }, [loadedImages]);

  // Lobby functions
  const saveSelectedItemsToStorage = useCallback((items: SelectedItemWithCount[]) => {
    try {
      const itemsToStore = items.map(item => ({
        _id: item._id,
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        count: item.count
      }));
      
      const data = JSON.stringify(itemsToStore);
      localStorage.setItem('spinnerSelectedItems', data);
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }, []);

  const handleItemClick = useCallback((item: ItemType) => {
    const isSelected = selectedItems.some(selected => selected._id === item._id);
    
    if (isSelected) {
      const newSelectedItems = selectedItems.filter(selected => selected._id !== item._id);
      setSelectedItems(newSelectedItems);
      saveSelectedItemsToStorage(newSelectedItems);
    } else {
      setSelectedItemForCount(item);
      setItemCount(1);
      setShowCountModal(true);
    }
  }, [selectedItems, saveSelectedItemsToStorage]);

  const confirmItemWithCount = useCallback(() => {
    if (!selectedItemForCount) return;
    
    const itemWithCount: SelectedItemWithCount = {
      ...selectedItemForCount,
      count: itemCount
    };
    
    const newSelectedItems = [...selectedItems, itemWithCount];
    setSelectedItems(newSelectedItems);
    saveSelectedItemsToStorage(newSelectedItems);
    
    setShowCountModal(false);
    setSelectedItemForCount(null);
  }, [selectedItemForCount, itemCount, selectedItems, saveSelectedItemsToStorage]);

  const handleSoldValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setSoldValue(value);
    try {
      localStorage.setItem('spinnerSoldValue', value.toString());
    } catch (error) {
      console.error('Failed to save sold value:', error);
    }
  }, []);

  const totalItems = useMemo(() => items.length, [items]);
  const selectedItemsCount = useMemo(() => selectedItems.length, [selectedItems]);
  const totalSpinsCount = useMemo(() => 
    selectedItems.reduce((sum, item) => sum + item.count, 0), 
    [selectedItems]
  );
  const totalItemsValue = useMemo(() => 
    selectedItems.reduce((sum, item) => sum + (item.price * item.count), 0), 
    [selectedItems]
  );
  
  const canStartGame = useMemo(() => 
    totalSpinsCount >= 2 && soldValue > 0 && !isStartingGame,
    [totalSpinsCount, soldValue, isStartingGame]
  );

  const startGame = useCallback(async () => {
    if (!canStartGame || !user) return;
    
    setIsStartingGame(true);
    
    try {
      // Create expanded array with duplicates
      const expandedItems: ItemType[] = [];
      selectedItems.forEach(item => {
        for (let i = 0; i < item.count; i++) {
          const itemWithImage = items.find(it => it._id === item._id);
          expandedItems.push({
            _id: `${item._id}_${i}`,
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            image: itemWithImage?.image
          });
        }
      });

      // Shuffle items
      const shuffledItems = [...expandedItems].sort(() => Math.random() - 0.5);
      
      // Set game items (using already loaded images)
      setGameItems(shuffledItems);
      setCurrentItemIndex(0);
      setCurrentView('game');
      
    } catch (error) {
      console.error('Failed to start game:', error);
    } finally {
      setIsStartingGame(false);
    }
  }, [canStartGame, user, selectedItems, items]);

  const clearAllSelections = useCallback(() => {
    setSelectedItems([]);
    try {
      localStorage.removeItem('spinnerSelectedItems');
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }, []);

  // Game functions
  const playSound = useCallback((soundType: 'game-started' | 'spinner' | 'won'): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        let audioRef = null;
        let audioPath = '';
        
        if (soundType === 'spinner') {
          audioPath = '/Audio/game/spinner.m4a';
          if (!spinnerAudioRef.current) {
            spinnerAudioRef.current = new Audio(audioPath);
          }
          audioRef = spinnerAudioRef.current;
        } else {
          audioPath = `/Audio/game/${soundType}.aac`;
          if (soundType === 'game-started') {
            if (!gameStartedAudioRef.current) {
              gameStartedAudioRef.current = new Audio(audioPath);
            }
            audioRef = gameStartedAudioRef.current;
          } else {
            if (!winnerAudioRef.current) {
              winnerAudioRef.current = new Audio(audioPath);
            }
            audioRef = winnerAudioRef.current;
          }
        }
        
        if (!audioRef) {
          reject(new Error(`Audio element not found for ${soundType}`));
          return;
        }
        
        audioRef.pause();
        audioRef.currentTime = 0;
        audioRef.volume = 0.7;
        
        const handleEnded = () => {
          audioRef?.removeEventListener('ended', handleEnded);
          audioRef?.removeEventListener('error', handleError);
          setIsSoundPlaying(false);
          resolve();
        };
        
        const handleError = (error: Event) => {
          console.warn(`Failed to play ${soundType} sound:`, error);
          audioRef?.removeEventListener('ended', handleEnded);
          audioRef?.removeEventListener('error', handleError);
          setIsSoundPlaying(false);
          reject(error);
        };
        
        audioRef.addEventListener('ended', handleEnded);
        audioRef.addEventListener('error', handleError);
        
        const playPromise = audioRef.play();
        setIsSoundPlaying(true);
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            setTimeout(() => {
              audioRef.play().catch(e => handleError(e));
            }, 100);
          });
        }
        
      } catch (error) {
        console.error(`Error playing ${soundType} sound:`, error);
        setIsSoundPlaying(false);
        reject(error);
      }
    });
  }, []);

  const spinWheel = useCallback(async () => {
    if (isSpinning || !user || gameItems.length === 0 || isSoundPlaying) return;

    setIsSoundPlaying(true);

    try {
      await playSound('game-started');

      setIsSpinning(true);
      setWinnerItem(null);
      setShowWinnerModal(false);
      setIsModalVisible(false);

      const segmentAngle = 360 / gameItems.length;
      const targetIndex = Math.floor(Math.random() * gameItems.length);
      const targetItem = gameItems[targetIndex];
      const targetAngle = targetIndex * segmentAngle + segmentAngle / 2;
      const fullRotations = 15 + Math.floor(Math.random() * 11);
      const totalDuration = 10000 + Math.random() * 10000;
      const finalRotation = fullRotations * 360 + (360 - targetAngle);
      
      setSpinDuration(Math.round(totalDuration / 1000));
      playSound('spinner');

      const startTime = Date.now();
      const startRotation = rotation;

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);
        const smoothEaseOut = 1 - Math.pow(1 - progress, 3);
        const currentRotation = startRotation + (finalRotation * smoothEaseOut);
        
        setRotation(currentRotation);

        const normalizedRotation = currentRotation % 360;
        const normalized = (360 - normalizedRotation) % 360;
        const itemIndex = Math.floor(normalized / segmentAngle) % gameItems.length;
        setCurrentItemIndex(itemIndex);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          if (spinnerAudioRef.current) {
            spinnerAudioRef.current.pause();
            spinnerAudioRef.current.currentTime = 0;
          }
          
          setTimeout(() => {
            playSound('won');
          }, 500);
          
          const finalNormalized = (360 - (currentRotation % 360)) % 360;
          const finalIndex = Math.floor(finalNormalized / segmentAngle) % gameItems.length;
          const finalWinner = gameItems[finalIndex];
          
          setWinnerItem(finalWinner);
          setCurrentItemIndex(finalIndex);
          saveGameHistory(finalWinner);
          setIsSpinning(false);
          
          setTimeout(() => {
            setIsModalVisible(true);
            setTimeout(() => setShowWinnerModal(true), 300);
          }, 1000);
        }
      };

      requestAnimationFrame(animate);

    } catch (error) {
      console.error('Error in spin sequence:', error);
      setIsSoundPlaying(false);
      setIsSpinning(false);
    }
  }, [isSpinning, user, gameItems, rotation, isSoundPlaying, playSound]);

  const saveGameHistory = useCallback(async (winnerItem: ItemType) => {
    if (!user) return;
    setIsGameLoading(true);
    try {
      const originalId = winnerItem._id.split('_')[0];
      
      await api.post('/spinner/history', {
        winnerItemId: originalId,
        winnerItemName: winnerItem.name,
        winnerItemPrice: winnerItem.price,
        totalValue: soldValue,
        numberOfItems: gameItems.length,
        selectedItems: []
      });

      const response = await api.get(`/user/${user._id}`);
      const userData: UserType = response.data;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error: any) {
      console.error('Failed to save game history:', error);
    } finally {
      setIsGameLoading(false);
    }
  }, [user, soldValue, gameItems]);

  const getColor = useCallback((index: number) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#10AC84', '#EE5A24', '#0984E3', '#A29BFE', '#FD79A8'
    ];
    return colors[index % colors.length];
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (gameStartedAudioRef.current) {
        gameStartedAudioRef.current.pause();
        gameStartedAudioRef.current = null;
      }
      if (spinnerAudioRef.current) {
        spinnerAudioRef.current.pause();
        spinnerAudioRef.current = null;
      }
      if (winnerAudioRef.current) {
        winnerAudioRef.current.pause();
        winnerAudioRef.current = null;
      }
      
      imageCache.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full">
        <MobileHeader title="Spinner Lobby" />
        <div className="flex items-center justify-center h-screen w-full pt-16 pb-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 w-full">
        <MobileHeader title="Spinner Lobby" />
        <div className="flex items-center justify-center h-screen w-full pt-16 pb-16">
          <div className="text-gray-600 text-xl">Please login to continue</div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  // LOBBY VIEW
  if (currentView === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-50 w-full">
        <MobileHeader title="Spinner Lobby" />

        <main className="px-4 pb-24 pt-16 w-full max-w-full mx-auto overflow-x-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
            className="w-full mb-6"
          >
            <div className="bg-white p-4 rounded-lg shadow-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sold Value (Birr)
              </label>
              <input
                type="number"
                min="0"
                value={soldValue}
                onChange={handleSoldValueChange}
                className="w-full px-4 py-2 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                placeholder="Enter sold value"
              />
              <p className="text-xs text-gray-500 mt-2">
                This value will be used as the total value for the spinner game
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4 w-full mb-6"
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg text-center">
              <div className="text-sm opacity-90">Selected Items</div>
              <div className="text-2xl font-bold">{selectedItemsCount}/{totalItems}</div>
            </div>
            
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg text-center">
              <div className="text-sm opacity-90">Total Items Value</div>
              <div className="text-2xl font-bold">
                {totalItemsValue} Birr
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3 }}
            className="w-full mb-6"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => (
                <ItemCard 
                  key={item._id} 
                  item={item}
                  selectedItems={selectedItems}
                  loadedImages={loadedImages}
                  loadImageForItem={loadImageForItem}
                  handleItemClick={handleItemClick}
                />
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.4 }}
            className="flex justify-center gap-3 w-full mt-6"
          >
            <button
              onClick={clearAllSelections}
              disabled={selectedItemsCount === 0}
              className={`px-6 py-3 rounded-lg transition-colors text-sm font-medium ${
                selectedItemsCount === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              Clear All
            </button>
            
            <button
              onClick={startGame}
              disabled={!canStartGame}
              className={`px-6 py-3 rounded-lg transition-colors text-sm font-medium ${
                canStartGame
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isStartingGame ? 'Starting...' : 
                canStartGame 
                  ? `Start Game (${totalSpinsCount} spins, ${soldValue} Birr)` 
                  : totalSpinsCount < 2 
                    ? 'Select at least 2 total spins' 
                    : 'Enter sold value'}
            </button>
          </motion.div>
        </main>

        {showCountModal && selectedItemForCount && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                How many times for "{selectedItemForCount.name}"?
              </h3>
              
              <div className="flex items-center justify-center space-x-4 mb-6">
                <button
                  onClick={() => setItemCount(Math.max(1, itemCount - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                >
                  <span className="text-xl">-</span>
                </button>
                <div className="text-3xl font-bold text-gray-800 w-16 text-center">
                  {itemCount}
                </div>
                <button
                  onClick={() => setItemCount(itemCount + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                >
                  <span className="text-xl">+</span>
                </button>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCountModal(false)}
                  className="flex-1 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmItemWithCount}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Add ({itemCount})
                </button>
              </div>
            </div>
          </div>
        )}

        <MobileNavigation />
      </div>
    );
  }

  // GAME VIEW
  if (gameItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-xl">No items selected</div>
        <button
          onClick={() => setCurrentView('lobby')}
          className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  const spinnerSize = 300;
  const segmentAngle = 360 / gameItems.length;
  const currentItem = gameItems[currentItemIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Sold Value Display */}
        <div className="mb-2 flex justify-center">
          <div className="bg-yellow-500 rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg border-4 border-white">
            <div className="text-white text-xs font-bold">Sold Value</div>
            <div className="text-white text-lg font-bold">{soldValue} Birr</div>
          </div>
        </div>

        {/* Current Item Display */}
        <div className="relative mb-4 flex justify-center">
          <div className="flex flex-col items-center">
            <div className="mb-2 bg-red-600 text-white rounded-lg p-3 shadow-lg border-2 border-white z-20 min-w-[200px]">
              <div className="font-bold text-lg mb-1">{currentItem?.name}</div>
              <div className="text-sm opacity-90">{currentItem?.price} Birr</div>
            </div>
            
            <div className="flex flex-col items-center relative">
              <div className="relative">
                <div className="w-2 h-16 bg-red-600 relative mx-auto"></div>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-8 border-l-transparent border-r-transparent border-t-red-600"></div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-red-600"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Spinner */}
        <div className="relative mb-8 flex justify-center -mt-8">
          <div
            className="relative rounded-full shadow-lg border-4 border-gray-300 overflow-hidden"
            style={{
              width: `${spinnerSize}px`,
              height: `${spinnerSize}px`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center',
              }}
            >
              {gameItems.map((item, index) => {
                const angle = segmentAngle * index;
                const isActive = currentItemIndex === index;

                return (
                  <div
                    key={`${item._id}_${index}`}
                    className="absolute top-0 left-0 w-full h-full"
                    style={{
                      transform: `rotate(${angle}deg)`,
                      transformOrigin: 'center',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    <div
                      className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left"
                      style={{
                        backgroundColor: getColor(index),
                        clipPath: 'polygon(100% 50%, 0% 0%, 0% 100%)',
                      }}
                    >
                      <div
                        className="absolute text-white font-bold"
                        style={{
                          top: '50%',
                          left: '30%',
                          transform: 'translate(-50%, -50%) rotate(90deg)',
                          fontSize: '14px',
                          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                          maxWidth: '60px',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gray-800 rounded-full border-4 border-white z-10"></div>
          </div>
        </div>

        {/* Spin Button */}
        <button
          onClick={spinWheel}
          disabled={isSpinning || isGameLoading || isSoundPlaying}
          className={`w-full max-w-md py-4 text-lg rounded-full font-bold transition-all shadow-lg mb-8 ${
            isSpinning || isGameLoading || isSoundPlaying
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isSoundPlaying && !isSpinning ? 'Preparing...' : 
           isSpinning ? `Spinning... (${spinDuration}s)` : 'Spin Wheel'}
        </button>

        {/* Winner Modal */}
        {showWinnerModal && winnerItem && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div 
              className={`absolute inset-0 bg-black/50 transition-opacity duration-500 ${
                isModalVisible ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => {
                setIsModalVisible(false);
                setTimeout(() => setShowWinnerModal(false), 300);
              }}
            ></div>

            <div 
              className={`bg-white rounded-2xl p-6 w-full max-w-sm relative z-10 transform transition-all duration-500 ${
                isModalVisible 
                  ? 'scale-100 opacity-100 translate-y-0' 
                  : 'scale-75 opacity-0 translate-y-10'
              }`}
            >
              <button
                onClick={() => {
                  setIsModalVisible(false);
                  setTimeout(() => setShowWinnerModal(false), 300);
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors duration-200 z-20 bg-white rounded-full p-1 shadow-sm"
                title="Close"
              >
                <CloseIcon className="text-2xl" />
              </button>

              <div className="text-center pt-2">
                <div className="text-6xl mb-4 animate-bounce">🎉</div>
                <h2 className="text-3xl font-bold text-green-600 mb-4 animate-pulse">
                  Winner Item!
                </h2>
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-6 border border-blue-200 shadow-lg">
                  <div className="w-full h-56 mb-4 rounded-lg bg-white p-3 shadow-inner overflow-hidden relative">
                    {winnerItem.image ? (
                      <img
                        src={winnerItem.image}
                        alt={winnerItem.name}
                        className={`w-full h-full object-contain animate-zoominout transition-transform duration-1000`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                        No image available
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-gray-900 truncate">
                      {winnerItem.name}
                    </h3>
                    <div className="text-gray-600 text-sm">ID: {winnerItem.itemId}</div>
                    <div className="text-3xl font-bold text-green-600 animate-pulse">
                      {winnerItem.price} Birr
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setIsModalVisible(false);
                      setTimeout(() => {
                        setShowWinnerModal(false);
                        setCurrentView('lobby');
                      }, 300);
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    Return to Lobby
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes zoominout {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-zoominout {
          animation: zoominout 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}