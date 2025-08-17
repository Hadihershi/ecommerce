const express = require('express');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { upload, handleMulterError, deleteFiles } = require('../middleware/upload');
const { 
  validateProduct, 
  validateProductUpdate, 
  validatePagination, 
  validateProductSearch,
  validateMongoId 
} = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/products
// @desc    Get all products with filtering, searching, and pagination
// @access  Public
router.get('/', validatePagination, validateProductSearch, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      minPrice,
      maxPrice,
      rating,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      brand,
      tags,
      status = 'active',
      featured
    } = req.query;

    // Build filter object
    const filter = { status };

    // Category filter
    if (category) {
      const categoryObj = await Category.findById(category);
      if (categoryObj) {
        // Get all descendant categories
        const descendants = await categoryObj.getDescendants();
        const categoryIds = [category, ...descendants.map(d => d._id)];
        filter.category = { $in: categoryIds };
      }
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Rating filter
    if (rating) {
      filter['rating.average'] = { $gte: parseInt(rating) };
    }

    // Brand filter
    if (brand) {
      filter.brand = new RegExp(brand, 'i');
    }

    // Tags filter
    if (tags) {
      const tagsArray = tags.split(',').map(tag => tag.trim().toLowerCase());
      filter.tags = { $in: tagsArray };
    }

    // Featured filter
    if (featured === 'true') {
      filter.isFeatured = true;
    }

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    const sortOptions = {};
    if (search && !sortBy) {
      sortOptions.score = { $meta: 'textScore' };
    } else {
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
        case 'popularity':
          sortOptions['rating.count'] = order;
          break;
        default:
          sortOptions.createdAt = order;
      }
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select(search && !sortBy ? { score: { $meta: 'textScore' } } : {});

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / parseInt(limit));

    res.json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProducts,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      filters: {
        category,
        search,
        minPrice,
        maxPrice,
        rating,
        brand,
        tags,
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      message: 'Error fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      status: 'active',
      isFeatured: true
    })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ products });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      message: 'Error fetching featured products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/products/search-suggestions
// @desc    Get search suggestions
// @access  Public
router.get('/search-suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await Product.find({
      status: 'active',
      $or: [
        { name: new RegExp(q, 'i') },
        { brand: new RegExp(q, 'i') },
        { tags: new RegExp(q, 'i') }
      ]
    })
      .select('name brand')
      .limit(10);

    const formattedSuggestions = suggestions.map(product => ({
      name: product.name,
      brand: product.brand
    }));

    res.json({ suggestions: formattedSuggestions });
  } catch (error) {
    console.error('Get search suggestions error:', error);
    res.status(500).json({
      message: 'Error fetching search suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
router.get('/:id', validateMongoId, optionalAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug path')
      .populate('reviews.user', 'firstName lastName avatar');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product is active or user is admin
    if (product.status !== 'active' && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      message: 'Error fetching product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/products/:id/related
// @desc    Get related products
// @access  Public
router.get('/:id/related', validateMongoId, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { limit = 4 } = req.query;

    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      status: 'active'
    })
      .populate('category', 'name slug')
      .sort({ 'rating.average': -1 })
      .limit(parseInt(limit));

    res.json({ products: relatedProducts });
  } catch (error) {
    console.error('Get related products error:', error);
    res.status(500).json({
      message: 'Error fetching related products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/products
// @desc    Create a new product
// @access  Private (Admin only)
router.post('/', 
  authenticate, 
  requireAdmin, 
  upload.array('productImages', 10),
  handleMulterError,
  validateProduct,
  async (req, res) => {
    try {
      const productData = { ...req.body };

      // Handle uploaded images
      if (req.files && req.files.length > 0) {
        productData.images = req.files.map((file, index) => ({
          url: file.path.replace(/\\/g, '/'),
          alt: `${productData.name} image ${index + 1}`,
          isPrimary: index === 0
        }));
      }

      // Parse JSON fields if they're strings
      if (typeof productData.specifications === 'string') {
        productData.specifications = JSON.parse(productData.specifications);
      }
      if (typeof productData.variants === 'string') {
        productData.variants = JSON.parse(productData.variants);
      }
      if (typeof productData.inventory === 'string') {
        productData.inventory = JSON.parse(productData.inventory);
      }
      if (typeof productData.tags === 'string') {
        productData.tags = JSON.parse(productData.tags);
      }

      const product = new Product(productData);
      await product.save();

      const populatedProduct = await Product.findById(product._id)
        .populate('category', 'name slug');

      res.status(201).json({
        message: 'Product created successfully',
        product: populatedProduct
      });
    } catch (error) {
      console.error('Create product error:', error);
      
      // Delete uploaded files if product creation failed
      if (req.files) {
        const filePaths = req.files.map(file => file.path);
        deleteFiles(filePaths);
      }

      if (error.code === 11000) {
        res.status(400).json({
          message: 'Product with this SKU already exists'
        });
      } else {
        res.status(500).json({
          message: 'Error creating product',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
    }
  }
);

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private (Admin only)
router.put('/:id', 
  authenticate, 
  requireAdmin, 
  validateMongoId,
  upload.array('productImages', 10),
  handleMulterError,
  validateProductUpdate,
  async (req, res) => {
    try {
      const productData = { ...req.body };

      // Handle uploaded images
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map((file, index) => ({
          url: file.path.replace(/\\/g, '/'),
          alt: `${productData.name || 'Product'} image ${index + 1}`,
          isPrimary: index === 0
        }));

        // If replacing all images
        if (productData.replaceImages === 'true') {
          productData.images = newImages;
        } else {
          // Append to existing images
          const existingProduct = await Product.findById(req.params.id);
          productData.images = [...(existingProduct.images || []), ...newImages];
        }
      }

      // Parse JSON fields if they're strings
      ['specifications', 'variants', 'inventory', 'tags'].forEach(field => {
        if (typeof productData[field] === 'string') {
          try {
            productData[field] = JSON.parse(productData[field]);
          } catch (e) {
            // If parsing fails, leave as string
          }
        }
      });

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: productData },
        { new: true, runValidators: true }
      ).populate('category', 'name slug');

      if (!product) {
        // Delete uploaded files if product not found
        if (req.files) {
          const filePaths = req.files.map(file => file.path);
          deleteFiles(filePaths);
        }
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json({
        message: 'Product updated successfully',
        product
      });
    } catch (error) {
      console.error('Update product error:', error);

      // Delete uploaded files if update failed
      if (req.files) {
        const filePaths = req.files.map(file => file.path);
        deleteFiles(filePaths);
      }

      res.status(500).json({
        message: 'Error updating product',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Private (Admin only)
router.delete('/:id', authenticate, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete associated images
    if (product.images && product.images.length > 0) {
      const imagePaths = product.images.map(image => image.url);
      deleteFiles(imagePaths);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      message: 'Error deleting product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/products/:id/reviews
// @desc    Add a product review
// @access  Private
router.post('/:id/reviews', authenticate, validateMongoId, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        message: 'Rating and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: 'Rating must be between 1 and 5'
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return res.status(400).json({
        message: 'You have already reviewed this product'
      });
    }

    // Add review
    product.reviews.push({
      user: req.user.id,
      rating: parseInt(rating),
      comment
    });

    await product.save();

    // Populate the new review
    await product.populate('reviews.user', 'firstName lastName avatar');

    const newReview = product.reviews[product.reviews.length - 1];

    res.status(201).json({
      message: 'Review added successfully',
      review: newReview
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      message: 'Error adding review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

