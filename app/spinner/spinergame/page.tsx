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

  // Function to play sound effects with better error handling
  const playSound = (soundType: 'game-started' | 'spinner' | 'won'): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        let audioRef = null;
        let audioPath = '';
        
        // Determine which audio file to play
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
        
        // Reset audio
        audioRef.pause();
        audioRef.currentTime = 0;
        
        // Set volume
        audioRef.volume = 0.7;
        
        // Set up event listeners
        const handleEnded = () => {
          console.log(`${soundType} sound finished playing`);
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
        
        // Play with error handling
        const playPromise = audioRef.play();
        setIsSoundPlaying(true);
        console.log(`Playing ${soundType} from: ${audioPath}`);
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Initial play failed for ${soundType}:`, error);
            // Try alternative approach
            setTimeout(() => {
              audioRef.play()
                .then(() => console.log(`Retry succeeded for ${soundType}`))
                .catch(e => {
                  console.warn(`Retry failed for ${soundType}:`, e);
                  handleError(e);
                });
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
    const fetchUser = async () => {
      if (typeof window === 'undefined') return;
      try {
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
      } catch (err) {
        console.error('Failed to fetch user:', err);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Get selected items and sold value from sessionStorage
    const storedItems = sessionStorage.getItem('selectedItems');
    const storedSoldValue = sessionStorage.getItem('soldValue');
    
    if (storedItems) {
      const items = JSON.parse(storedItems);
      setSelectedItems(items);
      setCurrentItemIndex(0);
    } else {
      router.push('/spinner/spinnerlobby');
    }

    if (storedSoldValue) {
      setSoldValue(parseInt(storedSoldValue) || 0);
    }
  }, [router]);

  const totalItems = selectedItems.length;

  // Smooth spinner logic with proper sound timing
  const spinWheel = useCallback(async () => {
    if (isSpinning || !user || totalItems === 0 || isSoundPlaying) return;

    console.log('Spin button clicked - starting sound sequence...');

    // Disable spin button while sound is playing
    setIsSoundPlaying(true);

    try {
      // Step 1: Play game-started sound and wait for it to finish
      console.log('Playing game-started sound...');
      await playSound('game-started');
      console.log('Game-started sound finished. Starting spin...');

      // Step 2: Start spinning animation
      setIsSpinning(true);
      setWinnerItem(null);
      setShowWinnerModal(false);
      setIsModalVisible(false);

      const segmentAngle = 360 / totalItems;
      
      // Random target item
      const targetIndex = Math.floor(Math.random() * totalItems);
      const targetItem = selectedItems[targetIndex];
      
      // Calculate the angle for the target segment
      const targetAngle = targetIndex * segmentAngle + segmentAngle / 2;
      
      // Random number of full rotations (15-25 rotations for longer duration)
      const fullRotations = 15 + Math.floor(Math.random() * 11); // 15-25 rotations
      
      // Random duration between 10-20 seconds
      const totalDuration = 10000 + Math.random() * 10000; // 10,000 to 20,000 ms
      
      // Calculate final rotation to land on target segment after all rotations
      const finalRotation = fullRotations * 360 + (360 - targetAngle);
      
      setSpinDuration(Math.round(totalDuration / 1000));

      // Step 3: Start spinner sound when spinning begins
      playSound('spinner');

      const startTime = Date.now();
      const startRotation = rotation;

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);

        // Ultra-smooth easing function for continuous deceleration
        const smoothEaseOut = 1 - Math.pow(1 - progress, 3);

        // Calculate current rotation
        const currentRotation = startRotation + (finalRotation * smoothEaseOut);
        
        setRotation(currentRotation);

        // Determine current item based on arrow (top = 0 deg)
        const normalizedRotation = currentRotation % 360;
        const normalized = (360 - normalizedRotation) % 360;
        const itemIndex = Math.floor(normalized / segmentAngle) % totalItems;
        setCurrentItemIndex(itemIndex);

        if (progress < 1) {
          // Continue animation
          requestAnimationFrame(animate);
        } else {
          console.log('Spinning ended');
          
          // Stop spinner sound when spinning ends
          if (spinnerAudioRef.current) {
            spinnerAudioRef.current.pause();
            spinnerAudioRef.current.currentTime = 0;
          }
          
          // Step 4: Play winner sound when spinning ends
          setTimeout(() => {
            playSound('won');
          }, 500);
          
          // Final position calculation
          const finalNormalized = (360 - (currentRotation % 360)) % 360;
          const finalIndex = Math.floor(finalNormalized / segmentAngle) % totalItems;
          const finalWinner = selectedItems[finalIndex];
          
          console.log('Winner:', finalWinner.name);
          
          setWinnerItem(finalWinner);
          setCurrentItemIndex(finalIndex);
          saveGameHistory(finalWinner);
          setIsSpinning(false);
          
          // Show modal with animation
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
      const historyResponse = await api.post('/spinner/history', {
        winnerItemId: winnerItem._id,
        winnerItemName: winnerItem.name,
        winnerItemPrice: winnerItem.price,
        totalValue: soldValue,
        numberOfItems: totalItems,
        selectedItems: selectedItems.map(item => item._id)
      });

      if (historyResponse.data) {
        const response = await api.get(`/user/${user._id}`);
        const userData: UserType = response.data;
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-800 text-xl">Loading game...</div>
      </div>
    );
  }

  if (!user || totalItems === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-800 text-xl">Game data not available</div>
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
                {/* Arrow shaft pointing down */}
                <div className="w-2 h-16 bg-red-600 relative mx-auto"></div>
                {/* Arrow tip */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-8 border-l-transparent border-r-transparent border-t-red-600"></div>
                {/* Thin arrow line extending to spinner */}
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
                    key={item._id}
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

        {/* Sound Status Indicator */}
        {/* {isSoundPlaying && !isSpinning && (
          <div className="mb-4">
            <div className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              <span className="mr-2">🔊 Playing game sound...</span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )} */}

        {/* Winner Modal with Enhanced Animation */}
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
              {/* X Button at top right - ONLY CLOSES MODAL */}
              <button
                onClick={() => {
                  setIsModalVisible(false);
                  setTimeout(() => {
                    setShowWinnerModal(false);
                    // Does NOT redirect, just closes modal
                  }, 300);
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
                
                {/* Winner Item Card */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-6 border border-blue-200 shadow-lg">
                  {/* Animated Item Image Container */}
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
                  
                  {/* Item Details */}
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

                {/* Two buttons: Play Again and Return to Lobby */}
                <div className="flex flex-col gap-3">
                  {/* <button
                    onClick={() => {
                      setIsModalVisible(false);
                      setTimeout(() => {
                        setShowWinnerModal(false);
                        // Reset game state for another spin
                        setRotation(0);
                        setCurrentItemIndex(0);
                        setWinnerItem(null);
                      }, 300);
                    }}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    Spin Again
                  </button> */}
                  
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

      {/* Add CSS animation for zoom in-out effect */}
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