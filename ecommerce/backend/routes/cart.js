const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate } = require('../middleware/auth');
const { validateCartItem, validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name price images inventory status'
      });

    if (!cart) {
      cart = new Cart({ user: req.user.id });
      await cart.save();
    }

    // Filter out items with inactive products or insufficient stock
    const validItems = cart.items.filter(item => {
      const product = item.product;
      if (!product || product.status !== 'active') return false;
      
      // Check stock availability
      if (product.inventory.trackQuantity && product.inventory.quantity < item.quantity) {
        return false;
      }
      
      return true;
    });

    // Update cart if items were filtered out
    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    res.json({ cart });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      message: 'Error fetching cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/cart/items
// @desc    Add item to cart
// @access  Private
router.post('/items', authenticate, validateCartItem, async (req, res) => {
  try {
    const { product: productId, quantity, selectedVariants = [] } = req.body;

    // Verify product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.status !== 'active') {
      return res.status(400).json({ message: 'Product is not available' });
    }

    // Check stock availability
    if (product.inventory.trackQuantity && product.inventory.quantity < quantity) {
      return res.status(400).json({
        message: `Only ${product.inventory.quantity} items available in stock`
      });
    }

    // Calculate price with variant modifiers
    let itemPrice = product.price;
    const validatedVariants = [];

    if (selectedVariants && selectedVariants.length > 0) {
      for (const selectedVariant of selectedVariants) {
        const productVariant = product.variants.find(v => v.name === selectedVariant.name);
        if (productVariant) {
          const option = productVariant.options.find(o => o.value === selectedVariant.value);
          if (option) {
            validatedVariants.push({
              name: selectedVariant.name,
              value: selectedVariant.value,
              priceModifier: option.priceModifier || 0
            });
            itemPrice += option.priceModifier || 0;
          }
        }
      }
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = new Cart({ user: req.user.id });
    }

    // Add item to cart
    await cart.addItem(productId, quantity, validatedVariants, itemPrice);

    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status'
    });

    res.json({
      message: 'Item added to cart successfully',
      cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      message: 'Error adding item to cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/cart/items/:itemId
// @desc    Update cart item quantity
// @access  Private
router.put('/items/:itemId', authenticate, async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ 
        message: 'Quantity must be at least 1' 
      });
    }

    if (quantity > 99) {
      return res.status(400).json({ 
        message: 'Quantity cannot exceed 99' 
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    // Check product availability and stock
    const product = await Product.findById(item.product);
    if (!product || product.status !== 'active') {
      return res.status(400).json({ message: 'Product is no longer available' });
    }

    if (product.inventory.trackQuantity && product.inventory.quantity < quantity) {
      return res.status(400).json({
        message: `Only ${product.inventory.quantity} items available in stock`
      });
    }

    // Update item quantity
    await cart.updateItemQuantity(req.params.itemId, quantity);

    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status'
    });

    res.json({
      message: 'Cart item updated successfully',
      cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      message: 'Error updating cart item',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/cart/items/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete('/items/:itemId', authenticate, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    await cart.removeItem(req.params.itemId);

    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status'
    });

    res.json({
      message: 'Item removed from cart successfully',
      cart
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({
      message: 'Error removing item from cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/cart
// @desc    Clear cart
// @access  Private
router.delete('/', authenticate, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.clearCart();

    res.json({
      message: 'Cart cleared successfully',
      cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      message: 'Error clearing cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/cart/apply-coupon
// @desc    Apply coupon code to cart
// @access  Private
router.post('/apply-coupon', authenticate, async (req, res) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({ message: 'Coupon code is required' });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    if (cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // TODO: Implement coupon validation logic
    // For now, we'll use a simple demo coupon system
    const demoCoupons = {
      'SAVE10': { type: 'percentage', value: 10, minAmount: 50 },
      'SAVE20': { type: 'percentage', value: 20, minAmount: 100 },
      'FREESHIP': { type: 'fixed', value: 15, minAmount: 30 }
    };

    const coupon = demoCoupons[couponCode.toUpperCase()];
    if (!coupon) {
      return res.status(400).json({ message: 'Invalid coupon code' });
    }

    const subtotal = cart.subtotal;
    if (subtotal < coupon.minAmount) {
      return res.status(400).json({
        message: `Minimum order amount of $${coupon.minAmount} required for this coupon`
      });
    }

    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = Math.round((subtotal * coupon.value / 100) * 100) / 100;
    } else {
      discountAmount = coupon.value;
    }

    // Don't allow discount to exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    await cart.applyCoupon(couponCode.toUpperCase(), discountAmount);

    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status'
    });

    res.json({
      message: 'Coupon applied successfully',
      cart,
      discount: {
        code: couponCode.toUpperCase(),
        amount: discountAmount,
        type: coupon.type,
        value: coupon.value
      }
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({
      message: 'Error applying coupon',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/cart/coupon
// @desc    Remove coupon from cart
// @access  Private
router.delete('/coupon', authenticate, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.removeCoupon();

    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status'
    });

    res.json({
      message: 'Coupon removed successfully',
      cart
    });
  } catch (error) {
    console.error('Remove coupon error:', error);
    res.status(500).json({
      message: 'Error removing coupon',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/cart/count
// @desc    Get cart items count
// @access  Private
router.get('/count', authenticate, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    const count = cart ? cart.totalItems : 0;

    res.json({ count });
  } catch (error) {
    console.error('Get cart count error:', error);
    res.status(500).json({
      message: 'Error fetching cart count',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/cart/validate
// @desc    Validate cart items (check availability, prices, stock)
// @access  Private
router.post('/validate', authenticate, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.json({
        valid: true,
        issues: []
      });
    }

    const issues = [];
    const validItems = [];

    for (const item of cart.items) {
      const product = item.product;
      
      if (!product) {
        issues.push({
          type: 'product_not_found',
          itemId: item._id,
          message: 'Product no longer exists'
        });
        continue;
      }

      if (product.status !== 'active') {
        issues.push({
          type: 'product_inactive',
          itemId: item._id,
          productName: product.name,
          message: `${product.name} is no longer available`
        });
        continue;
      }

      // Check stock
      if (product.inventory.trackQuantity && product.inventory.quantity < item.quantity) {
        if (product.inventory.quantity === 0) {
          issues.push({
            type: 'out_of_stock',
            itemId: item._id,
            productName: product.name,
            message: `${product.name} is out of stock`
          });
          continue;
        } else {
          issues.push({
            type: 'insufficient_stock',
            itemId: item._id,
            productName: product.name,
            requestedQuantity: item.quantity,
            availableQuantity: product.inventory.quantity,
            message: `Only ${product.inventory.quantity} of ${product.name} available`
          });
        }
      }

      // Check if price has changed
      const currentPrice = product.price + item.selectedVariants.reduce((sum, variant) => sum + variant.priceModifier, 0);
      if (Math.abs(currentPrice - item.price) > 0.01) {
        issues.push({
          type: 'price_changed',
          itemId: item._id,
          productName: product.name,
          oldPrice: item.price,
          newPrice: currentPrice,
          message: `Price of ${product.name} has changed from $${item.price} to $${currentPrice}`
        });
      }

      validItems.push(item);
    }

    res.json({
      valid: issues.length === 0,
      issues,
      validItemsCount: validItems.length,
      totalItemsCount: cart.items.length
    });
  } catch (error) {
    console.error('Validate cart error:', error);
    res.status(500).json({
      message: 'Error validating cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

