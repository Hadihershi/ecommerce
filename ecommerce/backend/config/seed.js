const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log('Cleared existing data');

    // Create demo users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const demoUsers = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@demo.com',
        password: hashedPassword,
        role: 'user',
        isActive: true
      },
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@demo.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      }
    ];

    const users = await User.insertMany(demoUsers);
    console.log('Demo users created');

    // Create categories
    const categories = [
      {
        name: 'Electronics',
        description: 'Electronic devices and accessories',
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'Clothing',
        description: 'Fashion and apparel',
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'Home & Garden',
        description: 'Home improvement and garden supplies',
        isActive: true,
        sortOrder: 3
      },
      {
        name: 'Sports',
        description: 'Sports equipment and accessories',
        isActive: true,
        sortOrder: 4
      }
    ];

    const createdCategories = await Category.insertMany(categories);
    console.log('Categories created');

    // Create sample products
    const products = [
      {
        name: 'Wireless Bluetooth Headphones',
        description: 'High-quality wireless headphones with noise cancellation and long battery life.',
        price: 99.99,
        comparePrice: 129.99,
        category: createdCategories[0]._id,
        brand: 'TechBrand',
        sku: 'WBH001',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
            alt: 'Wireless Bluetooth Headphones',
            isPrimary: true
          }
        ],
        inventory: {
          quantity: 50,
          lowStockThreshold: 10,
          trackQuantity: true
        },
        specifications: [
          { name: 'Battery Life', value: '30 hours' },
          { name: 'Connectivity', value: 'Bluetooth 5.0' },
          { name: 'Weight', value: '250g' }
        ],
        tags: ['wireless', 'bluetooth', 'headphones', 'audio'],
        status: 'active',
        isFeatured: true
      },
      {
        name: 'Cotton T-Shirt',
        description: 'Comfortable 100% cotton t-shirt available in multiple colors.',
        price: 19.99,
        comparePrice: 29.99,
        category: createdCategories[1]._id,
        brand: 'FashionCo',
        sku: 'CTS001',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
            alt: 'Cotton T-Shirt',
            isPrimary: true
          }
        ],
        inventory: {
          quantity: 100,
          lowStockThreshold: 20,
          trackQuantity: true
        },
        variants: [
          {
            name: 'Size',
            options: [
              { value: 'S', priceModifier: 0 },
              { value: 'M', priceModifier: 0 },
              { value: 'L', priceModifier: 0 },
              { value: 'XL', priceModifier: 5 }
            ]
          },
          {
            name: 'Color',
            options: [
              { value: 'White', priceModifier: 0 },
              { value: 'Black', priceModifier: 0 },
              { value: 'Blue', priceModifier: 0 }
            ]
          }
        ],
        tags: ['clothing', 'cotton', 'casual', 'comfortable'],
        status: 'active',
        isFeatured: true
      },
      {
        name: 'LED Desk Lamp',
        description: 'Modern LED desk lamp with adjustable brightness and USB charging port.',
        price: 45.99,
        category: createdCategories[2]._id,
        brand: 'HomeLighting',
        sku: 'LDL001',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
            alt: 'LED Desk Lamp',
            isPrimary: true
          }
        ],
        inventory: {
          quantity: 30,
          lowStockThreshold: 5,
          trackQuantity: true
        },
        specifications: [
          { name: 'Power', value: '12W LED' },
          { name: 'USB Ports', value: '2' },
          { name: 'Adjustable', value: 'Yes' }
        ],
        tags: ['lamp', 'led', 'desk', 'home', 'office'],
        status: 'active'
      },
      {
        name: 'Yoga Mat',
        description: 'Non-slip yoga mat perfect for all types of exercise and meditation.',
        price: 29.99,
        category: createdCategories[3]._id,
        brand: 'FitLife',
        sku: 'YM001',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
            alt: 'Yoga Mat',
            isPrimary: true
          }
        ],
        inventory: {
          quantity: 75,
          lowStockThreshold: 15,
          trackQuantity: true
        },
        specifications: [
          { name: 'Material', value: 'TPE' },
          { name: 'Thickness', value: '6mm' },
          { name: 'Dimensions', value: '183 x 61 cm' }
        ],
        tags: ['yoga', 'exercise', 'fitness', 'mat'],
        status: 'active'
      },
      {
        name: 'Smartphone Case',
        description: 'Protective smartphone case with card holder and kickstand.',
        price: 24.99,
        category: createdCategories[0]._id,
        brand: 'TechProtect',
        sku: 'SPC001',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1556656793-08538906a9f8',
            alt: 'Smartphone Case',
            isPrimary: true
          }
        ],
        inventory: {
          quantity: 200,
          lowStockThreshold: 25,
          trackQuantity: true
        },
        tags: ['phone', 'case', 'protection', 'accessory'],
        status: 'active',
        isFeatured: true
      }
    ];

    await Product.insertMany(products);
    console.log('Sample products created');

    console.log('\n✅ Database seeded successfully!');
    console.log('\nDemo Accounts:');
    console.log('User: user@demo.com / password123');
    console.log('Admin: admin@demo.com / password123');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

const runSeed = async () => {
  await connectDB();
  await seedData();
  mongoose.connection.close();
  console.log('\nDatabase connection closed');
  process.exit(0);
};

runSeed();

