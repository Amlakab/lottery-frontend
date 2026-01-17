'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent,
  TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
  Chip, Alert, Snackbar, CircularProgress,
  useMediaQuery, Pagination,
  MenuItem, Select, FormControl, InputLabel,
  IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Avatar,
  Stack, Tooltip,
  Paper, Divider
} from '@mui/material';
import { motion } from 'framer-motion';
import { useTheme } from '@/lib/theme-context';
import {
  VideoLibrary, Description, Image,
  Visibility, CalendarToday, Person, Category,
  Search, Refresh,
  CheckCircle, Cancel, HourglassEmpty,
  Star, DateRange,
  ThumbUp, ThumbDown, Gavel,
  YouTube, PictureAsPdf, InsertPhoto
} from '@mui/icons-material';
import api from '@/app/utils/api';
import { format, parseISO } from 'date-fns';

interface Resource {
  _id: string;
  title: string;
  description: string;
  type: 'video' | 'document' | 'image';
  status: 'pending' | 'approved' | 'rejected';
  visibility: 'visible' | 'hidden';
  category: string;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  tags: string[];
  isFeatured: boolean;
  viewsCount: number;
  downloadsCount: number;
  
  // Video specific
  youtubeUrl?: string;
  videoId?: string;
  thumbnail?: string;
  
  // Document specific
  downloadLink?: string;
  
  // Image specific
  imageCount?: number;
  
  createdAt: string;
  updatedAt: string;
  approvalNotes?: string;
  approvedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
}

interface ResourceStats {
  totalResources: number;
  pendingResources: number;
  approvedResources: number;
  rejectedResources: number;
  videoResources: number;
  documentResources: number;
  imageResources: number;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalResources: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface FilterOptions {
  categories: string[];
  tags: string[];
  authors: { _id: string; firstName: string; lastName: string; email: string }[];
}

const ApproveResourcesPage = () => {
  const { theme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    tags: [],
    authors: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalResources: 0,
    hasNext: false,
    hasPrev: false
  });

