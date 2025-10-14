import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import Post from "./models/Post.js";
import User from "./models/User.js";
import Comment from "./models/Comment.js";

// Security imports
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import xss from "xss";
import cors from "cors";

// Authentication imports
import session from "express-session";
import MongoStore from "connect-mongo";

// Load environment variables
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 post creations per hour (increased for testing)
  message: 'Too many posts created from this IP, please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: 'Too many file uploads from this IP, please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
app.use(generalLimiter);

// Basic middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", "./views");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/') // Save uploaded files to public/uploads/
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp + original extension
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Enhanced file filter with security checks
const fileFilter = (req, file, cb) => {
  // Allow only specific image types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  // Check MIME type
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed!'), false);
  }
  
  // Check file extension
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExts.includes(ext)) {
    return cb(new Error('Invalid file extension!'), false);
  }
  
  // Additional security: check for suspicious filenames
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return cb(new Error('Invalid filename!'), false);
  }
  
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only 1 file per request
    fields: 10 // Limit number of form fields
  }
});

// MongoDB Atlas connection with graceful fallback and auto-reconnection
let isMongoConnected = false;
let fallbackPosts = []; // Fallback in-memory storage
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 30000; // 30 seconds

// MongoDB connection function with retry logic
async function connectToMongoDB() {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    // Environment check for MongoDB connection
    
    if (!mongoURI) {
      console.log("❌ MONGODB_URI environment variable is not set");
      throw new Error("MONGODB_URI environment variable is not set");
    }
    
    console.log("🔄 Attempting to connect to MongoDB...");
    console.log("🔍 Environment:", process.env.NODE_ENV || 'development');
    // Don't log the full URI for security, just check if it's there
    console.log("🔍 MongoDB URI exists:", mongoURI ? 'Yes' : 'No');
    console.log("🔍 MongoDB URI starts with mongodb+srv:", mongoURI?.startsWith('mongodb+srv://') ? 'Yes' : 'No');
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000, // 30 second timeout for Vercel cold starts
      socketTimeoutMS: 45000, // 45 second socket timeout
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 10, // Connection pool size
      minPoolSize: 1
    });
    console.log("✅ Connected to MongoDB Atlas");
    isMongoConnected = true;
    reconnectAttempts = 0; // Reset counter on successful connection
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    isMongoConnected = false;
    
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectInterval/1000} seconds...`);
      setTimeout(connectToMongoDB, reconnectInterval);
    } else {
      console.log("� Max reconnection attempts reached. Running with in-memory storage.");
      console.log("Note: Data will not persist between server restarts");
      console.log("To fix MongoDB connection, please check:");
      console.log("1. Your IP address is whitelisted in MongoDB Atlas");
      console.log("2. Your network allows connections to MongoDB Atlas");
      console.log("3. Your username and password are correct");
    }
  }
}

// Initial connection attempt
connectToMongoDB();

// Migration function for existing posts without author
async function migrateExistingPosts() {
  if (!isMongoConnected) return;
  
  try {
    // Find posts without author field
    const postsWithoutAuthor = await Post.find({ 
      $or: [
        { author: { $exists: false } },
        { authorName: { $exists: false } }
      ]
    });
    
    if (postsWithoutAuthor.length > 0) {
      console.log(`🔄 Found ${postsWithoutAuthor.length} posts without author information. Migrating...`);
      
      // Find any existing user to assign as author for existing posts
      let existingUser = await User.findOne({ role: 'admin' });
      
      // If no admin, try to find any user
      if (!existingUser) {
        existingUser = await User.findOne();
      }
      
      if (existingUser) {
        // Migrate posts to existing user ownership
        for (const post of postsWithoutAuthor) {
          post.author = existingUser._id;
          post.authorName = existingUser.username;
          await post.save();
        }
        console.log(`✅ Migrated ${postsWithoutAuthor.length} posts to ${existingUser.username}'s ownership`);
      } else {
        // No users exist yet - assign to a placeholder that will be updated when admin signs up
        console.log("📝 No users found. Posts will be assigned to admin when first admin user is created.");
        
        // Create temporary ObjectId for migration (will be updated later)
        const tempAdminId = new mongoose.Types.ObjectId();
        
        for (const post of postsWithoutAuthor) {
          post.author = tempAdminId;
          post.authorName = 'Admin (Pending)';
          await post.save();
        }
        console.log(`✅ Migrated ${postsWithoutAuthor.length} posts with temporary admin assignment`);
      }
    }
  } catch (err) {
    console.error("❌ Error during post migration:", err);
  }
}

