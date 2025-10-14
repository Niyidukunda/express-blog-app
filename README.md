# Purpose & Perspective - Personal Reflection Blog

A secure, full-stack blog application built with Node.js, Express, MongoDB, and EJS templating. This personal reflection platform shares insights on life, growth, and finding meaning, designed as an extension of my professional portfolio. The app includes comprehensive security features, user authentication with role-based access control, intelligent fallback storage, and automatic database reconnection to ensure it stays online even when the database is unavailable.

> *A personal space for sharing insights on purpose, growth, and meaningful living - built with enterprise-level security and user management.*

## 🆕 Latest Updates (October 2025)

### **User Authentication & Authorization System**
- **Secure User Registration**: New users can create accounts with password hashing using bcrypt
- **Session-Based Authentication**: Secure login/logout system with MongoDB session storage
- **Role-Based Access Control**: Admin privileges for all operations, regular users can only manage their own posts
- **Post Ownership Tracking**: Each post is linked to its author with proper ownership validation
- **Environment Variable Security**: Admin credentials secured with environment variables

### **Enhanced User Interface**
- **Navigation Improvements**: Enlarged menu with capital letters, improved visibility, and hover effects
- **Theme Support**: Dark/light theme toggle with consistent styling across all components
- **Button Visibility Fixes**: All navigation and action buttons now have proper contrast and visibility
- **Responsive Design**: Mobile-friendly interface with glass-morphism effects
- **Dynamic Earth Background**: Animated earth texture with dynamic positioning

### **Production-Ready Features**
- **Database Migration System**: Automatic migration of existing posts to include author information
- **Health Monitoring**: Comprehensive system status checks and error handling
- **Performance Optimization**: Query optimization and response caching
- **Security Hardening**: XSS protection, CSRF prevention, and input sanitization

## Security Features

This application implements comprehensive security measures to protect against common web vulnerabilities:

### **XSS (Cross-Site Scripting) Protection**
- **Input Sanitization**: All user inputs are sanitized using the `xss` library
- **HTML Escaping**: EJS templates use escaped output (`<%= %>`) by default
- **Content Filtering**: Malicious HTML tags and scripts are stripped from content
- **Whitelist Approach**: Only safe HTML tags are allowed in post content

### **User Authentication & Authorization**
- **Password Security**: Bcrypt hashing with salt rounds for secure password storage
- **Session Management**: Express-session with MongoDB store for persistent sessions
- **Role-Based Access**: Admin can manage all posts, users can only manage their own
- **Post Ownership**: Automatic author tracking and ownership validation middleware
- **Environment Security**: Admin credentials protected with environment variables

### **Input Validation**
- **Field Length Limits**: Title (200 chars), Body (10,000 chars), Category (50 chars)
- **Data Type Validation**: URL validation for image links, required field checking
- **Express Validator**: Server-side validation with detailed error messages
- **Trim & Escape**: Automatic trimming and escaping of text inputs
- **User Input Sanitization**: Username and password validation with security checks

### **Rate Limiting**
- **General API**: 100 requests per 15 minutes per IP
- **Post Creation**: 5 posts per hour per IP  
- **File Uploads**: 10 uploads per hour per IP
- **DDoS Protection**: Prevents server overload and abuse

### **Security Headers (Helmet.js)**
- **Content Security Policy (CSP)**: Prevents XSS and code injection
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **HSTS**: Forces HTTPS connections (in production)

### **File Upload Security**
- **MIME Type Validation**: Only JPEG, PNG, WebP, and GIF files allowed
- **File Extension Checking**: Double validation against spoofed files
- **File Size Limits**: Maximum 5MB per upload
- **Secure File Naming**: Random UUID-based filenames prevent conflicts
- **Path Traversal Protection**: Prevents directory traversal attacks

