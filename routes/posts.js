var express = require("express");
var router = express.Router();
require("../models/connection");

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const uniqid = require("uniqid");
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const User = require("../models/users");
const Post = require("../models/post");
const { checkBody } = require("../modules/checkBody");

router.post("/createPost", async (req, res) => {
  try {
    let prompt =
      'Sandwiches are any food that is contained in itself OR in an bread-like containment. Soups are any food that is completely engulfed in broth/liquid. Everything else is a salad. With that in mind, what is this food. Your reponse must be "soup", "salad" or "sandwich" and nothing else.';
    // Try to make this shorter from here...
    if (!checkBody(req.body, ["date"]))
      return res
        .status(400)
        .json({ result: false, error: "Missing or empty fields" });
    if (!req.files.photoUrl)
      return res.status(400).json({ result: false, error: "No file uploaded" });
    const user = await User.findOne({ token: req.body.token });
    if (!user)
      return res.status(400).json({ result: false, error: "User not found" });
    const photoPath = `./tmp/${uniqid()}.jpg`;
    const resultMove = await req.files.photoUrl.mv(photoPath);
    if (resultMove)
      return res
        .status(500)
        .json({
          result: false,
          error: "File upload error: " + resultMove.message,
        });
    const fileBuffer = fs.readFileSync(photoPath);
    if (!fileBuffer)
      return res
        .status(400)
        .json({ result: false, error: "File buffer is empty" });
    // ...to here

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "IsSalad/posts" },
      async (error, result) => {
        if (error) {
          fs.unlinkSync(photoPath); // Delete temporary file after processing
          return res
            .status(500)
            .json({
              result: false,
              error: "Cloudinary error :" + error.message,
            });
        }
        const imageUrl = result.secure_url;

        try {
          // Call OpenAI Vision
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
          });
          const aiResult = response.choices[0].message.content;

          // create new post in the database
          const newPost = new Post({
            photoUrl: imageUrl,
            ownerPost: user._id,
            date: req.body.date,
            result: aiResult,
            description: req.body.description || "",
            like: [],
            dislike: [],
            comments: [],
          });
          await newPost.save();
          res.status(200).json({ result: true, post: newPost });
        } catch (err) {
          fs.unlinkSync(photoPath); // Delete temporary file after processing
          res
            .status(500)
            .json({ result: false, error: "Database error" + err.message });
        } finally {
          fs.unlinkSync(photoPath); // Delete temporary file after processing
        }
      }
    );
    // Pipe file buffer into Cloudinary upload stream
    uploadStream.end(fileBuffer);
  } catch (err) {
    res
      .status(500)
      .json({
        result: false,
        error: "Error in /createPost route: " + err.message,
      });
  }
});

router.get("/getPosts", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ date: -1 }) // les plus récents en premier
      .populate("ownerPost", "username"); // récuperation du nom d'utilisateur

    res.json({ result: true, posts });
  } catch (error) {
    console.log("Erreur lors de la récupération des posts :", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

router.get("/getPostsByUsername/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Cherche l'utilisateur correspondant au username
    const user = await User.findOne({ username });

    if (!user) {
      return res
        .status(404)
        .json({ result: false, error: "Utilisateur non trouvé" });
    }

    // Récupère les posts de cet utilisateur
    const posts = await Post.find({ ownerPost: user._id })
      .sort({ date: -1 })
      .populate("ownerPost", "username");

    res.json({ result: true, posts });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des posts par username :",
      error
    );
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

router.delete("/deletePost/:postId", async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId });

    if (!post) {
      return res.status(404).json({ result: false, error: "Post not found" });
    }

    await Post.deleteOne({ _id: req.params.postId });

    res.json({ result: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Erreur lors de la suppression :", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;