// Run migration after MongoDB connection
mongoose.connection.on('connected', () => {
  setTimeout(migrateExistingPosts, 1000); // Wait a second for connection to stabilize
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected. Switching to fallback storage...");
  isMongoConnected = false;
  
  // Attempt to reconnect if we haven't exceeded max attempts
  if (reconnectAttempts < maxReconnectAttempts) {
    setTimeout(connectToMongoDB, reconnectInterval);
  }
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err.message);
  isMongoConnected = false;
});

// Periodic health check to attempt reconnection every 5 minutes
setInterval(async () => {
  if (!isMongoConnected && mongoose.connection.readyState === 0) {
    console.log("🔍 Performing periodic MongoDB connection health check...");
    reconnectAttempts = 0; // Reset attempts for periodic checks
    await connectToMongoDB();
  }
}, 300000); // 5 minutes = 300,000 milliseconds

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevent XSS attacks via document.cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    sameSite: 'lax' // CSRF protection
  }
};

// Add MongoDB session store if available
if (process.env.MONGODB_URI) {
  try {
    sessionConfig.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      touchAfter: 24 * 3600, // lazy session update
      ttl: 7 * 24 * 60 * 60 // 7 days session expiry
    });
    console.log('🗄️ Using MongoDB session store');
  } catch (error) {
    console.warn('⚠️ MongoDB session store failed, using memory store:', error.message);
  }
} else {
  console.log('🗄️ Using memory session store');
}

app.use(session(sessionConfig));

// Authentication middleware - add user to res.locals for templates
app.use((req, res, next) => {
  // Ensure session exists
  if (!req.session) {
    req.session = {};
  }
  
  // Set authentication variables for templates
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  
  next();
});

// Authentication middleware functions
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Access denied. Admin privileges required.');
  }
  next();
};

// Middleware to check if user can edit post (admin or post owner)
const canEditPost = async (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  // Admin can edit any post
  if (req.session.user.role === 'admin') {
    return next();
  }
  
  try {
    // Check if user owns the post
    if (isMongoConnected) {
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).send("Post not found");
      }
      
      // Check if current user is the author
      if (post.author && post.author.toString() === req.session.user.id) {
        return next();
      }
    } else {
      // Check fallback storage
      const post = fallbackPosts.find(p => p._id === req.params.id);
      if (!post) {
        return res.status(404).send("Post not found");
      }
      
      // Check if current user is the author
      if (post.author === req.session.user.id) {
        return next();
      }
    }
    
    // User is not the owner and not admin
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied - Purpose & Perspective</title>
        <link rel="stylesheet" href="/styles/main.css">
      </head>
      <body>
        <div class="auth-container">
          <div class="auth-card">
            <div class="auth-header">
              <h2>🚫 Access Denied</h2>
              <p>You can only edit your own posts</p>
            </div>
            <div style="text-align: center; padding: 1rem;">
              <p>You can:</p>
              <ul style="text-align: left; display: inline-block;">
                <li>Edit your own posts</li>
                <li>Create new posts</li>
                <li>Comment on any post</li>
              </ul>
              <div style="margin-top: 2rem;">
                <a href="/" class="auth-submit-btn" style="text-decoration: none; display: inline-block; padding: 0.75rem 1.5rem;">← Back to Home</a>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Error checking post ownership:", err);
    return res.status(500).send("Error checking post permissions");
  }
};

// Authentication Routes
app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render("login.ejs", { error: null, isMongoConnected });
});

