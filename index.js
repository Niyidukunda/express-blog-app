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

// Load environment variables
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Middleware
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

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
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
      serverSelectionTimeoutMS: 5000, // 5 second timeout
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

// Routes
app.get("/", async (req, res) => {
  try {
    if (isMongoConnected) {
      const posts = await Post.find().sort({ createdAt: -1 });
      res.render("index.ejs", { posts, isMongoConnected, currentPage: 'home' });
    } else {
      // Use fallback storage
      const sortedPosts = fallbackPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.render("index.ejs", { posts: sortedPosts, isMongoConnected, currentPage: 'home' });
    }
  } catch (err) {
    console.error("Error fetching posts:", err);
    // Fallback to in-memory storage on error
    const sortedPosts = fallbackPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.render("index.ejs", { posts: sortedPosts, isMongoConnected: false, currentPage: 'home' });
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

app.get("/compose", async (req, res) => {
  try {
    // Get existing categories for suggestions
    let categories = ["Daily Reflections"]; // Default category
    
    if (isMongoConnected) {
      const existingCategories = await Post.distinct("category");
      categories = existingCategories.filter(cat => cat && cat.trim() !== '') || categories;
    } else {
      const existingCategories = [...new Set(fallbackPosts.map(post => post.category).filter(cat => cat && cat.trim() !== ''))];
      categories = existingCategories.length > 0 ? existingCategories : categories;
    }
    
    res.render("compose.ejs", { isMongoConnected, categories, currentPage: 'compose' });
  } catch (err) {
    console.error("Error fetching categories for compose:", err);
    res.render("compose.ejs", { isMongoConnected, categories: ["Daily Reflections"], currentPage: 'compose' });
  }
});

app.post("/compose", upload.single('imageFile'), async (req, res) => {
  const { postTitle, postBody, category, featuredImage } = req.body;
  
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
      const newPost = new Post({ 
        title: postTitle, 
        body: postBody,
        category: category || 'Daily Reflections',
        featuredImage: imageSource
      });
      await newPost.save();
    } else {
      // Use fallback storage
      const id = uuidv4();
      const newPost = { 
        _id: id, 
        title: postTitle, 
        body: postBody, 
        category: category || 'Daily Reflections',
        featuredImage: imageSource,
        createdAt: new Date() 
      };
      fallbackPosts.push(newPost);
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error saving post:", err);
    // Fallback to in-memory storage on error
    const id = uuidv4();
    const wordCount = postBody.split(' ').length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const autoExcerpt = excerpt || postBody.substring(0, 150) + '...';
    
    const post = { 
      _id: id, 
      title: postTitle, 
      body: postBody,
      category: category || 'daily-reflection',
      featuredImage: featuredImage || null,
      excerpt: autoExcerpt,
      tags: tagArray,
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
        res.render("posts.ejs", { post, isMongoConnected });
      } else {
        res.status(404).send("Post not found");
      }
    } else {
      // Use fallback storage
      const post = fallbackPosts.find(p => p._id === req.params.id);
      if (post) {
        res.render("posts.ejs", { post, isMongoConnected });
      } else {
        res.status(404).send("Post not found");
      }
    }
  } catch (err) {
    console.error("Error finding post:", err);
    // Fallback to in-memory storage on error
    const post = fallbackPosts.find(p => p._id === req.params.id);
    if (post) {
      res.render("posts.ejs", { post, isMongoConnected: false });
    } else {
      res.status(404).send("Post not found");
    }
  }
});

app.get("/posts/:id/edit", async (req, res) => {
  try {
    if (isMongoConnected) {
      const post = await Post.findById(req.params.id);
      if (post) {
        res.render("edit.ejs", { post, isMongoConnected });
      } else {
        res.status(404).send("Post not found");
      }
    } else {
      // Use fallback storage
      const post = fallbackPosts.find(p => p._id === req.params.id);
      if (post) {
        res.render("edit.ejs", { post, isMongoConnected });
      } else {
        res.status(404).send("Post not found");
      }
    }
  } catch (err) {
    console.error("Error fetching post for edit:", err);
    // Fallback to in-memory storage on error
    const post = fallbackPosts.find(p => p._id === req.params.id);
    if (post) {
      res.render("edit.ejs", { post, isMongoConnected: false });
    } else {
      res.status(404).send("Post not found");
    }
  }
});

app.post("/posts/:id/edit", upload.single('imageFile'), async (req, res) => {
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

app.post("/posts/:id/delete", async (req, res) => {
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

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});