const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload, handleMulterError, deleteFile } = require('../middleware/upload');
const { validateUserUpdate, validatePagination, validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin only)
router.get('/', authenticate, requireAdmin, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Build sort
    const sortOptions = {};
    const order = sortOrder === 'asc' ? 1 : -1;
    sortOptions[sortBy] = order;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(filter)
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      message: 'Error fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only or own profile)
// @access  Private
router.get('/:id', authenticate, validateMongoId, async (req, res) => {
  try {
    // Users can only access their own profile unless they're admin
    if (req.user.role !== 'admin' && req.params.id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('wishlist', 'name price images');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      message: 'Error fetching user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (admin only or own profile)
// @access  Private
router.put('/:id', 
  authenticate, 
  validateMongoId, 
  upload.single('userAvatar'),
  handleMulterError,
  validateUserUpdate,
  async (req, res) => {
    try {
      // Users can only update their own profile unless they're admin
      if (req.user.role !== 'admin' && req.params.id !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updates = { ...req.body };

      // Handle uploaded avatar
      if (req.file) {
        // Delete old avatar if exists
        const existingUser = await User.findById(req.params.id);
        if (existingUser && existingUser.avatar) {
          deleteFile(existingUser.avatar);
        }

        updates.avatar = req.file.path.replace(/\\/g, '/');
      }

      // Only admin can update role and isActive
      if (req.user.role !== 'admin') {
        delete updates.role;
        delete updates.isActive;
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      )
        .select('-password')
        .populate('wishlist', 'name price images');

      if (!user) {
        // Delete uploaded file if user not found
        if (req.file) {
          deleteFile(req.file.path);
        }
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'User updated successfully',
        user
      });
    } catch (error) {
      console.error('Update user error:', error);

      // Delete uploaded file if update failed
      if (req.file) {
        deleteFile(req.file.path);
      }

      res.status(500).json({
        message: 'Error updating user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Delete/deactivate user (admin only)
// @access  Private (Admin only)
router.delete('/:id', authenticate, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow admin to delete their own account
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Deactivate instead of deleting
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      message: 'Error deleting user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/users/:id/wishlist/:productId
// @desc    Add product to wishlist
// @access  Private
router.post('/:id/wishlist/:productId', authenticate, async (req, res) => {
  try {
    // Users can only modify their own wishlist
    if (req.params.id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify product exists
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if product is already in wishlist
    if (user.wishlist.includes(req.params.productId)) {
      return res.status(400).json({ message: 'Product already in wishlist' });
    }

    user.wishlist.push(req.params.productId);
    await user.save();

    const updatedUser = await User.findById(req.params.id)
      .select('-password')
      .populate('wishlist', 'name price images');

    res.json({
      message: 'Product added to wishlist',
      wishlist: updatedUser.wishlist
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({
      message: 'Error adding product to wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/users/:id/wishlist/:productId
// @desc    Remove product from wishlist
// @access  Private
router.delete('/:id/wishlist/:productId', authenticate, async (req, res) => {
  try {
    // Users can only modify their own wishlist
    if (req.params.id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove product from wishlist
    user.wishlist.pull(req.params.productId);
    await user.save();

    const updatedUser = await User.findById(req.params.id)
      .select('-password')
      .populate('wishlist', 'name price images');

    res.json({
      message: 'Product removed from wishlist',
      wishlist: updatedUser.wishlist
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({
      message: 'Error removing product from wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/users/:id/wishlist
// @desc    Get user's wishlist
// @access  Private
router.get('/:id/wishlist', authenticate, async (req, res) => {
  try {
    // Users can only access their own wishlist unless they're admin
    if (req.user.role !== 'admin' && req.params.id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id)
      .select('wishlist')
      .populate({
        path: 'wishlist',
        select: 'name price comparePrice images rating status',
        match: { status: 'active' }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ wishlist: user.wishlist });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      message: 'Error fetching wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/users/analytics/summary
// @desc    Get users analytics (admin only)
// @access  Private (Admin only)
router.get('/analytics/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { 
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
      }
    });

    // Get registration trend for last 12 months
    const registrationTrend = await User.aggregate([
      {
        $match: {
          createdAt: { 
            $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) 
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      totalUsers,
      activeUsers,
      adminUsers,
      newUsersThisMonth,
      registrationTrend
    });
  } catch (error) {
    console.error('Get users analytics error:', error);
    res.status(500).json({
      message: 'Error fetching users analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