app.post("/login", [
  body('usernameOrEmail').notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("login.ejs", { 
        error: errors.array()[0].msg, 
        isMongoConnected 
      });
    }

    const { usernameOrEmail, password } = req.body;

    if (isMongoConnected) {
      try {
        const user = await User.findByCredentials(usernameOrEmail, password);
        await user.updateLastLogin();
        
        req.session.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        };
        
        res.redirect('/');
      } catch (error) {
        res.render("login.ejs", { 
          error: "Invalid username/email or password", 
          isMongoConnected 
        });
      }
    } else {
      // Fallback authentication for offline mode
      const fallbackUsername = process.env.FALLBACK_ADMIN_USERNAME || 'admin';
      const fallbackPassword = process.env.FALLBACK_ADMIN_PASSWORD || 'admin123';
      
      if (usernameOrEmail === fallbackUsername && password === fallbackPassword) {
        req.session.user = {
          id: 'offline-admin',
          username: fallbackUsername,
          email: 'admin@localhost',
          role: 'admin'
        };
        res.redirect('/');
      } else {
        res.render("login.ejs", { 
          error: `Offline mode: Use ${fallbackUsername}/${fallbackPassword} for demo access`, 
          isMongoConnected 
        });
      }
    }
  } catch (error) {
    console.error("Login error:", error);
    res.render("login.ejs", { 
      error: "An error occurred during login", 
      isMongoConnected 
    });
  }
});

app.get("/signup", (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render("signup.ejs", { error: null, success: null, isMongoConnected });
});

app.post("/signup", [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters long')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
], async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.render("signup.ejs", { 
        error: "Registration is temporarily unavailable. Database is offline.", 
        success: null, 
        isMongoConnected 
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("signup.ejs", { 
        error: errors.array()[0].msg, 
        success: null, 
        isMongoConnected 
      });
    }

    const { username, email, password } = req.body;

    // Create new user
    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: password
    });

    await user.save();

    // Automatically log in the new user
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    console.log(`✅ New user registered and logged in: ${user.username} (${user.email})`);
    res.redirect('/?signup-success=true');

  } catch (error) {
    console.error("Signup error:", error);
    let errorMessage = "An error occurred during registration";
    
    if (error.code === 11000) {
      if (error.keyPattern.username) {
        errorMessage = "Username is already taken";
      } else if (error.keyPattern.email) {
        errorMessage = "Email is already registered";
      }
    } else if (error.errors) {
      errorMessage = Object.values(error.errors)[0].message;
    }

    res.render("signup.ejs", { 
      error: errorMessage, 
      success: null, 
      isMongoConnected 
    });
  }
});

// Add comment to post
app.post("/posts/:id/comment", requireAuth, [
  body('comment').isLength({ min: 1, max: 1000 }).trim().withMessage('Comment must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    if (!isMongoConnected) {
      return res.status(503).json({ error: "Comments are temporarily unavailable. Database is offline." });
    }

    const postId = req.params.id;
    const { comment } = req.body;

    // Check if post exists in MongoDB
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Create new comment
    const newComment = new Comment({
      postId: postId,
      author: {
        username: req.session.user.username,
        userId: new mongoose.Types.ObjectId(req.session.user.id)
      },
      content: xss(comment)
    });

    await newComment.save();
    console.log(`💬 New comment added by ${req.session.user.username} on post ${postId}`);
    
    res.redirect(`/posts/${postId}#comments`);
  } catch (error) {
    console.error('Comment error:', error);
    console.error('Error details:', {
      message: error.message,
      postId: req.params.id,
      userId: req.session.user?.id,
      username: req.session.user?.username,
      comment: req.body.comment
    });
    res.status(500).json({ error: "Error adding comment" });
  }
});

// Get comments for a post
app.get("/posts/:id/comments", async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.json([]);
    }

    const postId = req.params.id;
    const comments = await Comment.find({ postId }).sort({ createdAt: -1 }).limit(100);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: "Error fetching comments" });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.redirect('/');
  });
});

// Promote current user to admin (for blog owner)
app.get("/promote-to-admin", async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.status(503).send("Database unavailable. Admin promotion requires database connection.");
    }

    if (!req.session.user) {
      return res.status(401).send("You must be logged in to access this feature.");
    }

    // Update current user to admin
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    user.role = 'admin';
    await user.save();

    // Update session
    req.session.user.role = 'admin';

    console.log(`🔐 User promoted to admin: ${user.username} (${user.email})`);
    res.redirect('/?promoted-to-admin=true');
  } catch (error) {
    console.error("Admin promotion error:", error);
    res.status(500).send("Error promoting user to admin");
  }
});

