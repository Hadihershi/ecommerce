const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { authenticate } = require('../middleware/auth');
const { validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/payment/stripe/create-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post('/stripe/create-intent', authenticate, async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify order belongs to user (unless admin)
    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if order is in valid state for payment
    if (order.payment.status === 'completed') {
      return res.status(400).json({ message: 'Order already paid' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order is cancelled' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.pricing.total * 100), // Stripe uses cents
      currency: 'usd',
      metadata: {
        orderId: order._id.toString(),
        userId: req.user.id
      },
      description: `Order ${order.orderNumber}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update order with payment intent ID
    order.payment.paymentIntentId = paymentIntent.id;
    order.payment.status = 'processing';
    await order.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      message: 'Error creating payment intent',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/payment/stripe/confirm
// @desc    Confirm Stripe payment
// @access  Private
router.post('/stripe/confirm', authenticate, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: 'Payment Intent ID is required' });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return res.status(404).json({ message: 'Payment intent not found' });
    }

    // Find order
    const order = await Order.findById(paymentIntent.metadata.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify order belongs to user (unless admin)
    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update order based on payment intent status
    if (paymentIntent.status === 'succeeded') {
      order.markAsPaid(paymentIntent.id, 'stripe');
      await order.save();

      res.json({
        message: 'Payment confirmed successfully',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          payment: order.payment
        }
      });
    } else {
      order.payment.status = 'failed';
      order.updateStatus('pending', 'Payment failed');
      await order.save();

      res.status(400).json({
        message: 'Payment failed',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      message: 'Error confirming payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/payment/stripe/webhook
// @desc    Handle Stripe webhooks
// @access  Public (but secured by Stripe signature)
router.post('/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        
        // Find and update order
        const order = await Order.findById(paymentIntent.metadata.orderId);
        if (order && order.payment.status !== 'completed') {
          order.markAsPaid(paymentIntent.id, 'stripe');
          await order.save();
          console.log(`Order ${order.orderNumber} payment confirmed via webhook`);
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        
        const failedOrder = await Order.findById(failedPayment.metadata.orderId);
        if (failedOrder) {
          failedOrder.payment.status = 'failed';
          failedOrder.updateStatus('pending', 'Payment failed');
          await failedOrder.save();
          console.log(`Order ${failedOrder.orderNumber} payment failed via webhook`);
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

// @route   POST /api/payment/paypal/create-order
// @desc    Create PayPal order (placeholder)
// @access  Private
router.post('/paypal/create-order', authenticate, async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify order belongs to user
    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // TODO: Implement actual PayPal integration
    // For now, return a mock response
    res.json({
      message: 'PayPal integration placeholder',
      orderId: 'PAYPAL_ORDER_ID_PLACEHOLDER',
      approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=PLACEHOLDER'
    });
  } catch (error) {
    console.error('Create PayPal order error:', error);
    res.status(500).json({
      message: 'Error creating PayPal order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/payment/paypal/capture
// @desc    Capture PayPal payment (placeholder)
// @access  Private
router.post('/paypal/capture', authenticate, async (req, res) => {
  try {
    const { orderID } = req.body;

    // TODO: Implement actual PayPal capture logic
    // For now, return a mock success response
    res.json({
      message: 'PayPal capture placeholder',
      captureId: 'PAYPAL_CAPTURE_ID_PLACEHOLDER',
      status: 'COMPLETED'
    });
  } catch (error) {
    console.error('Capture PayPal payment error:', error);
    res.status(500).json({
      message: 'Error capturing PayPal payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/payment/refund
// @desc    Process refund (admin only)
// @access  Private (Admin only)
router.post('/refund', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { orderId, amount, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.payment.status !== 'completed') {
      return res.status(400).json({ message: 'Order payment is not completed' });
    }

    // TODO: Implement actual refund logic for Stripe/PayPal
    // For now, just update order status
    order.payment.status = 'refunded';
    order.updateStatus('returned', reason || 'Refunded by admin', req.user.id);
    await order.save();

    res.json({
      message: 'Refund processed successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        payment: order.payment
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      message: 'Error processing refund',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/payment/config
// @desc    Get payment configuration for frontend
// @access  Private
router.get('/config', authenticate, (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
    paypalMode: process.env.PAYPAL_MODE || 'sandbox'
  });
});

module.exports = router;

