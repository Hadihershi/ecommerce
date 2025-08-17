const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    url: {
      type: String,
      default: ''
    },
    alt: {
      type: String,
      default: ''
    }
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  path: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  metaTitle: {
    type: String,
    trim: true,
    maxlength: [60, 'Meta title cannot exceed 60 characters']
  },
  metaDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'Meta description cannot exceed 160 characters']
  },
  attributes: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'number', 'boolean', 'select', 'multiselect'],
      required: true
    },
    options: [{
      value: String,
      label: String
    }],
    isRequired: {
      type: Boolean,
      default: false
    },
    isFilterable: {
      type: Boolean,
      default: true
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ path: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ isActive: 1 });

// Generate slug from name
categorySchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }
  next();
});

// Generate path based on parent categories
categorySchema.pre('save', async function(next) {
  if (this.isModified('parent') || this.isNew) {
    if (this.parent) {
      try {
        const parentCategory = await this.model('Category').findById(this.parent);
        if (parentCategory) {
          this.level = parentCategory.level + 1;
          this.path = parentCategory.path ? `${parentCategory.path}/${this.slug}` : this.slug;
        }
      } catch (error) {
        return next(error);
      }
    } else {
      this.level = 0;
      this.path = this.slug;
    }
  }
  next();
});

// Virtual for children categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Virtual for products count
categorySchema.virtual('productsCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function(parentId = null) {
  const categories = await this.find({
    parent: parentId,
    isActive: true
  }).sort({ sortOrder: 1, name: 1 });

  const categoryTree = [];
  for (const category of categories) {
    const children = await this.getCategoryTree(category._id);
    const categoryObj = category.toObject();
    if (children.length > 0) {
      categoryObj.children = children;
    }
    categoryTree.push(categoryObj);
  }

  return categoryTree;
};

// Static method to get full category path
categorySchema.statics.getFullPath = async function(categoryId) {
  const category = await this.findById(categoryId);
  if (!category) return null;

  const pathSegments = [];
  let current = category;

  while (current) {
    pathSegments.unshift({
      id: current._id,
      name: current.name,
      slug: current.slug
    });

    if (current.parent) {
      current = await this.findById(current.parent);
    } else {
      current = null;
    }
  }

  return pathSegments;
};

// Instance method to get all descendant categories
categorySchema.methods.getDescendants = async function() {
  const descendants = [];
  
  const getChildren = async (parentId) => {
    const children = await this.model('Category').find({ parent: parentId });
    for (const child of children) {
      descendants.push(child);
      await getChildren(child._id);
    }
  };

  await getChildren(this._id);
  return descendants;
};

module.exports = mongoose.model('Category', categorySchema);

