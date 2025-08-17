const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  selectedVariants: [{
    name: {
      type: String,
      required: true
    },
    value: {
      type: String,
      required: true
    },
    priceModifier: {
      type: Number,
      default: 0
    }
  }],
  price: {
    type: Number,
    required: true,
    min: 0
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  couponCode: {
    type: String,
    uppercase: true
  },
  discount: {
    type: Number,
    min: 0,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
cartSchema.index({ user: 1 });
cartSchema.index({ lastActivity: -1 });

// Virtual for total items count
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for subtotal (before discount)
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => {
    const variantPrice = item.selectedVariants.reduce((sum, variant) => sum + variant.priceModifier, 0);
    return total + ((item.price + variantPrice) * item.quantity);
  }, 0);
});

// Virtual for total (after discount)
cartSchema.virtual('total').get(function() {
  const subtotal = this.subtotal;
  return Math.max(0, subtotal - this.discount);
});

// Update last activity on save
cartSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Instance method to add item to cart
cartSchema.methods.addItem = function(productId, quantity, selectedVariants = [], price) {
  // Check if item with same product and variants already exists
  const existingItemIndex = this.items.findIndex(item => {
    if (item.product.toString() !== productId.toString()) return false;
    
    // Compare variants
    if (item.selectedVariants.length !== selectedVariants.length) return false;
    
    return item.selectedVariants.every(variant => {
      return selectedVariants.some(sv => 
        sv.name === variant.name && sv.value === variant.value
      );
    });
  });

  if (existingItemIndex > -1) {
    // Update quantity of existing item
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity,
      selectedVariants,
      price
    });
  }

  return this.save();
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (item) {
    if (quantity <= 0) {
      this.items.pull(itemId);
    } else {
      item.quantity = quantity;
    }
    return this.save();
  }
  throw new Error('Item not found in cart');
};

// Instance method to remove item
cartSchema.methods.removeItem = function(itemId) {
  this.items.pull(itemId);
  return this.save();
};

// Instance method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.couponCode = undefined;
  this.discount = 0;
  return this.save();
};

// Instance method to apply coupon
cartSchema.methods.applyCoupon = function(couponCode, discountAmount) {
  this.couponCode = couponCode;
  this.discount = discountAmount;
  return this.save();
};

// Instance method to remove coupon
cartSchema.methods.removeCoupon = function() {
  this.couponCode = undefined;
  this.discount = 0;
  return this.save();
};

// Static method to clean up abandoned carts
cartSchema.statics.cleanupAbandonedCarts = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    lastActivity: { $lt: cutoffDate }
  });
};

// Static method to get cart analytics
cartSchema.statics.getAnalytics = async function() {
  const pipeline = [
    {
      $match: {
        'items.0': { $exists: true } // Only carts with items
      }
    },
    {
      $project: {
        totalItems: { $sum: '$items.quantity' },
        subtotal: {
          $sum: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $multiply: [
                  '$$item.quantity',
                  {
                    $add: [
                      '$$item.price',
                      { $sum: '$$item.selectedVariants.priceModifier' }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalCarts: { $sum: 1 },
        averageItems: { $avg: '$totalItems' },
        averageValue: { $avg: '$subtotal' },
        totalValue: { $sum: '$subtotal' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalCarts: 0,
    averageItems: 0,
    averageValue: 0,
    totalValue: 0
  };
};

module.exports = mongoose.model('Cart', cartSchema);