// Admin Setup Route (One-time use for blog owner)
app.get("/admin-setup", async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.status(503).send("Database unavailable. Admin setup requires database connection.");
    }

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(403).send("Admin account already exists. This setup is no longer available.");
    }

    // Render admin setup form
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Setup - Purpose & Perspective</title>
        <link rel="stylesheet" href="/styles/main.css">
      </head>
      <body>
        <div class="auth-container">
          <div class="auth-card">
            <div class="auth-header">
              <h1>🔐 Admin Setup</h1>
              <p>Create your admin account for Purpose & Perspective blog</p>
            </div>
            <form action="/admin-setup" method="POST" class="auth-form">
              <div class="form-group">
                <label for="username">Admin Username</label>
                <input type="text" id="username" name="username" required placeholder="Your admin username">
              </div>
              <div class="form-group">
                <label for="email">Admin Email</label>
                <input type="email" id="email" name="email" required placeholder="Your admin email">
              </div>
              <div class="form-group">
                <label for="password">Admin Password</label>
                <input type="password" id="password" name="password" required placeholder="Strong admin password" minlength="6">
              </div>
              <button type="submit" class="auth-submit-btn">Create Admin Account</button>
            </form>
            <p style="text-align: center; margin-top: 20px; color: #dc3545; font-size: 0.9rem;">
              ⚠️ This setup will only work once. After creating the admin account, this page will be disabled.
            </p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Admin setup error:", error);
    res.status(500).send("Error accessing admin setup");
  }
});

app.post("/admin-setup", [
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.status(503).send("Database unavailable. Admin setup requires database connection.");
    }

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(403).send("Admin account already exists. This setup is no longer available.");
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send(`Validation Error: ${errors.array()[0].msg}`);
    }

    const { username, email, password } = req.body;

    // Create admin user
    const adminUser = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      role: 'admin'
    });

    await adminUser.save();

    // Automatically log in the new admin
    req.session.user = {
      id: adminUser._id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role
    };

    console.log(`🔐 Admin account created: ${adminUser.username} (${adminUser.email})`);
    res.redirect('/?admin-created=true');
  } catch (error) {
    console.error("Admin setup error:", error);
    let errorMessage = "Error creating admin account";
    
    if (error.code === 11000) {
      if (error.keyPattern.username) {
        errorMessage = "Username already taken";
      } else if (error.keyPattern.email) {
        errorMessage = "Email already registered";
      }
    }
    
    res.status(500).send(errorMessage);
  }
});

// Routes
app.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    let posts, allCategories = [];
    
    if (isMongoConnected) {
      // Get all available categories for the filter bar
      allCategories = await Post.distinct("category");
      allCategories = allCategories.filter(cat => cat && cat.trim() !== '');
      
      // If category filter is specified, filter by category, otherwise get all posts
      if (category && category !== 'all') {
        posts = await Post.find({ category: category }).sort({ createdAt: -1 }).limit(50);
      } else {
        posts = await Post.find().sort({ createdAt: -1 }).limit(50);
      }
      res.render("index.ejs", { 
        posts, 
        isMongoConnected, 
        currentPage: 'home', 
        selectedCategory: category,
        categories: allCategories 
      });
    } else {
      // Use fallback storage
      let sortedPosts = fallbackPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Get all available categories from fallback storage
      allCategories = [...new Set(fallbackPosts.map(post => post.category).filter(cat => cat && cat.trim() !== ''))];
      
      // Filter by category if specified
      if (category && category !== 'all') {
        sortedPosts = sortedPosts.filter(post => post.category === category);
      }
      
      res.render("index.ejs", { 
        posts: sortedPosts, 
        isMongoConnected, 
        currentPage: 'home', 
        selectedCategory: category,
        categories: allCategories 
      });
    }
  } catch (err) {
    console.error("Error fetching posts:", err);
    // Fallback to in-memory storage on error
    const sortedPosts = fallbackPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const fallbackCategories = [...new Set(fallbackPosts.map(post => post.category).filter(cat => cat && cat.trim() !== ''))];
    res.render("index.ejs", { 
      posts: sortedPosts, 
      isMongoConnected: false, 
      currentPage: 'home', 
      selectedCategory: null,
      categories: fallbackCategories 
    });
  }
});

// Route to get existing categories for auto-suggestions
app.get("/api/categories", async (req, res) => {
  try {
    if (isMongoConnected) {
      const categories = await Post.distinct("category");
      res.json(categories.filter(cat => cat && cat.trim() !== ''));
    } else {
      // Get categories from fallback storage
      const categories = [...new Set(fallbackPosts.map(post => post.category).filter(cat => cat && cat.trim() !== ''))];
      res.json(categories);
    }
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.json(["Daily Reflections"]); // Default fallback
  }
});

