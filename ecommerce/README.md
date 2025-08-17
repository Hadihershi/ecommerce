# Full-Stack E-Commerce Platform

A modern, full-featured e-commerce web application built with React, Node.js, Express, and MongoDB. This platform includes user authentication, product management, shopping cart functionality, payment integration, and an admin dashboard.

## 🚀 Features

### Frontend (React)
- **User Authentication**: JWT-based login/register with protected routes
- **Product Catalog**: Browse products with search, filtering, and pagination
- **Product Details**: Comprehensive product pages with images, reviews, and variants
- **Shopping Cart**: Add/remove/update items with real-time calculations
- **Checkout Process**: Multi-step checkout with payment integration
- **User Dashboard**: Profile management, order history, and wishlist
- **Admin Dashboard**: Product, category, order, and user management
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **State Management**: Redux with persist for cart and user state
- **Payment Integration**: Stripe and PayPal integration (test mode)

### Backend (Node.js/Express)
- **RESTful API**: Comprehensive API with proper error handling
- **Authentication**: JWT-based authentication with role-based access
- **Database**: MongoDB with Mongoose for data modeling
- **File Upload**: Multer for handling product images
- **Payment Processing**: Stripe and PayPal integration
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Email Integration**: Prepared for email notifications (placeholder)

## 🛠 Tech Stack

### Frontend
- React 18
- React Router DOM v6
- Redux Toolkit + Redux Persist
- React Query
- React Hook Form
- Tailwind CSS
- Framer Motion
- Stripe/PayPal SDK
- Lucide React (Icons)

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcryptjs
- Multer (File Upload)
- Stripe SDK
- Express Validator
- Helmet (Security)
- CORS

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local or cloud instance)
- Git

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd ecommerce
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
copy env.example .env
# or on macOS/Linux
cp env.example .env
```

### 3. Configure Environment Variables

Edit the `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ecommerce

# JWT
JWT_SECRET=your_super_secure_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRE=7d

# Stripe (Test Keys)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# PayPal (Test Keys)
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_MODE=sandbox

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create environment file
echo REACT_APP_API_URL=http://localhost:5000/api > .env
echo REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here >> .env
```

### 5. Database Setup

1. **Install MongoDB**: 
   - Local: Download from [MongoDB Official Site](https://www.mongodb.com/try/download/community)
   - Cloud: Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier available)

2. **Start MongoDB** (if local):
   ```bash
   # Windows
   net start MongoDB

   # macOS
   brew services start mongodb/brew/mongodb-community

   # Linux
   sudo systemctl start mongod
   ```

3. **Seed Database** (optional):
   ```bash
   cd backend
   npm run seed
   ```

## 🚀 Running the Application

### Development Mode

1. **Start the Backend**:
   ```bash
   cd backend
   npm run dev
   ```
   Backend will run on http://localhost:5000

2. **Start the Frontend** (in a new terminal):
   ```bash
   cd frontend
   npm start
   ```
   Frontend will run on http://localhost:3000

### Production Mode

1. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Start Backend**:
   ```bash
   cd backend
   npm start
   ```

## 📦 Project Structure

```
ecommerce/
├── backend/                 # Node.js/Express API
│   ├── config/             # Database and app configuration
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Custom middleware
│   ├── models/            # Mongoose data models
│   ├── routes/            # API routes
│   ├── uploads/           # Uploaded files
│   ├── server.js          # Entry point
│   └── package.json
├── frontend/               # React application
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── store/         # Redux store
│   │   ├── styles/        # CSS styles
│   │   └── utils/         # Utility functions
│   └── package.json
└── README.md
```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:itemId` - Update cart item
- `DELETE /api/cart/items/:itemId` - Remove cart item

### Orders
- `GET /api/orders` - Get orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/status` - Update order status (Admin)

### Payment
- `POST /api/payment/stripe/create-intent` - Create payment intent
- `POST /api/payment/stripe/confirm` - Confirm payment
- `POST /api/payment/stripe/webhook` - Stripe webhook

## 🎯 Default Users

The application includes demo accounts:

**User Account:**
- Email: `user@demo.com`
- Password: `password123`

**Admin Account:**
- Email: `admin@demo.com`
- Password: `password123`

## 💳 Payment Testing

### Stripe Test Cards
- **Success**: `4242424242424242`
- **Decline**: `4000000000000002`
- Use any future expiry date and any CVC

### PayPal Test
- Use PayPal sandbox credentials in your developer account

## 🚀 Deployment

### Backend Deployment (Heroku/Railway/DigitalOcean)

1. Set environment variables in your hosting platform
2. Ensure MongoDB connection string is configured
3. Update CORS settings for production domain

### Frontend Deployment (Netlify/Vercel/GitHub Pages)

1. Build the project: `npm run build`
2. Deploy the `build` folder
3. Configure API URL environment variable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**:
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network access for cloud databases

2. **Payment Integration Issues**:
   - Verify Stripe/PayPal API keys
   - Check webhook configurations
   - Ensure test mode is enabled

3. **CORS Errors**:
   - Verify `FRONTEND_URL` in backend `.env`
   - Check API URL in frontend `.env`

4. **Build Errors**:
   - Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed information
4. Contact: [your-email@example.com]

## 🎉 Acknowledgments

- Icons by [Lucide](https://lucide.dev/)
- UI Components inspired by [Tailwind UI](https://tailwindui.com/)
- Payment integration with [Stripe](https://stripe.com/) and [PayPal](https://paypal.com/)

---

**Happy Coding!** 🚀

