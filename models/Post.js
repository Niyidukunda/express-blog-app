import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 200
  },
  body: { 
    type: String, 
    required: true,
    maxlength: 10000
  },
  category: { 
    type: String, 
    required: true,
    trim: true,
    default: 'Daily Reflections',
    maxlength: 50
  },
  excerpt: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  featuredImage: { 
    type: String, // URL to the image
    default: null,
    trim: true
  },
  readingTime: { 
    type: Number, // Estimated reading time in minutes
    default: 1 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-calculate reading time (average 200 words per minute)
  const wordCount = this.body.split(' ').length;
  this.readingTime = Math.max(1, Math.ceil(wordCount / 200));
  
  // Auto-generate excerpt if not provided
  if (!this.excerpt) {
    this.excerpt = this.body.substring(0, 150) + '...';
  }
  
  next();
});

const Post = mongoose.model("Post", postSchema);

export default Post;