app.get("/compose", requireAuth, async (req, res) => {
  try {
    // Get existing categories for suggestions
    let categories = ["Daily Reflections", "Personal Growth"]; // Default categories
    
    if (isMongoConnected) {
      const existingCategories = await Post.distinct("category");
      console.log("📋 Raw categories from DB:", existingCategories);
      const filteredCategories = existingCategories.filter(cat => cat && cat.trim() !== '');
      if (filteredCategories.length > 0) {
        // Add unique categories and ensure "Daily Reflections" is always first
        const uniqueCategories = [...new Set([...categories, ...filteredCategories])];
        categories = uniqueCategories;
      }
      console.log("📋 Filtered categories:", categories);
    } else {
      const existingCategories = [...new Set(fallbackPosts.map(post => post.category).filter(cat => cat && cat.trim() !== ''))];
      if (existingCategories.length > 0) {
        // Add unique categories and ensure "Daily Reflections" is always first
        const uniqueCategories = [...new Set([...categories, ...existingCategories])];
        categories = uniqueCategories;
      }
      console.log("📋 Fallback categories:", categories);
    }
    
    console.log("📋 Final categories being passed to template:", categories);
    res.render("compose.ejs", { isMongoConnected, categories, currentPage: 'compose', selectedCategory: null });
  } catch (err) {
    console.error("Error fetching categories for compose:", err);
    res.render("compose.ejs", { isMongoConnected, categories: ["Daily Reflections"], currentPage: 'compose', selectedCategory: null });
  }
});

// Input validation middleware for compose route
const validatePostInput = [
  body('postTitle')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .trim()
    .escape(),
  body('postBody')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Post content must be between 1 and 10,000 characters')
    .trim(),
  body('category')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Category must be less than 50 characters')
    .trim()
    .escape(),
  body('excerpt')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Excerpt must be less than 200 characters')
    .trim()
    .escape(),
  body('tags')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Tags must be less than 200 characters')
    .trim()
    .escape(),
  body('featuredImageUrl')
    .if(body('imageOption').equals('url'))
    .isURL()
    .withMessage('Featured image must be a valid URL when using URL option')
];

