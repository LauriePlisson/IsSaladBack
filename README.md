# IsSalad Backend

A RESTful API backend service for the IsSalad application, built with Node.js and Express. This service provides secure authentication, data management, and business logic to support the IsSalad frontend and other services.

## 📋 Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Examples](#api-examples)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- **RESTful API** - Comprehensive endpoints for users, salads, and orders
- **Authentication** - Secure JWT-based authentication and authorization
- **Database Integration** - MongoDB with Mongoose ODM
- **File Upload** - Cloudinary integration for image handling
- **AI Integration** - OpenAI API for enhanced features
- **Input Validation** - Robust request validation and error handling
- **Modular Architecture** - Scalable and maintainable codebase
- **Environment Configuration** - Flexible deployment configurations
- **Test Coverage** - Comprehensive automated testing
- **API Documentation** - Interactive Swagger documentation

## 🚀 Getting Started

### Prerequisites

Before running this project, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v14+ recommended)
- [Yarn](https://yarnpkg.com/) package manager
- MongoDB (local installation or cloud instance)
- Cloudinary account for image uploads
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/IsSalad_Backend.git
   cd IsSalad_Backend
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration values.

4. **Start the development server**
   ```bash
   yarn start
   ```
   
   For development with auto-reload:
   ```bash
   yarn dev
   # or
   nodemon
   ```

The server will start on `http://localhost:3000` by default.

## 📚 API Documentation

Interactive API documentation is available via Swagger UI. After starting the server, visit:

```
http://localhost:3000/api-docs
```

## 🏗️ Project Structure

```
IsSalad_Backend/
├── bin/
│   └── www                 # Server startup script
├── models/
│   ├── connection.js       # Database connection
│   ├── post.js            # Post model
│   ├── teams.js           # Teams model
│   └── users.js           # User model
├── modules/
│   ├── checkBody.js       # Request validation utilities
│   └── team.js            # Team-related utilities
├── routes/
│   ├── index.js           # Main routes
│   ├── posts.js           # Post endpoints
│   ├── teams.js           # Team endpoints
│   └── users.js           # User endpoints
├── test/
│   ├── changeUsername.test.js
│   └── getTeams.test.js
├── public/
│   ├── index.html
│   └── stylesheets/
├── app.js                 # Express app configuration
├── package.json
└── README.md
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | Secret key for JWT tokens | ✅ |
| `CLOUDINARY_URL` | Cloudinary configuration URL | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |

Example `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/issalad
JWT_SECRET=your-super-secret-jwt-key
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
OPENAI_API_KEY=your-openai-api-key
PORT=3000
```

## 🔧 Development

### Running in Development Mode

```bash
# Start with nodemon for auto-reload
yarn dev

# or manually with nodemon
nodemon app.js
```

### Code Style

This project follows standard JavaScript/Node.js conventions. Please ensure your code is properly formatted before submitting changes.

## 🧪 Testing

Run the test suite with:

```bash
yarn test
```

Tests are located in the `test/` directory and cover:
- User authentication and management
- Team operations
- API endpoint functionality

## 🚀 Deployment

### Production Deployment

1. **Set environment variables** for your production environment
2. **Use a process manager** like PM2:
   ```bash
   pm2 start app.js --name "issalad-backend"
   ```
3. **Deploy to cloud platforms** such as:
   - Heroku
   - Vercel
   - DigitalOcean
   - AWS

### Production Checklist

- [ ] All environment variables configured
- [ ] Database connection secured
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Monitoring setup
- [ ] Backup strategy in place

## 📖 API Examples

### User Registration

```http
POST /users/SignUp
Content-Type: application/json

{
    "username": "saladlover",
    "email": "user@example.com",
    "password": "securepassword"
}
```

### Get All Salads

```http
GET /teams/salads
Authorization: Bearer <JWT_TOKEN>
```

### Response Format

All API responses follow this structure:

```json
{
    "success": true,
    "data": {
        // Response data
    },
    "message": "Operation completed successfully"
}
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- Write clear commit messages
- Add tests for new features
- Update documentation as needed
- Follow existing code style

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the IsSalad community**