'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/app/utils/api';
import { Close as CloseIcon } from '@mui/icons-material';

interface ItemType {
  _id: string;
  itemId: string;
  name: string;
  price: number;
  image?: string;
}

interface UserType {
  _id: string;
  phone: string;
  wallet: number;
}

// Global image cache
const imageCache = new Map<string, string>();

export default function SpinnerGame() {
  const router = useRouter();
  const { logout } = useAuth();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedItems, setSelectedItems] = useState<ItemType[]>([]);
  const [soldValue, setSoldValue] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerItem, setWinnerItem] = useState<ItemType | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);

  // Audio refs for different sounds
  const gameStartedAudioRef = useRef<HTMLAudioElement | null>(null);
  const spinnerAudioRef = useRef<HTMLAudioElement | null>(null);
  const winnerAudioRef = useRef<HTMLAudioElement | null>(null);

  // Optimized function to fetch ALL images fast
  const fetchAllImagesFast = useCallback(async (items: ItemType[]): Promise<ItemType[]> => {
    if (items.length === 0) return items;
    
    console.log(`Starting fast image fetch for ${items.length} items...`);
    
    // Step 1: Get unique original IDs
    const uniqueIds = Array.from(
      new Set(items.map(item => item._id.split('_')[0]))
    );
    
    console.log(`Unique items to fetch: ${uniqueIds.length}`);
    
    // Step 2: Check cache first
    const cachedIds: string[] = [];
    const uncachedIds: string[] = [];
    
    uniqueIds.forEach(id => {
      if (imageCache.has(id)) {
        cachedIds.push(id);
      } else {
        uncachedIds.push(id);
      }
    });
    
    console.log(`Cached: ${cachedIds.length}, Need to fetch: ${uncachedIds.length}`);
    
    // Step 3: Fetch uncached images in parallel with concurrency limit
    if (uncachedIds.length > 0) {
      const concurrencyLimit = 10; // Fetch 10 images at once
      const batches = [];
      
      for (let i = 0; i < uncachedIds.length; i += concurrencyLimit) {
        batches.push(uncachedIds.slice(i, i + concurrencyLimit));
      }
      
      console.log(`Fetching in ${batches.length} batches...`);
      
      // Process all batches
      const batchPromises = batches.map(async (batch, batchIndex) => {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (itemId) => {
            try {
              const imageResponse = await api.get(`/items/${itemId}/image`, {
                responseType: 'arraybuffer'
              });
              
              // Convert to base64 (fastest for display)
              const bytes = new Uint8Array(imageResponse.data);
              let binary = '';
              
              // Fast conversion using TypedArray reduce
              const chunkSize = 32768; // Larger chunks for speed
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.slice(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, Array.from(chunk));
              }
              
              const base64 = btoa(binary);
              const imageUrl = `data:image/jpeg;base64,${base64}`;
              
              imageCache.set(itemId, imageUrl);
              return { itemId, imageUrl, success: true };
            } catch (error) {
              console.warn(`Failed to fetch image for ${itemId}:`, error);
              return { itemId, imageUrl: null, success: false };
            }
          })
        );
        
        // Small delay between batches to prevent overwhelming
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        return batchResults;
      });
      
      // Wait for ALL batches to complete
      const allBatchResults = await Promise.all(batchPromises);
      console.log('All image batches completed');
    }
    
    // Step 4: Map images back to all items (including duplicates)
    const itemsWithImages = items.map(item => {
      const originalId = item._id.split('_')[0];
      const cachedImage = imageCache.get(originalId);
      
      if (cachedImage) {
        return { ...item, image: cachedImage };
      }
      
      // If no image in cache, return item without image
      return item;
    });
    
    const loadedCount = itemsWithImages.filter(item => item.image).length;
    console.log(`Image loading complete: ${loadedCount}/${items.length} items have images`);
    
    return itemsWithImages;
  }, []);

  // Function to play sound effects
  const playSound = (soundType: 'game-started' | 'spinner' | 'won'): Promise<void> => {
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
  };

  // Cleanup audio on unmount
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
    };
  }, []);

  useEffect(() => {
    const initializeGame = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        // Fetch user
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          router.push('/auth/login');
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        if (!parsedUser?._id) {
          router.push('/auth/login');
          return;
        }

        const response = await api.get(`/user/${parsedUser._id}`);
        const userData: UserType = response.data;
        setUser(userData);

        // Get game data from sessionStorage
        const gameDataStr = sessionStorage.getItem('spinnerGameData');
        if (!gameDataStr) {
          router.push('/spinner/spinnerlobby');
          return;
        }

        const gameData = JSON.parse(gameDataStr);
        const itemsWithoutImages = gameData.selectedItems || [];
        setSoldValue(gameData.soldValue || 0);
        
        if (itemsWithoutImages.length === 0) {
          setSelectedItems([]);
          setLoading(false);
          return;
        }
        
        console.log('Starting game initialization with', itemsWithoutImages.length, 'items');
        console.time('imageLoading');
        
        // FETCH ALL IMAGES FIRST
        const itemsWithImages = await fetchAllImagesFast(itemsWithoutImages);
        console.timeEnd('imageLoading');
        
        console.log('Images loaded, setting items...');
        setSelectedItems(itemsWithImages);
        setCurrentItemIndex(0);
        
      } catch (err) {
        console.error('Failed to initialize game:', err);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    initializeGame();
  }, [router, fetchAllImagesFast]);

  const totalItems = selectedItems.length;

  // Smooth spinner logic
  const spinWheel = useCallback(async () => {
    if (isSpinning || !user || totalItems === 0 || isSoundPlaying) return;

    setIsSoundPlaying(true);

    try {
      await playSound('game-started');

      setIsSpinning(true);
      setWinnerItem(null);
      setShowWinnerModal(false);
      setIsModalVisible(false);

      const segmentAngle = 360 / totalItems;
      
      // Random target item
      const targetIndex = Math.floor(Math.random() * totalItems);
      const targetItem = selectedItems[targetIndex];
      
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
        const itemIndex = Math.floor(normalized / segmentAngle) % totalItems;
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
          const finalIndex = Math.floor(finalNormalized / segmentAngle) % totalItems;
          const finalWinner = selectedItems[finalIndex];
          
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
  }, [isSpinning, user, totalItems, selectedItems, rotation, isSoundPlaying]);

  const saveGameHistory = async (winnerItem: ItemType) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const originalId = winnerItem._id.split('_')[0];
      
      await api.post('/spinner/history', {
        winnerItemId: originalId,
        winnerItemName: winnerItem.name,
        winnerItemPrice: winnerItem.price,
        totalValue: soldValue,
        numberOfItems: totalItems,
        selectedItems: []
      });

      const response = await api.get(`/user/${user._id}`);
      const userData: UserType = response.data;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error: any) {
      console.error('Failed to save game history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getColor = (index: number) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#10AC84', '#EE5A24', '#0984E3', '#A29BFE', '#FD79A8'
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
        <div className="text-gray-600 text-lg">Loading game images...</div>
        <div className="text-gray-500 text-sm mt-2">Please wait while we prepare the spinner</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-xl">Please login to continue</div>
      </div>
    );
  }

  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-xl">No items selected</div>
      </div>
    );
  }

  const spinnerSize = 300;
  const segmentAngle = 360 / totalItems;
  const currentItem = selectedItems[currentItemIndex];

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

        {/* Current Item Display above arrow */}
        <div className="relative mb-4 flex justify-center">
          <div className="flex flex-col items-center">
            {/* Current Item Display */}
            <div className="mb-2 bg-red-600 text-white rounded-lg p-3 shadow-lg border-2 border-white z-20 min-w-[200px]">
              <div className="font-bold text-lg mb-1">{currentItem?.name}</div>
              <div className="text-sm opacity-90">{currentItem?.price} Birr</div>
            </div>
            
            {/* Enhanced Arrow pointing DOWN to spinner */}
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
              {selectedItems.map((item, index) => {
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

            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gray-800 rounded-full border-4 border-white z-10"></div>
          </div>
        </div>

        {/* Spin Button */}
        <button
          onClick={spinWheel}
          disabled={isSpinning || isLoading || isSoundPlaying}
          className={`w-full max-w-md py-4 text-lg rounded-full font-bold transition-all shadow-lg mb-8 ${
            isSpinning || isLoading || isSoundPlaying
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
                        router.push('/spinner/spinnerlobby');
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