// XSS sanitization function
function sanitizeInput(input) {
  if (!input) return input;
  return xss(input, {
    whiteList: {
      p: [],
      br: [],
      strong: [],
      em: [],
      u: [],
      ol: [],
      ul: [],
      li: [],
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      blockquote: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });
}

app.post("/compose", requireAuth, postLimiter, upload.single('imageFile'), validatePostInput, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render("compose.ejs", { 
      isMongoConnected, 
      categories: ["Daily Reflections"], 
      currentPage: 'compose',
      errors: errors.array()
    });
  }

    const { postTitle, postBody, category, excerpt, tags, featuredImageUrl, imageOption } = req.body;
  
    // Sanitize all text inputs to prevent XSS attacks
    const sanitizedTitle = sanitizeInput(postTitle);
    const sanitizedBody = sanitizeInput(postBody);
    const sanitizedCategory = sanitizeInput(category) || 'Daily Reflections';
    const sanitizedExcerpt = sanitizeInput(excerpt);
    const sanitizedTags = sanitizeInput(tags);
  
    // Determine the image source based on selected option
    let imageSource = null;
    if (imageOption === 'upload' && req.file) {
      imageSource = `/uploads/${req.file.filename}`;
    } else if (imageOption === 'url' && featuredImageUrl && featuredImageUrl.trim() !== '') {
      imageSource = featuredImageUrl.trim();
    } else {
      imageSource = null;
  }
  
  try {
    if (isMongoConnected) {
      const newPost = new Post({ 
        title: sanitizedTitle, 
        body: sanitizedBody,
        category: sanitizedCategory,
        excerpt: sanitizedExcerpt,
        tags: sanitizedTags ? sanitizedTags.split(',').map(tag => tag.trim()) : [],
        featuredImage: imageSource,
        author: req.session.user.id,
        authorName: req.session.user.username
      });
      await newPost.save();
    } else {
      // Use fallback storage
      const id = uuidv4();
      const newPost = { 
        _id: id, 
        title: sanitizedTitle, 
        body: sanitizedBody, 
        category: sanitizedCategory,
        excerpt: sanitizedExcerpt,
        tags: sanitizedTags ? sanitizedTags.split(',').map(tag => tag.trim()) : [],
        featuredImage: imageSource,
        author: req.session.user.id,
        authorName: req.session.user.username,
        createdAt: new Date() 
      };
      fallbackPosts.push(newPost);
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error saving post:", err);
    // Fallback to in-memory storage on error
    const id = uuidv4();
    const wordCount = sanitizedBody.split(' ').length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const autoExcerpt = sanitizedExcerpt || sanitizedBody.substring(0, 150) + '...';
    
    const post = { 
      _id: id, 
      title: sanitizedTitle, 
      body: sanitizedBody,
      category: sanitizedCategory,
      excerpt: autoExcerpt,
      tags: sanitizedTags ? sanitizedTags.split(',').map(tag => tag.trim()) : [],
      featuredImage: imageSource,
      readingTime: readingTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    fallbackPosts.push(post);
    res.redirect("/");
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    if (isMongoConnected) {
      const post = await Post.findById(req.params.id);
      if (post) {
        res.render("posts.ejs", { post, isMongoConnected, selectedCategory: null });
      } else {
        res.status(404).send("Post not found");
      }
    } else {
      // Use fallback storage
      const post = fallbackPosts.find(p => p._id === req.params.id);
      if (post) {
        res.render("posts.ejs", { post, isMongoConnected, selectedCategory: null });
      } else {
        res.status(404).send("Post not found");
      }
    }
  } catch (err) {
    console.error("Error finding post:", err);
    // Fallback to in-memory storage on error
    const post = fallbackPosts.find(p => p._id === req.params.id);
    if (post) {
      res.render("posts.ejs", { post, isMongoConnected: false, selectedCategory: null });
    } else {
      res.status(404).send("Post not found");
    }
  }
});

app.get("/posts/:id/edit", canEditPost, async (req, res) => {
  try {
    let post, categories = ["Daily Reflections", "Personal Growth"];
    
    if (isMongoConnected) {
      post = await Post.findById(req.params.id);
      // Get all available categories
      const existingCategories = await Post.distinct("category");
      const filteredCategories = existingCategories.filter(cat => cat && cat.trim() !== '');
      if (filteredCategories.length > 0) {
        // Add unique categories and ensure "Daily Reflections" is always first
        const uniqueCategories = [...new Set([...categories, ...filteredCategories])];
        categories = uniqueCategories;
      }
      
      if (post) {
        res.render("edit.ejs", { post, isMongoConnected, categories, selectedCategory: null });
      } else {
        res.status(404).send("Post not found");
      }
    } else {
      // Use fallback storage
      post = fallbackPosts.find(p => p._id === req.params.id);
      const existingCategories = [...new Set(fallbackPosts.map(post => post.category).filter(cat => cat && cat.trim() !== ''))];
      if (existingCategories.length > 0) {
        // Add unique categories and ensure "Daily Reflections" is always first
        const uniqueCategories = [...new Set([...categories, ...existingCategories])];
        categories = uniqueCategories;
      }
      
      if (post) {
        res.render("edit.ejs", { post, isMongoConnected, categories, selectedCategory: null });
      } else {
        res.status(404).send("Post not found");
      }
    }
  } catch (err) {
    console.error("Error fetching post for edit:", err);
    // Fallback to in-memory storage on error
    const post = fallbackPosts.find(p => p._id === req.params.id);
    const fallbackCategories = [...new Set(fallbackPosts.map(post => post.category).filter(cat => cat && cat.trim() !== ''))];
    const finalCategories = fallbackCategories.length > 0 ? [...new Set([...categories, ...fallbackCategories])] : categories;
    if (post) {
      res.render("edit.ejs", { post, isMongoConnected: false, categories: finalCategories, selectedCategory: null });
    } else {
      res.status(404).send("Post not found");
    }
  }
});

app.post("/posts/:id/edit", canEditPost, upload.single('imageFile'), async (req, res) => {
  const { title, body, category, featuredImage } = req.body;
  
  // Determine the image source: uploaded file or URL
  let imageSource = null;
  if (req.file) {
    // File was uploaded, use the file path
    imageSource = `/uploads/${req.file.filename}`;
  } else if (featuredImage && featuredImage.trim() !== '') {
    // URL was provided
    imageSource = featuredImage.trim();
  }

  try {
    if (isMongoConnected) {
      const updateData = { title, body };
      if (category) updateData.category = category;
      if (imageSource !== null) updateData.featuredImage = imageSource;
      
      const updatedPost = await Post.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      if (updatedPost) {
        res.redirect(`/posts/${updatedPost._id}`);
      } else {
        res.status(404).send("Post not found");
      }
    } else {
      // Use fallback storage
      const postIndex = fallbackPosts.findIndex(p => p._id === req.params.id);
      if (postIndex !== -1) {
        fallbackPosts[postIndex].title = req.body.title;
        fallbackPosts[postIndex].body = req.body.body;
        res.redirect(`/posts/${fallbackPosts[postIndex]._id}`);
      } else {
        res.status(404).send("Post not found");
      }
    }
  } catch (err) {
    console.error("Error updating post:", err);
    // Fallback to in-memory storage on error
    const postIndex = fallbackPosts.findIndex(p => p._id === req.params.id);
    if (postIndex !== -1) {
      fallbackPosts[postIndex].title = req.body.title;
      fallbackPosts[postIndex].body = req.body.body;
      res.redirect(`/posts/${fallbackPosts[postIndex]._id}`);
    } else {
      res.status(404).send("Post not found");
    }
  }
});

app.post("/posts/:id/delete", canEditPost, async (req, res) => {
  try {
    if (isMongoConnected) {
      const deletedPost = await Post.findByIdAndDelete(req.params.id);
      if (deletedPost) {
        res.redirect("/");
      } else {
        res.status(404).send("Post not found");
      }
    } else {
      // Use fallback storage
      const postIndex = fallbackPosts.findIndex(p => p._id === req.params.id);
      if (postIndex !== -1) {
        fallbackPosts.splice(postIndex, 1);
        res.redirect("/");
      } else {
        res.status(404).send("Post not found");
      }
    }
  } catch (err) {
    console.error("Error deleting post:", err);
    // Fallback to in-memory storage on error
    const postIndex = fallbackPosts.findIndex(p => p._id === req.params.id);
    if (postIndex !== -1) {
      fallbackPosts.splice(postIndex, 1);
      res.redirect("/");
    } else {
      res.status(404).send("Post not found");
    }
  }
});

// Authentication routes
// Login page
app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render("login", { 
    error: null, 
    selectedCategory: null,
    isMongoConnected
  });
});

