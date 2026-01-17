'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobileHeader from '@/components/spinner-user/MobileHeader';
import MobileNavigation from '@/components/spinner-user/MobileNavigation';
import api from '@/app/utils/api';
import { motion } from 'framer-motion';

interface ItemType {
  _id: string;
  itemId: string;
  name: string;
  price: number;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    price: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch item image
  const fetchItemImage = async (itemId: string): Promise<string | null> => {
    try {
      const response = await api.get(`/items/${itemId}/image`, {
        responseType: 'arraybuffer'
      });
      
      // Convert arraybuffer to base64
      const base64 = btoa(
        new Uint8Array(response.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );
      
      // Get content type from response headers
      const contentType = response.headers['content-type'] || 'image/jpeg';
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      console.error(`Failed to fetch image for item ${itemId}:`, error);
      return null;
    }
  };

  // Function to fetch item details with image
  const fetchItemDetails = async (itemId: string): Promise<ItemType | null> => {
    try {
      const response = await api.get(`/items/${itemId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch details for item ${itemId}:`, error);
      return null;
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      
      // First get all items (without images)
      const response = await api.get('/items');
      const itemsData = response.data;
      
      // Fetch image for each item
      const itemsWithImages = await Promise.all(
        itemsData.map(async (item: any) => {
          try {
            const imageUrl = await fetchItemImage(item._id);
            return {
              ...item,
              image: imageUrl
            };
          } catch (error) {
            console.error(`Failed to load image for item ${item._id}:`, error);
            return item;
          }
        })
      );
      
      setItems(itemsWithImages);
    } catch (err: any) {
      console.error('Failed to fetch items:', err);
      setError(err.response?.data?.error || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddItem = async () => {
    if (!formData.name.trim() || !formData.price.trim() || !imageFile) {
      setError('Please fill all fields and select an image');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name.trim());
      formDataToSend.append('price', formData.price);
      formDataToSend.append('image', imageFile);

      const response = await api.post('/items', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Fetch the image for the new item
      const newItem = response.data;
      const imageUrl = await fetchItemImage(newItem._id);
      const itemWithImage = {
        ...newItem,
        image: imageUrl
      };

      setItems(prev => [itemWithImage, ...prev]);
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      console.error('Failed to add item:', err);
      setError(err.response?.data?.error || 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async () => {
    if (!selectedItem || !formData.name.trim() || !formData.price.trim()) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name.trim());
      formDataToSend.append('price', formData.price);
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      await api.put(`/items/${selectedItem._id}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Refresh items
      await fetchItems();
      setShowEditModal(false);
      resetForm();
    } catch (err: any) {
      console.error('Failed to update item:', err);
      setError(err.response?.data?.error || 'Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    try {
      setIsSubmitting(true);
      await api.delete(`/items/${selectedItem._id}`);
      setItems(prev => prev.filter(item => item._id !== selectedItem._id));
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      setError(err.response?.data?.error || 'Failed to delete item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
    });
    setImageFile(null);
    setImagePreview(null);
    setCurrentImage(null);
    setSelectedItem(null);
    setError(null);
  };

  const openEditModal = async (item: ItemType) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
    });
    setImagePreview(null);
    
    // Load current image if available
    if (item.image) {
      setCurrentImage(item.image);
    } else {
      // Try to fetch image
      const imageUrl = await fetchItemImage(item._id);
      setCurrentImage(imageUrl);
    }
    
    setShowEditModal(true);
  };

  const openDeleteModal = (item: ItemType) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ET', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full">
        <MobileHeader title="Manage Items" />
        <div className="flex items-center justify-center h-screen w-full pt-16 pb-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <MobileHeader title="Manage Items" />

      <main className="px-4 pb-24 pt-16 w-full max-w-full mx-auto">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Add Item Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Item
          </button>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {items.map((item) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow"
            >
              {/* Item Image */}
              <div className="h-48 bg-gray-100 overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YzZjRmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhMGE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">No Image</span>
                  </div>
                )}
              </div>

              {/* Item Details */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {item.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">ID: {item.itemId}</p>
                  </div>
                  <span className="text-xl font-bold text-green-600 ml-2">
                    {formatPrice(item.price)} Birr
                  </span>
                </div>

                <div className="text-xs text-gray-400 mb-4">
                  Added: {new Date(item.createdAt).toLocaleDateString()}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditModal(item)}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => openDeleteModal(item)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Items Found</h3>
            <p className="text-gray-500 mb-6">Add your first item to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-500 hover:bg-green-600 text-white py-2 px-6 rounded-lg font-medium inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add First Item
            </button>
          </div>
        )}

        {/* Add Item Modal */}
        {showAddModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Item</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Item Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter item name"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Price (Birr) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter price"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Item Image *</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {imagePreview ? (
                        <div className="space-y-2">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-32 h-32 object-cover rounded-lg mx-auto"
                          />
                          <p className="text-sm text-gray-600">Click to change image</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-600">Click to upload image</p>
                          <p className="text-xs text-gray-500">PNG, JPG, JPEG up to 5MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={isSubmitting || !formData.name || !formData.price || !imageFile}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {showEditModal && selectedItem && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Item</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Item Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Price (Birr) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Item Image</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="edit-image-upload"
                    />
                    <label htmlFor="edit-image-upload" className="cursor-pointer">
                      {imagePreview ? (
                        <div className="space-y-2">
                          <img
                            src={imagePreview}
                            alt="New Preview"
                            className="w-32 h-32 object-cover rounded-lg mx-auto"
                          />
                          <p className="text-sm text-gray-600">New image selected. Click to change.</p>
                        </div>
                      ) : currentImage ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <img
                              src={currentImage}
                              alt={selectedItem.name}
                              className="w-32 h-32 object-cover rounded-lg mx-auto"
                            />
                            <div className="absolute inset-0 bg-black/10 rounded-lg"></div>
                          </div>
                          <p className="text-sm text-gray-600">Current image. Click to change.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-600">No image. Click to upload.</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditItem}
                  disabled={isSubmitting || !formData.name || !formData.price}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Updating...' : 'Update Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedItem && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="text-center mb-4">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Item</h3>
                <p className="text-gray-600 mb-2">Are you sure you want to delete this item?</p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="font-semibold text-red-700">{selectedItem.name}</p>
                  <p className="text-sm text-red-600">ID: {selectedItem.itemId} • {formatPrice(selectedItem.price)} Birr</p>
                </div>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedItem(null);
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteItem}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Item'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <MobileNavigation />
    </div>
  );
}