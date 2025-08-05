var express = require("express");
var router = express.Router();

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const uniqid = require("uniqid");

const User = require("../models/users");
const Post = require("../models/post");
const { checkBody } = require("../modules/checkBody");

router.post("/createPost", async (req, res) => {
  //   console.log("Bien arriver sur ma route");
  if (!checkBody(req.body, ["result", "date"])) {
    console.log("go");
    res.json({ result: false, error: "Already have data" });
    return;
  }

  if (!req.body.token) {
    console.log("Token manquant");
    res.json({ result: false, error: "Token is required" });
    return;
  }

  if (!req.files.photoUrl) {
    console.log("Image manquante");
    res.json({ result: false, error: "No file uploaded" });
    return;
  }

  const user = await User.findOne({ token: req.body.token });
  if (!user) {
    console.log("Utilisateur introuvable");
    res.json({ result: false, error: "User not found" });
    return;
  }

  const photoPath = `./tmp/${uniqid()}.jpg`;
  const resultMove = await req.files.photoUrl.mv(photoPath);

  if (!resultMove) {
    const resultCloudinary = await cloudinary.uploader.upload(photoPath);
    fs.unlinkSync(photoPath);

    const newPost = new Post({
      photoUrl: resultCloudinary.secure_url,
      ownerPost: user._id,
      date: req.body.date,
      result: req.body.result,
      description: req.body.description || "",
      like: [],
      dislike: [],
      comments: [],
    });

    newPost
      .save()
      .then(() => {
        console.log("Post enregistré");
        res.status(200).json({ result: true, post: newPost });
      })
      .catch((err) => {
        console.log("Erreur enregistrement :", err);
        res.status(500).json({ result: false, error: "Database error" });
      });

    return;
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

module.exports = router;