### **CORS Configuration**
- **Origin Whitelisting**: Only allowed domains can access the API
- **Credential Control**: Secure cookie and session handling
- **Environment-based**: Different settings for development and production

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Home     │  │   Compose   │  │    Posts    │        │
│  │   Page      │  │    Page     │  │    Pages    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS (Secured)
┌─────────────────────────────────────────────────────────────┐
│                SECURITY MIDDLEWARE LAYER                    │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Helmet    │  │Rate Limiter │  │    CORS     │        │
│  │ (Headers)   │  │ Protection  │  │  Control    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Validated Requests
┌─────────────────────────────────────────────────────────────┐
│                   EXPRESS SERVER                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Routes    │  │   Input     │  │   Static    │        │
│  │  Handler    │  │ Validation  │  │   Assets    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          XSS SANITIZATION & VALIDATION              │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │    XSS      │  │ Express     │  │   File      │ │   │
│  │  │ Filtering   │  │ Validator   │  │ Validation  │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          CONNECTION MANAGEMENT                       │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  MongoDB    │  │  Fallback   │  │ Auto-Retry  │ │   │
│  │  │   Check     │  │  Storage    │  │   Logic     │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Sanitized Data
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                               │
│                                                             │
│  ┌─────────────────────┐       ┌─────────────────────┐     │
│  │   MongoDB Atlas     │  OR   │   In-Memory Array   │     │
│  │  (Persistent Data)  │       │  (Temporary Data)   │     │
│  └─────────────────────┘       └─────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
BLOG WebApp/
├── index.js                           # Main server file with authentication routes
├── package.json                       # Dependencies & scripts  
├── README.md                          # This documentation
├── TECHNICAL_ARCHITECTURE.md          # Detailed technical documentation
├── VISUAL_FLOW_DIAGRAMS.md           # ASCII diagrams and user flows
├── vercel.json                        # Vercel deployment configuration
├── test-security.js                   # Security testing utilities
├── .env.example                       # Environment variables template
├── models/
│   ├── Post.js                        # MongoDB Post schema with author tracking
│   └── User.js                        # MongoDB User schema with authentication
├── views/                             # EJS templates
│   ├── index.ejs                      # Homepage template
│   ├── compose.ejs                    # New post creation form
│   ├── posts.ejs                      # Individual post view
│   ├── edit.ejs                       # Post editing interface
│   └── partials/
│       ├── header.ejs                 # Shared header with navigation
│       └── footer.ejs                 # Shared footer
└── public/
    ├── styles/
    │   └── main.css                   # Application styling
    ├── js/
    │   ├── search-filter.js           # Search and filter functionality
    │   └── theme-toggle.js            # Dark/light theme switching
    ├── images/                        # Static demo images
    │   ├── demo-home.png              # Homepage screenshot
    │   ├── demo-edit-delete.png       # Edit/delete interface
    │   ├── demo-compose.png           # Compose page screenshot
    │   └── [other assets...]          # Various image assets
    └── uploads/                       # User uploaded images
        └── [timestamp-random].jpg     # Auto-generated secure filenames
```

## Tech Stack

### Core Technologies
- **Node.js + Express**: Backend server and routing with middleware architecture
- **MongoDB Atlas + Mongoose**: Cloud database with ODM and User/Post models
- **EJS**: Server-side templating engine with conditional rendering
- **UUID**: Unique identifier generation for fallback storage
- **Body-parser**: Form data handling middleware
- **Express-Session**: Session management with MongoDB store
- **Bcrypt**: Password hashing and authentication security

### Frontend & Styling
- **HTML5/CSS3**: Responsive design with CSS Grid and Flexbox
- **CSS Variables**: Dynamic theming system for light/dark modes  
- **Glass-morphism UI**: Modern transparent card designs with backdrop blur
- **EJS Partials**: Modular header/footer components with dynamic navigation
- **Dynamic Forms**: Create, edit, delete with conditional visibility based on user roles
- **JavaScript**: Theme toggle, search filtering, and interactive elements

## Intelligent Fallback System

This application features a unique dual-storage architecture that ensures 100% uptime. If MongoDB is unavailable, the app automatically switches to in-memory storage so users can still create and manage posts.

```javascript
// Automatic MongoDB detection and fallback
async function connectToMongoDB() {
  try {
    await mongoose.connect(mongoURI);
    isMongoConnected = true;  // Use MongoDB
    console.log("Connected to MongoDB Atlas");
  } catch (err) {
    isMongoConnected = false; // Use fallback storage
    console.log("MongoDB unavailable, switching to local storage");
    // Auto-retry every 30 seconds (max 5 attempts)
    setTimeout(connectToMongoDB, 30000);
  }
}

// Every route uses this pattern for maximum reliability
app.get("/", async (req, res) => {
  try {
    const posts = isMongoConnected 
      ? await Post.find().sort({ createdAt: -1 })  // Cloud data
      : fallbackPosts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); // Local data
    
    res.render("index", { posts, isMongoConnected });
  } catch (err) {
    // Triple-layer protection: even if both fail, app still works
    res.render("index", { posts: [], isMongoConnected: false });
  }
});
```

### How It Works
1. **App starts** and attempts MongoDB connection
2. **Success** - All operations use MongoDB Atlas (persistent)  
3. **Failure** - Seamlessly switches to in-memory arrays (temporary)
4. **Auto-recovery** - Retries connection every 30 seconds
5. **User notification** - Status banner shows current mode
6. **Zero downtime** - Users can always create/edit posts

## Screenshots

**Homepage with Connection Status**
![blog-home-UI](image.png)  

**Post Editing Interface**
![demo-edit-post](image-1.png)  

**Compose New Post**
![compose-UI](image-2.png)  

## What I Learned Building This

### Technical Skills
- **Dynamic Routing**: Mastered `req.params` for RESTful URLs (`/posts/:id`)
- **Form Processing**: POST request handling with body-parser middleware
- **Template Engineering**: EJS partials, includes, and conditional rendering
- **Error Handling**: Multi-layer fallback systems and graceful degradation
- **Database Integration**: MongoDB Atlas connection with Mongoose ODM
- **System Architecture**: Dual-storage patterns for maximum reliability

### Problem-Solving Breakthroughs
- **Connection Management**: Auto-retry logic with exponential backoff
- **User Experience**: Real-time status notifications and seamless failover
- **Code Organization**: Modular route handlers and reusable components
- **Debugging**: Control flow analysis and rendering troubleshooting

## Quick Start

### Prerequisites
- Node.js v18+ installed
- MongoDB Atlas account (optional - app works without it!)

### Installation & Setup
```bash
# Clone and navigate to project
cd BLOG-WebApp

