const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateOrder, validatePagination, validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/orders
// @desc    Get user's orders or all orders (admin)
// @access  Private
router.get('/', authenticate, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = req.user.role === 'admin' ? {} : { user: req.user.id };
    
    if (status) {
      filter.status = status;
    }

    // Build sort
    const sortOptions = {};
    const order = sortOrder === 'asc' ? 1 : -1;
    sortOptions[sortBy] = order;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = Order.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Populate differently based on user role
    if (req.user.role === 'admin') {
      query = query.populate('user', 'firstName lastName email');
    }

    query = query.populate('items.product', 'name images');

    const orders = await query;
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      message: 'Error fetching orders',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get('/:id', authenticate, validateMongoId, async (req, res) => {
  try {
    let query = Order.findById(req.params.id);

    // Non-admin users can only see their own orders
    if (req.user.role !== 'admin') {
      query = query.where({ user: req.user.id });
    }

    const order = await query
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images sku');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      message: 'Error fetching order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/orders
// @desc    Create a new order from cart
// @access  Private
router.post('/', authenticate, validateOrder, async (req, res) => {
  try {
    const {
      shippingAddress,
      billingAddress,
      payment,
      notes,
      isGift = false,
      giftMessage
    } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate cart items and calculate pricing
    let subtotal = 0;
    const orderItems = [];

    for (const cartItem of cart.items) {
      const product = cartItem.product;

      if (!product || product.status !== 'active') {
        return res.status(400).json({
          message: `Product ${product?.name || 'Unknown'} is no longer available`
        });
      }

      // Check stock
      if (product.inventory.trackQuantity && product.inventory.quantity < cartItem.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Only ${product.inventory.quantity} available.`
        });
      }

      // Calculate item total with variants
      const variantPrice = cartItem.selectedVariants.reduce((sum, variant) => sum + variant.priceModifier, 0);
      const itemPrice = product.price + variantPrice;
      const itemTotal = itemPrice * cartItem.quantity;

      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images[0]?.url || '',
        price: itemPrice,
        quantity: cartItem.quantity,
        selectedVariants: cartItem.selectedVariants
      });
    }

    // Calculate shipping (simple logic - can be enhanced)
    const shipping = subtotal >= 100 ? 0 : 10; // Free shipping over $100
    
    // Calculate tax (8.5% - can be based on location)
    const tax = Math.round((subtotal + shipping) * 0.085 * 100) / 100;
    
    // Apply cart discount
    const discount = cart.discount || 0;
    
    // Calculate total
    const total = subtotal + shipping + tax - discount;

    // Create order
    const order = new Order({
      user: req.user.id,
      items: orderItems,
      shippingAddress,
      billingAddress,
      pricing: {
        subtotal,
        shipping,
        tax,
        discount,
        total
      },
      payment: {
        method: payment.method,
        status: 'pending'
      },
      notes,
      couponCode: cart.couponCode,
      isGift,
      giftMessage
    });

    await order.save();

    // Update product inventory
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { 'inventory.quantity': -item.quantity } }
      );
    }

    // Clear cart
    await cart.clearCart();

    // Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name images sku');

    res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      message: 'Error creating order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private (Admin only)
router.put('/:id/status', authenticate, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const { status, note } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update status and add to history
    order.updateStatus(status, note, req.user.id);

    // Handle specific status changes
    if (status === 'cancelled' && order.payment.status === 'completed') {
      // Restore inventory
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { 'inventory.quantity': item.quantity } }
        );
      }
    }

    if (status === 'delivered') {
      order.tracking.actualDelivery = new Date();
    }

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images sku');

    res.json({
      message: 'Order status updated successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      message: 'Error updating order status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/orders/:id/tracking
// @desc    Update order tracking information
// @access  Private (Admin only)
router.put('/:id/tracking', authenticate, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const { carrier, trackingNumber, estimatedDelivery } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'tracking.carrier': carrier,
          'tracking.trackingNumber': trackingNumber,
          'tracking.estimatedDelivery': estimatedDelivery ? new Date(estimatedDelivery) : undefined,
          'tracking.trackingUrl': trackingNumber ? `https://track.example.com/${trackingNumber}` : undefined
        }
      },
      { new: true }
    )
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images sku');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Auto-update status to shipped if not already
    if (trackingNumber && order.status === 'processing') {
      order.updateStatus('shipped', 'Tracking information added', req.user.id);
      await order.save();
    }

    res.json({
      message: 'Tracking information updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order tracking error:', error);
    res.status(500).json({
      message: 'Error updating tracking information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/orders/:id/cancel
// @desc    Cancel an order
// @access  Private
router.post('/:id/cancel', authenticate, validateMongoId, async (req, res) => {
  try {
    const { reason } = req.body;

    let query = Order.findById(req.params.id);
    
    // Non-admin users can only cancel their own orders
    if (req.user.role !== 'admin') {
      query = query.where({ user: req.user.id });
    }

    const order = await query;
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order can be cancelled
    const cancelableStatuses = ['pending', 'confirmed', 'processing'];
    if (!cancelableStatuses.includes(order.status)) {
      return res.status(400).json({
        message: `Order cannot be cancelled. Current status: ${order.status}`
      });
    }

    // Cancel order
    order.updateStatus('cancelled', reason || 'Cancelled by user', req.user.id);

    // Restore inventory if payment was completed
    if (order.payment.status === 'completed') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { 'inventory.quantity': item.quantity } }
        );
      }
    }

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images sku');

    res.json({
      message: 'Order cancelled successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      message: 'Error cancelling order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/orders/analytics/summary
// @desc    Get orders analytics summary
// @access  Private (Admin only)
router.get('/analytics/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    const analytics = await Order.getSalesAnalytics(start, end);

    // Get status breakdown
    const statusBreakdown = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { 
            $sum: { 
              $cond: [
                { $eq: ['$payment.status', 'completed'] },
                '$pricing.total',
                0
              ]
            }
          }
        }
      }
    ]);

    // Get top products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          'payment.status': 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      analytics,
      statusBreakdown,
      topProducts,
      period: { startDate: start, endDate: end }
    });
  } catch (error) {
    console.error('Get orders analytics error:', error);
    res.status(500).json({
      message: 'Error fetching orders analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