// Login form submission
app.post("/login", [
  body('usernameOrEmail')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username or email must be between 3 and 50 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("login", { 
        error: errors.array()[0].msg,
        selectedCategory: null,
        isMongoConnected
      });
    }

    const { usernameOrEmail, password } = req.body;
    
    if (isMongoConnected) {
      // Attempt to authenticate with MongoDB
      const user = await User.findByCredentials(usernameOrEmail, password);
      
      // Update last login
      await user.updateLastLogin();
      
      // Store user in session
      req.session.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
      console.log(`✅ User logged in: ${user.username}`);
      res.redirect('/');
    } else {
      // For fallback mode, create a simple admin account
      if ((usernameOrEmail === 'admin' || usernameOrEmail === 'admin@blog.com') && password === 'admin123') {
        req.session.user = {
          _id: 'fallback-admin',
          username: 'admin',
          email: 'admin@blog.com',
          role: 'admin'
        };
        console.log(`✅ Fallback admin logged in`);
        res.redirect('/');
      } else {
        res.render("login", { 
          error: 'Invalid credentials. In offline mode, use admin/admin123',
          selectedCategory: null,
          isMongoConnected
        });
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    res.render("login", { 
      error: 'Invalid credentials. Please try again.',
      selectedCategory: null,
      isMongoConnected
    });
  }
});

// Signup page
app.get("/signup", (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render("signup", { 
    error: null, 
    success: null,
    selectedCategory: null,
    isMongoConnected
  });
});

// Logout
app.post("/logout", (req, res) => {
  const username = req.session.user?.username;
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.redirect('/');
    }
    console.log(`✅ User logged out: ${username || 'unknown'}`);
    res.redirect('/');
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});