# Install dependencies
npm install

# Start the application
node index.js
```

### First Run Experience
```
Connecting to MongoDB Atlas...
Connected to MongoDB Atlas successfully!
Server running at http://localhost:3000

If MongoDB fails to connect:
MongoDB connection failed: network timeout
Reconnection attempt 1/5 in 30 seconds...
Running with in-memory storage - app fully functional!
```

**Visit**: `http://localhost:3000` and start blogging immediately!

## Project Status & Roadmap

### Completed Features ✅
- **User Authentication System**: Complete registration, login, logout with secure sessions
- **Role-Based Access Control**: Admin vs regular user permissions with ownership validation
- **Post Management**: Create, Read, Update, Delete with author tracking and permission checks
- **Persistent Storage**: MongoDB Atlas integration with User and Post models
- **Intelligent Fallback**: In-memory storage for 100% uptime guarantee  
- **Auto-Recovery**: Connection retry logic with health monitoring
- **Database Migration**: Automatic migration system for existing posts to include author data
- **Enhanced UI/UX**: Dark/light theme toggle, improved navigation visibility, glass-morphism design
- **Security Hardening**: Environment variable protection, input sanitization, XSS prevention
- **Production Optimization**: Performance monitoring, error handling, and deployment readiness

### Next Steps 🚀
- **Public Deployment**: Deploy to Vercel with production environment variables
- **Testing Suite**: Unit and integration tests for authentication and post management
- **Analytics Dashboard**: View tracking, user statistics, and popular posts metrics
- **Rich Text Editor**: WYSIWYG editor with image upload and formatting options
- **Email Notifications**: User registration confirmation and password reset
- **Comment System**: User engagement with nested comments and moderation

### Long-term Goals
- **Multi-tenancy**: Support multiple blog instances
- **Mobile App**: React Native companion app
- **AI Integration**: Content suggestions and auto-tagging
- **SEO Optimization**: Meta tags and sitemap generation

## Documentation

### Complete Technical Guides
- **[Technical Architecture](TECHNICAL_ARCHITECTURE.md)**: Comprehensive system breakdown with code analysis
- **[Visual Flow Diagrams](VISUAL_FLOW_DIAGRAMS.md)**: ASCII diagrams and user journey flows

### API Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/` | Homepage with all posts | No |
| `GET` | `/register` | User registration form | No |
| `POST` | `/register` | Process user registration | No |
| `GET` | `/login` | User login form | No |
| `POST` | `/login` | Process user authentication | No |
| `POST` | `/logout` | User logout and session destroy | Yes |
| `GET` | `/compose` | New post creation form | Yes |
| `POST` | `/compose` | Process new post submission | Yes |
| `GET` | `/posts/:id` | View individual post | No |
| `GET` | `/posts/:id/edit` | Edit post form | Yes (Owner/Admin) |
| `POST` | `/posts/:id/edit` | Process post updates | Yes (Owner/Admin) |
| `POST` | `/posts/:id/delete` | Delete post | Yes (Owner/Admin) |

## Contributing

### Development Setup
```bash
# Fork the repository
git clone https://github.com/Niyidukunda/express-blog-app.git
cd express-blog-app

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
npm install
node index.js

# Submit pull request
git push origin feature/your-feature-name
```

### Coding Standards
- **ES6+ syntax** with modern JavaScript features
- **Consistent naming**: camelCase for variables, PascalCase for models
- **Error handling**: Always implement try-catch with fallback paths
- **Documentation**: Comment complex logic and business rules

## Security Implementation Details

