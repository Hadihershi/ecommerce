const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload, handleMulterError, deleteFile } = require('../middleware/upload');
const { validateCategory, validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/categories
// @desc    Get all categories (tree structure)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { flat, includeInactive } = req.query;

    if (flat === 'true') {
      // Return flat list of categories
      const filter = includeInactive === 'true' ? {} : { isActive: true };
      const categories = await Category.find(filter)
        .populate('parent', 'name slug')
        .sort({ sortOrder: 1, name: 1 });

      res.json({ categories });
    } else {
      // Return hierarchical tree structure
      const categoryTree = await Category.getCategoryTree();
      res.json({ categories: categoryTree });
    }
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/categories/:id
// @desc    Get single category by ID
// @access  Public
router.get('/:id', validateMongoId, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name slug')
      .populate({
        path: 'children',
        match: { isActive: true },
        select: 'name slug image sortOrder'
      });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Get full path
    const fullPath = await Category.getFullPath(req.params.id);

    // Get products count
    const productsCount = await Product.countDocuments({
      category: req.params.id,
      status: 'active'
    });

    res.json({
      category: {
        ...category.toObject(),
        fullPath,
        productsCount
      }
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      message: 'Error fetching category',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/categories/:id/products
// @desc    Get products in a category (including subcategories)
// @access  Public
router.get('/:id/products', validateMongoId, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeSubcategories = 'true'
    } = req.query;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    let categoryIds = [req.params.id];

    // Include products from subcategories if requested
    if (includeSubcategories === 'true') {
      const descendants = await category.getDescendants();
      categoryIds = [req.params.id, ...descendants.map(d => d._id)];
    }

    // Build sort object
    const sortOptions = {};
    const order = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'price':
        sortOptions.price = order;
        break;
      case 'rating':
        sortOptions['rating.average'] = order;
        break;
      case 'name':
        sortOptions.name = order;
        break;
      default:
        sortOptions.createdAt = order;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await Product.find({
      category: { $in: categoryIds },
      status: 'active'
    })
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const totalProducts = await Product.countDocuments({
      category: { $in: categoryIds },
      status: 'active'
    });

    const totalPages = Math.ceil(totalProducts / parseInt(limit));

    res.json({
      products,
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        image: category.image
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProducts,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get category products error:', error);
    res.status(500).json({
      message: 'Error fetching category products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/categories
// @desc    Create a new category
// @access  Private (Admin only)
router.post('/', 
  authenticate, 
  requireAdmin, 
  upload.single('categoryImage'),
  handleMulterError,
  validateCategory,
  async (req, res) => {
    try {
      const categoryData = { ...req.body };

      // Handle uploaded image
      if (req.file) {
        categoryData.image = {
          url: req.file.path.replace(/\\/g, '/'),
          alt: categoryData.name
        };
      }

      // Parse attributes if it's a string
      if (typeof categoryData.attributes === 'string') {
        categoryData.attributes = JSON.parse(categoryData.attributes);
      }

      const category = new Category(categoryData);
      await category.save();

      const populatedCategory = await Category.findById(category._id)
        .populate('parent', 'name slug');

      res.status(201).json({
        message: 'Category created successfully',
        category: populatedCategory
      });
    } catch (error) {
      console.error('Create category error:', error);

      // Delete uploaded file if category creation failed
      if (req.file) {
        deleteFile(req.file.path);
      }

      if (error.code === 11000) {
        res.status(400).json({
          message: 'Category with this name already exists'
        });
      } else {
        res.status(500).json({
          message: 'Error creating category',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
    }
  }
);

// @route   PUT /api/categories/:id
// @desc    Update a category
// @access  Private (Admin only)
router.put('/:id', 
  authenticate, 
  requireAdmin, 
  validateMongoId,
  upload.single('categoryImage'),
  handleMulterError,
  async (req, res) => {
    try {
      const categoryData = { ...req.body };

      // Handle uploaded image
      if (req.file) {
        // Delete old image if exists
        const existingCategory = await Category.findById(req.params.id);
        if (existingCategory && existingCategory.image.url) {
          deleteFile(existingCategory.image.url);
        }

        categoryData.image = {
          url: req.file.path.replace(/\\/g, '/'),
          alt: categoryData.name || existingCategory.name
        };
      }

      // Parse attributes if it's a string
      if (typeof categoryData.attributes === 'string') {
        try {
          categoryData.attributes = JSON.parse(categoryData.attributes);
        } catch (e) {
          // If parsing fails, remove from update data
          delete categoryData.attributes;
        }
      }

      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { $set: categoryData },
        { new: true, runValidators: true }
      ).populate('parent', 'name slug');

      if (!category) {
        // Delete uploaded file if category not found
        if (req.file) {
          deleteFile(req.file.path);
        }
        return res.status(404).json({ message: 'Category not found' });
      }

      res.json({
        message: 'Category updated successfully',
        category
      });
    } catch (error) {
      console.error('Update category error:', error);

      // Delete uploaded file if update failed
      if (req.file) {
        deleteFile(req.file.path);
      }

      res.status(500).json({
        message: 'Error updating category',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// @route   DELETE /api/categories/:id
// @desc    Delete a category
// @access  Private (Admin only)
router.delete('/:id', authenticate, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has products
    const productsCount = await Product.countDocuments({ category: req.params.id });
    if (productsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category. It has ${productsCount} products assigned to it.`
      });
    }

    // Check if category has children
    const childrenCount = await Category.countDocuments({ parent: req.params.id });
    if (childrenCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category. It has ${childrenCount} subcategories.`
      });
    }

    // Delete category image if exists
    if (category.image.url) {
      deleteFile(category.image.url);
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      message: 'Error deleting category',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/categories/:id/reorder
// @desc    Update category sort order
// @access  Private (Admin only)
router.put('/:id/reorder', authenticate, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const { sortOrder } = req.body;

    if (typeof sortOrder !== 'number') {
      return res.status(400).json({
        message: 'Sort order must be a number'
      });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { sortOrder },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      message: 'Category order updated successfully',
      category
    });
  } catch (error) {
    console.error('Reorder category error:', error);
    res.status(500).json({
      message: 'Error updating category order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/categories/reorder-bulk
// @desc    Update multiple categories' sort order
// @access  Private (Admin only)
router.post('/reorder-bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        message: 'Categories must be an array'
      });
    }

    const updatePromises = categories.map(cat => 
      Category.findByIdAndUpdate(cat.id, { sortOrder: cat.sortOrder })
    );

    await Promise.all(updatePromises);

    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    console.error('Bulk reorder categories error:', error);
    res.status(500).json({
      message: 'Error reordering categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

