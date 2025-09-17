
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import {v4 as uuidv4} from "uuid";
// delete post route


const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;
const posts = [];

app.use(express.static("public"));
//using body-parser to get data from the form
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");  
app.set("views", "./views");

//home route
app.get("/", (req, res) => {
  res.render("index.ejs",{posts:posts});

});   

//creating a compose route for new blog posts
app.get("/compose", (req, res) => {
  res.render("compose.ejs");
});


app.post("/compose", (req, res) => {
  const postTitle = req.body.postTitle;
  const postBody = req.body.postBody;
    //adding unique id to each post 
  const id = uuidv4();
  const post = {title: postTitle, body: postBody, id: id};  
  //pushing the new post to the posts array   


  // for in-memory storage
  posts.push(post); 
    //redirecting to home route after submitting the form   np 
  res.redirect("/");
});    

app.get("/posts/:id", (req, res) => {
  const requestedPostId = req.params.id; 
  const post = posts.find(p => p.id === requestedPostId);
  if (post) {
    res.render("posts.ejs", { post });
  } else {
    res.status(404).send("Post not found");
  } 
});
//edit post route
app.get("/posts/:id/edit", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (post) {
    res.render("edit.ejs", { post });
  } else {
    res.status(404).send("Post not found");
  }
});
//update post route
app.post("/posts/:id/edit", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (post) {
    post.title = req.body.title;
    post.body = req.body.body;
    res.redirect(`/posts/${post.id}`);
  } else {
    res.status(404).send("Post not found");
  }
}); 

app.post("/posts/:id/delete", (req, res) => {
  const postIndex = posts.findIndex(p => p.id === req.params.id);
  if (postIndex !== -1) {
    posts.splice(postIndex, 1);
    res.redirect("/");
  } else {
    res.status(404).send("Post not found");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 