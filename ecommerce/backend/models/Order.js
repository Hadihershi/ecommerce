const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  selectedVariants: [{
    name: String,
    value: String,
    priceModifier: {
      type: Number,
      default: 0
    }
  }]
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [orderItemSchema],
  shippingAddress: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'United States' }
  },
  billingAddress: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'United States' }
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shipping: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    discount: {
      type: Number,
      min: 0,
      default: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['stripe', 'paypal', 'cash_on_delivery'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'pending'
    },
    transactionId: {
      type: String,
      sparse: true
    },
    paidAt: {
      type: Date
    },
    paymentIntentId: {
      type: String,
      sparse: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  tracking: {
    carrier: {
      type: String
    },
    trackingNumber: {
      type: String
    },
    trackingUrl: {
      type: String
    },
    estimatedDelivery: {
      type: Date
    },
    actualDelivery: {
      type: Date
    }
  },
  notes: {
    customer: {
      type: String,
      maxlength: [500, 'Customer notes cannot exceed 500 characters']
    },
    admin: {
      type: String,
      maxlength: [500, 'Admin notes cannot exceed 500 characters']
    }
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    note: {
      type: String
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  couponCode: {
    type: String,
    uppercase: true
  },
  isGift: {
    type: Boolean,
    default: false
  },
  giftMessage: {
    type: String,
    maxlength: [200, 'Gift message cannot exceed 200 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
orderSchema.index({ user: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'payment.transactionId': 1 });

// Generate order number
orderSchema.pre('save', function(next) {
  if (this.isNew) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    this.orderNumber = `ORD-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
  }
  next();
});

// Virtual for total items count
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for order age in days
orderSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Instance method to add status to history
orderSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = null) {
  this.statusHistory.push({
    status: newStatus,
    note,
    updatedBy,
    updatedAt: new Date()
  });
  this.status = newStatus;
};

// Instance method to mark as paid
orderSchema.methods.markAsPaid = function(transactionId, paymentMethod = 'stripe') {
  this.payment.status = 'completed';
  this.payment.transactionId = transactionId;
  this.payment.paidAt = new Date();
  this.updateStatus('confirmed', 'Payment received');
};

// Static method to get sales analytics
orderSchema.statics.getSalesAnalytics = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        'payment.status': 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrderValue: { $avg: '$pricing.total' },
        totalItems: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    totalItems: 0
  };
};

module.exports = mongoose.model('Order', orderSchema);