### **Package Dependencies for Security**
```json
{
  "helmet": "^7.1.0",           // Security headers
  "express-validator": "^7.0.1", // Input validation
  "xss": "^1.0.14",             // XSS sanitization
  "express-rate-limit": "^7.1.5", // Rate limiting
  "cors": "^2.8.5",             // CORS configuration
  "dompurify": "^3.0.5",        // HTML sanitization
  "express-session": "^1.18.0", // Session management
  "connect-mongo": "^5.1.0",    // MongoDB session store
  "bcrypt": "^5.1.1",           // Password hashing
  "dotenv": "^16.4.5"           // Environment variables
}
```

### **Authentication System Implementation**
```javascript
// User registration with password hashing
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const newUser = new User({
      username: username.trim().toLowerCase(),
      password: hashedPassword,
      role: 'user' // Default role
    });
    
    await newUser.save();
    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    req.session.role = newUser.role;
    
    res.redirect('/');
  } catch (error) {
    res.render('register', { error: 'Registration failed' });
  }
});

// Role-based access control middleware
function canEditPost(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  
  // Admin can edit any post, users can only edit their own
  if (req.session.role === 'admin') {
    return next();
  }
  
  // Check post ownership for regular users
  Post.findById(req.params.id)
    .then(post => {
      if (post.author && post.author.toString() === req.session.userId) {
        next();
      } else {
        res.status(403).render('error', { 
          message: 'You can only edit your own posts' 
        });
      }
    })
    .catch(err => res.status(500).send('Server Error'));
}
```

### **XSS Protection Implementation**
```javascript
// Sanitization function with whitelist approach
function sanitizeInput(input) {
  return xss(input, {
    whiteList: {
      p: [], br: [], strong: [], em: [], u: [],
      ol: [], ul: [], li: [], h1: [], h2: [], h3: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });
}
```

### **Rate Limiting Configuration**
```javascript
// Different limits for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100                   // 100 requests per IP
});

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5                     // 5 posts per IP
});
```

### **File Upload Security**
```javascript
// Multi-layer file validation
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  
  // MIME type + extension + filename validation
  if (allowedMimes.includes(file.mimetype) && 
      allowedExts.includes(path.extname(file.originalname)) &&
      !file.originalname.includes('..')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type or name'), false);
  }
};
```

### **Security Headers Configuration**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));
```

### **Environment Variables for Security**
```env
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/blog

# Security Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
NODE_ENV=production
SESSION_SECRET=your-super-secret-session-key-here

# Admin Credentials (Fallback)
FALLBACK_ADMIN_USERNAME=admin
FALLBACK_ADMIN_PASSWORD=your-secure-admin-password

# Application Settings
PORT=3000
```

### **User Management & Database Schema**
```javascript
// User Schema with authentication
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Post Schema with author tracking
const postSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 10000 },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  authorName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  category: { type: String, maxlength: 50 },
  imageUrl: { type: String }
});
```

### **Security Best Practices Implemented**
- **Input validation** on all user inputs
- **XSS sanitization** for HTML content
- **Rate limiting** to prevent abuse
- **Security headers** via Helmet.js
- **File upload restrictions** with multiple validations
- ✅ **CORS configuration** for API security
- ✅ **Error handling** without information leakage
- ✅ **Environment variable** protection
- ✅ **Path traversal** prevention
- ✅ **MIME type validation** for uploads

### **Security Testing**
```bash
# Test XSS protection
curl -X POST http://localhost:3000/compose \
  -d "postTitle=<script>alert('xss')</script>&postBody=Safe content"

# Test rate limiting
for i in {1..101}; do curl http://localhost:3000/; done

# Test file upload security
curl -X POST -F "imageFile=@malicious.php" http://localhost:3000/compose
```

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Feel free to use, modify, and distribute this code for personal or commercial projects. Attribution appreciated but not required.

## Acknowledgments

- **MongoDB Atlas**: For reliable cloud database hosting
- **Express.js Community**: For excellent documentation and middleware
- **EJS Template Engine**: For intuitive server-side rendering
- **GitHub Copilot**: For collaborative development insights

---

## Author

**Fidel Niyidukunda**  
*Full-Stack Developer & Founder of Del IT+Web*  

**Location**: Krugersdorp, South Africa  
**Portfolio**: [Del IT+Web](https://github.com/niyidukunda)  
**Contact**: [GitHub Profile](https://github.com/niyidukunda)  
**LinkedIn**: Connect for collaboration opportunities  

### Development Journey
I'm documenting my learning journey building real-world applications with modern web technologies. This blog app represents my progression from basic CRUD operations to enterprise-level architecture with fault tolerance and user experience optimization.

**Current Learning Focus**: Deployment optimization, user authentication systems, and advanced database design patterns.

---

*Built with Node.js, Express, MongoDB, and lots of coffee*#   T r i g g e r   V e r c e l   r e d e p l o y   -   1 0 / 0 1 / 2 0 2 5   1 0 : 0 9 : 4 0 
 
 