'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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

interface UserType {
  _id: string;
  phone: string;
  wallet: number;
}

export default function SpinnerLobby() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [items, setItems] = useState<ItemType[]>([]);
  const [selectedItems, setSelectedItems] = useState<ItemType[]>([]);
  const [soldValue, setSoldValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
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

        const userResponse = await api.get(`/user/${parsedUser._id}`);
        const userData: UserType = userResponse.data.data || userResponse.data;
        setUser(userData);

        // Fetch items
        const itemsResponse = await api.get('/items');
        const itemsData = await Promise.all(
          itemsResponse.data.map(async (item: any) => {
            // Fetch image for each item
            try {
              const imageResponse = await api.get(`/items/${item._id}/image`, {
                responseType: 'arraybuffer'
              });
              const base64 = btoa(
                new Uint8Array(imageResponse.data).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  ''
                )
              );
              return {
                ...item,
                image: `data:image/jpeg;base64,${base64}`
              };
            } catch (error) {
              console.error('Failed to load image for item:', item._id);
              return item;
            }
          })
        );
        setItems(itemsData);

        // Load saved data from localStorage
        const savedSoldValue = localStorage.getItem('spinnerSoldValue');
        if (savedSoldValue) {
          setSoldValue(parseInt(savedSoldValue) || 0);
        }

        const savedSelectedItems = localStorage.getItem('spinnerSelectedItems');
        if (savedSelectedItems) {
          const parsedItems = JSON.parse(savedSelectedItems);
          // We need to match the saved items with the fetched items by _id
          const matchedItems = parsedItems
            .map((savedItem: any) => 
              itemsData.find((item: ItemType) => item._id === savedItem._id)
            )
            .filter((item: ItemType | undefined) => item !== undefined);
          setSelectedItems(matchedItems);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [router]);

  const toggleItemSelection = (item: ItemType) => {
    let newSelectedItems;
    const isSelected = selectedItems.some(selected => selected._id === item._id);
    
    if (isSelected) {
      // Remove from selection
      newSelectedItems = selectedItems.filter(selected => selected._id !== item._id);
    } else {
      // Add to selection
      newSelectedItems = [...selectedItems, item];
    }
    
    setSelectedItems(newSelectedItems);
    
    // Save to localStorage
    localStorage.setItem('spinnerSelectedItems', JSON.stringify(newSelectedItems));
  };

  const handleSoldValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setSoldValue(value);
    localStorage.setItem('spinnerSoldValue', value.toString());
  };

  const totalItems = items.length;
  const canStartGame = selectedItems.length >= 2 && soldValue > 0;

  const startGame = () => {
    if (!canStartGame || !user) return;
    
    // Store selected items and sold value in sessionStorage for game page
    sessionStorage.setItem('selectedItems', JSON.stringify(selectedItems));
    sessionStorage.setItem('soldValue', soldValue.toString());
    
    router.push('/spinner/spinergame');
  };

  const clearAllSelections = () => {
    setSelectedItems([]);
    localStorage.removeItem('spinnerSelectedItems');
  };

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

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <MobileHeader title="Spinner Lobby" />

      <main className="px-4 pb-24 pt-16 w-full max-w-full mx-auto overflow-x-hidden">
        {/* Sold Value Input */}
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
        
        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4 w-full mb-6"
        >
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg text-center">
            <div className="text-sm opacity-90">Selected Items</div>
            <div className="text-2xl font-bold">{selectedItems.length}/{totalItems}</div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg text-center">
            <div className="text-sm opacity-90">Total Items Value</div>
            <div className="text-2xl font-bold">
              {selectedItems.reduce((sum, item) => sum + item.price, 0)} Birr
            </div>
          </div>
        </motion.div>

        

        {/* Items Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.3 }}
          className="w-full mb-6"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => {
              const isSelected = selectedItems.some(selected => selected._id === item._id);
              
              return (
                <motion.div
                  key={item._id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleItemSelection(item)}
                  className={`cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'ring-2 ring-yellow-400 bg-yellow-50 transform scale-105' 
                      : 'bg-white hover:bg-gray-50'
                  } rounded-lg border border-gray-200 p-3 flex flex-col items-center w-full`}
                >
                  {/* Item Image - Full width of card */}
                  <div className="w-full h-40 mb-3 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-gray-400 text-sm">No image</div>
                    )}
                  </div>

                  {/* Item Details */}
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

                  {/* Selection Indicator */}
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
            })}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.4 }}
          className="flex justify-center gap-3 w-full"
        >
          <button
            onClick={clearAllSelections}
            disabled={selectedItems.length === 0}
            className={`px-6 py-3 rounded-lg transition-colors text-sm font-medium ${
              selectedItems.length === 0
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
            {canStartGame 
              ? `Start Game (${selectedItems.length} items, ${soldValue} Birr)` 
              : selectedItems.length < 2 
                ? 'Select at least 2 items' 
                : 'Enter sold value'}
          </button>
        </motion.div>
      </main>

      <MobileNavigation />
    </div>
  );
}