  const [filters, setFilters] = useState({
    search: '',
    type: '',
    category: '',
    author: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openApproveDialog, setOpenApproveDialog] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');

  const themeStyles = {
    background: theme === 'dark' 
      ? 'linear-gradient(135deg, #0a192f, #112240)' 
      : 'linear-gradient(135deg, #f0f0f0, #ffffff)',
    textColor: theme === 'dark' ? '#ccd6f6' : '#333333',
    primaryColor: theme === 'dark' ? '#00ffff' : '#007bff',
    borderColor: theme === 'dark' ? '#00ffff' : '#007bff',
    surface: theme === 'dark' ? '#1e293b' : '#ffffff',
    cardBg: theme === 'dark' ? '#0f172a80' : '#ffffff',
    cardBorder: theme === 'dark' ? '#334155' : '#e5e7eb',
    headerBg: theme === 'dark' 
      ? 'linear-gradient(135deg, #00ffff, #00b3b3)' 
      : 'linear-gradient(135deg, #007bff, #0056b3)',
    hoverBg: theme === 'dark' ? '#1e293b' : '#f8fafc',
    disabledBg: theme === 'dark' ? '#334155' : '#e5e7eb',
    disabledText: theme === 'dark' ? '#94a3b8' : '#94a3b8'
  };

  const textFieldStyle = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
      color: theme === 'dark' ? '#ccd6f6' : '#333333',
      '& fieldset': {
        borderColor: theme === 'dark' ? '#334155' : '#e5e7eb',
      },
      '&:hover fieldset': {
        borderColor: theme === 'dark' ? '#00ffff' : '#007bff',
      },
      '&.Mui-focused fieldset': {
        borderColor: theme === 'dark' ? '#00ffff' : '#007bff',
      },
    },
    '& .MuiInputLabel-root': {
      color: theme === 'dark' ? '#a8b2d1' : '#666666',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: theme === 'dark' ? '#00ffff' : '#007bff',
    }
  };

  const selectStyle = {
    borderRadius: 1,
    backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
    color: theme === 'dark' ? '#ccd6f6' : '#333333',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: theme === 'dark' ? '#334155' : '#e5e7eb',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme === 'dark' ? '#00ffff' : '#007bff',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme === 'dark' ? '#00ffff' : '#007bff',
    }
  };

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Always filter by pending status for approval queue
      params.append('status', 'pending');
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '' && key !== 'status') {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/resources/approval-queue?${params}`);
      setResources(response.data.data.resources || []);
      setPagination(response.data.data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalResources: 0,
        hasNext: false,
        hasPrev: false
      });
      setError('');
    } catch (error: any) {
      console.error('Error fetching resources:', error);
      setError(error.response?.data?.message || 'Failed to fetch resources');
      setResources([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalResources: 0,
        hasNext: false,
        hasPrev: false
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/resources/stats');
      setStats(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await api.get('/resources/filter-options');
      setFilterOptions(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch filter options:', error);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    fetchStats();
    fetchFilterOptions();
  }, [fetchStats, fetchFilterOptions]);

  const handleOpenViewDialog = (resource: Resource) => {
    setSelectedResource(resource);
    setOpenViewDialog(true);
  };

  const handleOpenApproveDialog = (resource: Resource, action: 'approve' | 'reject') => {
    setSelectedResource(resource);
    setApprovalAction(action);
    setApprovalNotes('');
    setOpenApproveDialog(true);
  };

  const handleApproveResource = async () => {
    if (!selectedResource) return;

    try {
      await api.patch(`/resources/${selectedResource._id}/approve`, {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        approvalNotes: approvalNotes.trim() || undefined
      });
      
      const successMessage = `Resource ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully`;
      setSuccess(successMessage);
      setOpenApproveDialog(false);
      setSelectedResource(null);
      setApprovalNotes('');
      
      fetchResources();
      fetchStats();
    } catch (error: any) {
      setError(error.response?.data?.message || `Failed to ${approvalAction} resource`);
    }
  };

  const handleFilterChange = (field: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      ...(field !== 'page' && { page: 1 })
    }));
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    handleFilterChange('page', value);
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      type: '',
      category: '',
      author: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: 1,
      limit: 10
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle fontSize="small" />;
      case 'pending': return <HourglassEmpty fontSize="small" />;
      case 'rejected': return <Cancel fontSize="small" />;
      default: return <HourglassEmpty fontSize="small" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending': return 'Pending Review';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <YouTube />;
      case 'document': return <PictureAsPdf />;
      case 'image': return <InsertPhoto />;
      default: return <PictureAsPdf />;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'video': return '#ff0000';
      case 'document': return '#1976d2';
      case 'image': return '#2e7d32';
      default: return '#666666';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'video': return 'Video';
      case 'document': return 'Document';
      case 'image': return 'Image Gallery';
      default: return type;
    }
  };

  const getAuthorAvatarColor = (authorId: string): string => {
    if (!authorId || authorId === 'default') {
      return theme === 'dark' ? '#00ffff' : '#007bff';
    }
    
    const colors = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#7b1fa2', '#00796b', '#388e3c', '#f57c00', '#0288d1', '#c2185b'];
    const index = authorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const statCards = [
    {
      title: 'Pending Approval',
      value: stats?.pendingResources || 0,
      icon: <HourglassEmpty sx={{ fontSize: 28 }} />,
      color: theme === 'dark' ? '#ff9900' : '#ff9900',
      description: 'Awaiting review'
    },
    {
      title: 'Approved',
      value: stats?.approvedResources || 0,
      icon: <CheckCircle sx={{ fontSize: 28 }} />,
      color: theme === 'dark' ? '#00ff00' : '#28a745',
      description: 'Approved resources'
    },
    {
      title: 'Total Resources',
      value: stats?.totalResources || 0,
      icon: <VideoLibrary sx={{ fontSize: 28 }} />,
      color: theme === 'dark' ? '#00ffff' : '#007bff',
      description: 'All resources'
    },
    {
      title: 'Rejected',
      value: stats?.rejectedResources || 0,
      icon: <Cancel sx={{ fontSize: 28 }} />,
      color: theme === 'dark' ? '#ff0000' : '#dc3545',
      description: 'Not approved'
    }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-[#0a192f] to-[#112240] text-white' 
        : 'bg-gradient-to-br from-[#f0f0f0] to-[#ffffff] text-[#333333]'
    }`}>
      <Box sx={{ 
        py: 3,
        px: { xs: 2, sm: 3, md: 4 }
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography variant={isMobile ? "h5" : "h4"} sx={{ 
              fontWeight: 'bold', 
              color: theme === 'dark' ? '#ccd6f6' : '#333333',
              mb: 1 
            }}>
              Resource Approval Dashboard
            </Typography>
            <Typography variant={isMobile ? "body2" : "body1"} color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
              Review and approve pending resources
            </Typography>
          </Box>
        </motion.div>

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(4, 1fr)'
            },
            gap: 2,
            mb: 4
          }}>
            {statCards.map((stat, index) => (
              <Card 
                key={index}
                sx={{ 
                  borderRadius: 2,
                  boxShadow: theme === 'dark' 
                    ? '0 2px 8px rgba(0,0,0,0.3)' 
                    : '0 2px 8px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${stat.color}`,
                  backgroundColor: theme === 'dark' ? '#0f172a80' : 'white',
                  height: '100%',
                  backdropFilter: theme === 'dark' ? 'blur(10px)' : 'none'
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: theme === 'dark' ? `${stat.color}20` : `${stat.color}10`,
                      mr: 2
                    }}>
                      <Box sx={{ color: stat.color }}>
                        {stat.icon}
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="h4" sx={{ 
                        fontWeight: 'bold', 
                        color: theme === 'dark' ? '#ccd6f6' : '#333333',
                        fontSize: { xs: '1.5rem', md: '1.75rem' },
                        mb: 0.5
                      }}>
                        {stat.value.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color={theme === 'dark' ? '#a8b2d1' : '#666666'} sx={{ fontWeight: 500 }}>
                        {stat.title}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color={theme === 'dark' ? '#94a3b8' : '#999999'}>
                    {stat.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </motion.div>

        {/* Filter and Action Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card sx={{ 
            mb: 4, 
            borderRadius: 2, 
            boxShadow: theme === 'dark' 
              ? '0 4px 12px rgba(0,0,0,0.3)' 
              : '0 4px 12px rgba(0,0,0,0.08)',
            backgroundColor: theme === 'dark' ? '#0f172a80' : 'white',
            backdropFilter: theme === 'dark' ? 'blur(10px)' : 'none'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', md: 'center' },
                gap: 3,
                mb: 3
              }}>
                <Typography variant="h6" sx={{ 
                  fontWeight: 'bold',
                  color: theme === 'dark' ? '#ccd6f6' : '#333333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Gavel /> Approval Queue
                </Typography>
                
                <Box sx={{ 
                  display: 'flex', 
                  gap: 2,
                  flexDirection: { xs: 'column', sm: 'row' }
                }}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={resetFilters}
                    sx={{ 
                      borderRadius: 1,
                      borderColor: theme === 'dark' ? '#00ffff' : '#007bff',
                      color: theme === 'dark' ? '#00ffff' : '#007bff',
                      '&:hover': {
                        borderColor: theme === 'dark' ? '#00b3b3' : '#0056b3',
                        backgroundColor: theme === 'dark' ? '#00ffff20' : '#007bff10'
                      }
                    }}
                  >
                    Reset Filters
                  </Button>
                </Box>
              </Box>
              
              {/* Filter Controls */}
              <Box sx={{ 
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(4, 1fr)'
                },
                gap: 2
              }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Resources"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Title, description, or tags..."
                  InputProps={{
                    startAdornment: (
                      <Search sx={{ 
                        color: theme === 'dark' ? '#a8b2d1' : '#666666',
                        mr: 1 
                      }} />
                    ),
                  }}
                  sx={textFieldStyle}
                />
                
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: theme === 'dark' ? '#a8b2d1' : '#666666' }}>Type</InputLabel>
                  <Select
                    value={filters.type}
                    label="Type"
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    sx={selectStyle}
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="video">Video</MenuItem>
                    <MenuItem value="document">Document</MenuItem>
                    <MenuItem value="image">Image</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: theme === 'dark' ? '#a8b2d1' : '#666666' }}>Category</InputLabel>
                  <Select
                    value={filters.category}
                    label="Category"
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    sx={selectStyle}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {filterOptions.categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        <Typography variant="body2" color={theme === 'dark' ? '#ccd6f6' : '#333333'}>
                          {category}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: theme === 'dark' ? '#a8b2d1' : '#666666' }}>Author</InputLabel>
                  <Select
                    value={filters.author}
                    label="Author"
                    onChange={(e) => handleFilterChange('author', e.target.value)}
                    sx={selectStyle}
                  >
                    <MenuItem value="">All Authors</MenuItem>
                    {filterOptions.authors.map((author) => (
                      <MenuItem key={author._id} value={author._id}>
                        <Typography variant="body2" color={theme === 'dark' ? '#ccd6f6' : '#333333'}>
                          {author.firstName} {author.lastName}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>
        </motion.div>

        {/* Resources List */}
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '400px' 
          }}>
            <CircularProgress size={60} sx={{ color: theme === 'dark' ? '#00ffff' : '#007bff' }} />
          </Box>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card sx={{ 
              borderRadius: 2,
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0,0,0,0.3)' 
                : '0 4px 12px rgba(0,0,0,0.08)',
              border: theme === 'dark' 
                ? '1px solid #334155' 
                : '1px solid #e5e7eb',
              backgroundColor: theme === 'dark' ? '#0f172a80' : 'white',
              backdropFilter: theme === 'dark' ? 'blur(10px)' : 'none'
            }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ 
                      background: theme === 'dark'
                        ? 'linear-gradient(135deg, #00ffff, #00b3b3)'
                        : 'linear-gradient(135deg, #007bff, #0056b3)'
                    }}>
                      <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                        py: 2,
                        width: '30%'
                      }}>
                        Resource
                      </TableCell>
                      <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                        py: 2
                      }}>
                        Type/Category
                      </TableCell>
                      <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                        py: 2
                      }}>
                        Author
                      </TableCell>
                      <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                        py: 2
                      }}>
                        Created
                      </TableCell>
                      <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                        py: 2
                      }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resources.map((resource) => (
                      <TableRow 
                        key={resource._id} 
                        hover
                        sx={{ 
                          '&:hover': {
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc'
                          }
                        }}
                      >
                        <TableCell sx={{ py: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            <Box sx={{ 
                              width: 60, 
                              height: 40,
                              borderRadius: 1,
                              overflow: 'hidden',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: theme === 'dark' ? '#334155' : '#e5e7eb'
                            }}>
                              <Box sx={{ color: getTypeColor(resource.type) }}>
                                {getTypeIcon(resource.type)}
                              </Box>
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ 
                                fontWeight: 500,
                                color: theme === 'dark' ? '#ccd6f6' : '#333333',
                                mb: 0.5,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {resource.title}
                              </Typography>
                              <Typography variant="caption" color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
                                {resource.description.substring(0, 60)}...
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 2.5 }}>
                          <Stack spacing={0.5}>
                            <Chip
                              label={getTypeText(resource.type)}
                              size="small"
                              icon={getTypeIcon(resource.type)}
                              sx={{ 
                                height: 22,
                                fontSize: '0.7rem',
                                backgroundColor: theme === 'dark' ? '#334155' : '#e5e7eb',
                                color: getTypeColor(resource.type)
                              }}
                            />
                            <Chip
                              label={resource.category}
                              size="small"
                              sx={{ 
                                height: 22,
                                fontSize: '0.7rem',
                                backgroundColor: theme === 'dark' ? '#334155' : '#e5e7eb'
                              }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ 
                              width: 32, 
                              height: 32,
                              fontSize: '0.875rem',
                              bgcolor: getAuthorAvatarColor(resource.createdBy?._id || 'default')
                            }}>
                              {resource.createdBy?.firstName?.charAt(0) || 'U'}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ 
                                fontWeight: 'medium', 
                                color: theme === 'dark' ? '#ccd6f6' : '#333333' 
                              }}>
                                {resource.createdBy?.firstName || 'Unknown'} {resource.createdBy?.lastName || ''}
                              </Typography>
                              <Typography variant="caption" color={theme === 'dark' ? '#94a3b8' : '#999999'}>
                                {resource.createdBy?.email || ''}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 2.5 }}>
                          <Typography variant="body2" color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
                            {formatDate(resource.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2.5 }}>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Tooltip title="Review">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenViewDialog(resource)}
                                sx={{ 
                                  color: theme === 'dark' ? '#00ffff' : '#007bff',
                                  '&:hover': {
                                    backgroundColor: theme === 'dark' ? '#00ffff20' : '#007bff10'
                                  }
                                }}
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            
                            <Tooltip title="Approve">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenApproveDialog(resource, 'approve')}
                                sx={{ 
                                  color: theme === 'dark' ? '#00ff00' : '#28a745',
                                  '&:hover': {
                                    backgroundColor: theme === 'dark' ? '#00ff0020' : '#28a74510'
                                  }
                                }}
                              >
                                <ThumbUp fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            
                            <Tooltip title="Reject">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenApproveDialog(resource, 'reject')}
                                sx={{ 
                                  color: theme === 'dark' ? '#ff0000' : '#dc3545',
                                  '&:hover': {
                                    backgroundColor: theme === 'dark' ? '#ff000020' : '#dc354510'
                                  }
                                }}
                              >
                                <ThumbDown fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {resources.length === 0 && !loading && (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 8,
                  px: 2
                }}>
                  <CheckCircle sx={{ 
                    fontSize: 64, 
                    color: theme === 'dark' ? '#334155' : '#cbd5e1',
                    mb: 2
                  }} />
                  <Typography variant="h6" color={theme === 'dark' ? '#a8b2d1' : '#666666'} sx={{ mb: 1 }}>
                    No pending resources
                  </Typography>
                  <Typography variant="body2" color={theme === 'dark' ? '#94a3b8' : '#999999'}>
                    All resources have been reviewed
                  </Typography>
                </Box>
              )}
            </Card>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                mt: 4,
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2
              }}>
                <Pagination
                  count={pagination.totalPages}
                  page={filters.page}
                  onChange={handlePageChange}
                  color="primary"
                  size={isMobile ? "small" : "medium"}
                  showFirstButton
                  showLastButton
                  sx={{
                    '& .MuiPaginationItem-root': {
                      borderRadius: 1,
                      color: theme === 'dark' ? '#ccd6f6' : '#333333',
                      '&.Mui-selected': {
                        backgroundColor: theme === 'dark' ? '#00ffff' : '#007bff',
                        color: theme === 'dark' ? '#0a192f' : 'white',
                      },
                      '&:hover': {
                        backgroundColor: theme === 'dark' ? '#00ffff20' : '#007bff10'
                      }
                    }
                  }}
                />
                
                <Typography variant="body2" color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
                  Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, pagination.totalResources)} of {pagination.totalResources} resources
                </Typography>
              </Box>
            )}
          </motion.div>
        )}

        {/* View Resource Dialog */}
        <Dialog 
          open={openViewDialog} 
          onClose={() => setOpenViewDialog(false)} 
          maxWidth="lg" 
          fullWidth
          fullScreen={isMobile}
          PaperProps={{
            sx: { 
              borderRadius: 2,
              backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
              color: theme === 'dark' ? '#ccd6f6' : '#333333'
            }
          }}
        >
          {selectedResource && (
            <>
              <DialogTitle sx={{ 
                backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                borderBottom: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb',
                py: 3
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme === 'dark' ? '#ccd6f6' : '#333333' }}>
                    Resource Review
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={getTypeText(selectedResource.type)}
                      color="primary"
                      size="small"
                      icon={getTypeIcon(selectedResource.type)}
                    />
                    <Chip
                      label={getStatusText(selectedResource.status)}
                      color={getStatusColor(selectedResource.status)}
                      size="small"
                      icon={getStatusIcon(selectedResource.status)}
                    />
                  </Box>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ p: 3 }}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Resource Preview based on type */}
                  {selectedResource.type === 'video' && selectedResource.videoId && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ 
                        width: '100%',
                        height: { xs: 200, md: 400 },
                        borderRadius: 2,
                        overflow: 'hidden',
                        backgroundColor: theme === 'dark' ? '#000' : '#f0f0f0'
                      }}>
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${selectedResource.videoId}`}
                          title={selectedResource.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ border: 'none' }}
                        />
                      </Box>
                      {selectedResource.youtubeUrl && (
                        <Typography variant="caption" color={theme === 'dark' ? '#a8b2d1' : '#666666'} sx={{ mt: 1, display: 'block' }}>
                          YouTube URL: <a href={selectedResource.youtubeUrl} target="_blank" rel="noopener noreferrer" 
                            style={{ color: theme === 'dark' ? '#00ffff' : '#007bff' }}>
                            {selectedResource.youtubeUrl}
                          </a>
                        </Typography>
                      )}
                    </Box>
                  )}

                  {selectedResource.type === 'document' && (
                    <Card sx={{ mb: 3 }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <PictureAsPdf sx={{ fontSize: 48, color: '#f44336' }} />
                          <Box>
                            <Typography variant="h6" color={theme === 'dark' ? '#ccd6f6' : '#333333'}>
                              Document File
                            </Typography>
                            <Typography variant="body2" color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
                              Ready for download after approval
                            </Typography>
                          </Box>
                        </Box>
                        <Button
                          variant="outlined"
                          startIcon={<PictureAsPdf />}
                          href={`/api/resources/${selectedResource._id}/document`}
                          target="_blank"
                          sx={{
                            borderColor: theme === 'dark' ? '#00ffff' : '#007bff',
                            color: theme === 'dark' ? '#00ffff' : '#007bff',
                            '&:hover': {
                              backgroundColor: theme === 'dark' ? '#00ffff20' : '#007bff10'
                            }
                          }}
                        >
                          Preview Document
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Resource Details */}
                  <Typography variant="h5" sx={{ 
                    fontWeight: 'bold',
                    color: theme === 'dark' ? '#ccd6f6' : '#333333',
                    mb: 2
                  }}>
                    {selectedResource.title}
                  </Typography>
                  
                  <Typography variant="body1" sx={{ 
                    color: theme === 'dark' ? '#a8b2d1' : '#666666',
                    mb: 3,
                    lineHeight: 1.6
                  }}>
                    {selectedResource.description}
                  </Typography>
                  
                  {/* Tags and Category */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                    <Chip
                      label={selectedResource.category}
                      sx={{ 
                        backgroundColor: theme === 'dark' ? '#334155' : '#e5e7eb'
                      }}
                    />
                    {selectedResource.tags.map((tag, index) => (
                      <Chip
                        key={index}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ 
                          borderColor: theme === 'dark' ? '#334155' : '#e5e7eb',
                          color: theme === 'dark' ? '#a8b2d1' : '#666666'
                        }}
                      />
                    ))}
                  </Box>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  {/* Author and Dates */}
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
                    {/* Author Card */}
                    <Card sx={{ 
                      flex: 1,
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#f8f9fa',
                      border: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb'
                    }}>
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ 
                          mb: 2,
                          color: theme === 'dark' ? '#ccd6f6' : '#333333'
                        }}>
                          Submitted By
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ 
                            width: 40, 
                            height: 40,
                            fontSize: '1rem',
                            bgcolor: getAuthorAvatarColor(selectedResource.createdBy?._id || 'default')
                          }}>
                            {selectedResource.createdBy?.firstName?.charAt(0) || 'U'}
                          </Avatar>
                          <Box>
                            <Typography variant="body1" sx={{ 
                              fontWeight: 'medium',
                              color: theme === 'dark' ? '#ccd6f6' : '#333333'
                            }}>
                              {selectedResource.createdBy?.firstName || 'Unknown'} {selectedResource.createdBy?.lastName || ''}
                            </Typography>
                            <Typography variant="caption" color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
                              {selectedResource.createdBy?.email || 'No email provided'}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                    
                    {/* Dates Card */}
                    <Card sx={{ 
                      flex: 1,
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#f8f9fa',
                      border: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb'
                    }}>
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ 
                          mb: 2,
                          color: theme === 'dark' ? '#ccd6f6' : '#333333'
                        }}>
                          Submission Date
                        </Typography>
                        <Typography variant="h6" sx={{ color: theme === 'dark' ? '#ccd6f6' : '#333333' }}>
                          {formatDate(selectedResource.createdAt)}
                        </Typography>
                        <Typography variant="caption" color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
                          Waiting for review since {format(parseISO(selectedResource.createdAt), 'MMM dd, yyyy')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                </motion.div>
              </DialogContent>
              <DialogActions sx={{ 
                p: 3,
                borderTop: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb',
                backgroundColor: theme === 'dark' ? '#0f172a' : 'white'
              }}>
                <Button 
                  onClick={() => setOpenViewDialog(false)}
                  sx={{
                    color: theme === 'dark' ? '#00ffff' : '#007bff',
                    '&:hover': {
                      backgroundColor: theme === 'dark' ? '#00ffff20' : '#007bff10'
                    }
                  }}
                >
                  Close
                </Button>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    onClick={() => handleOpenApproveDialog(selectedResource, 'reject')}
                    variant="outlined"
                    color="error"
                    startIcon={<ThumbDown />}
                    sx={{
                      borderColor: theme === 'dark' ? '#ff0000' : '#dc3545',
                      color: theme === 'dark' ? '#ff0000' : '#dc3545',
                      '&:hover': {
                        backgroundColor: theme === 'dark' ? '#ff000020' : '#dc354510'
                      }
                    }}
                  >
                    Reject
                  </Button>
                  <Button 
                    onClick={() => handleOpenApproveDialog(selectedResource, 'approve')}
                    variant="contained"
                    color="success"
                    startIcon={<ThumbUp />}
                    sx={{
                      backgroundColor: theme === 'dark' ? '#00ff00' : '#28a745',
                      color: theme === 'dark' ? '#0a192f' : 'white',
                      '&:hover': {
                        backgroundColor: theme === 'dark' ? '#00b300' : '#218838'
                      }
                    }}
                  >
                    Approve
                  </Button>
                </Box>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Approve/Reject Dialog */}
        <Dialog 
          open={openApproveDialog} 
          onClose={() => setOpenApproveDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { 
              borderRadius: 2,
              backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
              color: theme === 'dark' ? '#ccd6f6' : '#333333'
            }
          }}
        >
          <DialogTitle sx={{ 
            backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
            borderBottom: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb',
            py: 3
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme === 'dark' ? '#ccd6f6' : '#333333' }}>
              {approvalAction === 'approve' ? 'Approve Resource' : 'Reject Resource'}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            {selectedResource && (
              <Box>
                <Typography variant="body1" sx={{ mb: 2, color: theme === 'dark' ? '#a8b2d1' : '#666666' }}>
                  You are about to <strong style={{color: approvalAction === 'approve' ? '#28a745' : '#dc3545'}}>
                    {approvalAction === 'approve' ? 'approve' : 'reject'}
                  </strong> the following resource:
                </Typography>
                
                <Card sx={{ 
                  mb: 3,
                  backgroundColor: theme === 'dark' ? '#1e293b' : '#f8f9fa',
                  border: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb'
                }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ 
                      fontWeight: 'bold',
                      color: theme === 'dark' ? '#ccd6f6' : '#333333',
                      mb: 1
                    }}>
                      {selectedResource.title}
                    </Typography>
                    <Typography variant="body2" color={theme === 'dark' ? '#a8b2d1' : '#666666'}>
                      {selectedResource.description.substring(0, 100)}...
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Chip
                        label={getTypeText(selectedResource.type)}
                        size="small"
                        sx={{ 
                          fontSize: '0.7rem',
                          backgroundColor: theme === 'dark' ? '#334155' : '#e5e7eb'
                        }}
                      />
                      <Chip
                        label={selectedResource.category}
                        size="small"
                        sx={{ 
                          fontSize: '0.7rem',
                          backgroundColor: theme === 'dark' ? '#334155' : '#e5e7eb'
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
                
                <Typography variant="subtitle2" sx={{ 
                  mb: 1,
                  color: theme === 'dark' ? '#a8b2d1' : '#666666'
                }}>
                  {approvalAction === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason (Required)'}
                </Typography>
                <TextField
                  multiline
                  rows={3}
                  fullWidth
                  placeholder={approvalAction === 'approve' 
                    ? 'Add any notes about this approval...' 
                    : 'Explain why this resource is being rejected...'}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  sx={textFieldStyle}
                />
                {approvalAction === 'reject' && !approvalNotes.trim() && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    Please provide a reason for rejection
                  </Typography>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ 
            p: 3,
            borderTop: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb',
            backgroundColor: theme === 'dark' ? '#0f172a' : 'white'
          }}>
            <Button 
              onClick={() => {
                setOpenApproveDialog(false);
                setApprovalNotes('');
              }}
              sx={{
                color: theme === 'dark' ? '#00ffff' : '#007bff',
                '&:hover': {
                  backgroundColor: theme === 'dark' ? '#00ffff20' : '#007bff10'
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApproveResource}
              variant="contained"
              disabled={approvalAction === 'reject' && !approvalNotes.trim()}
              color={approvalAction === 'approve' ? 'success' : 'error'}
              sx={{
                borderRadius: 1,
                backgroundColor: approvalAction === 'approve' 
                  ? (theme === 'dark' ? '#00ff00' : '#28a745')
                  : (theme === 'dark' ? '#ff0000' : '#dc3545'),
                color: theme === 'dark' ? '#0a192f' : 'white',
                '&:hover': {
                  backgroundColor: approvalAction === 'approve' 
                    ? (theme === 'dark' ? '#00b300' : '#218838')
                    : (theme === 'dark' ? '#cc0000' : '#c82333')
                },
                '&.Mui-disabled': {
                  backgroundColor: theme === 'dark' ? '#334155' : '#e5e7eb',
                  color: theme === 'dark' ? '#94a3b8' : '#94a3b8'
                }
              }}
            >
              {approvalAction === 'approve' ? 'Approve Resource' : 'Reject Resource'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Notifications */}
        <Snackbar 
          open={!!error} 
          autoHideDuration={6000} 
          onClose={() => setError('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            severity="error" 
            onClose={() => setError('')}
            sx={{ 
              borderRadius: 1,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
              color: theme === 'dark' ? '#ff0000' : '#dc3545'
            }}
          >
            {error}
          </Alert>
        </Snackbar>
        
        <Snackbar 
          open={!!success} 
          autoHideDuration={6000} 
          onClose={() => setSuccess('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            severity="success" 
            onClose={() => setSuccess('')}
            sx={{ 
              borderRadius: 1,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
              color: theme === 'dark' ? '#00ff00' : '#28a745'
            }}
          >
            {success}
          </Alert>
        </Snackbar>
      </Box> 
    </div>
  );
};

export default ApproveResourcesPage;