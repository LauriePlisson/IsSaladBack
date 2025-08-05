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

    try {
      const savedPost = await newPost.save();

      // Ajoute le postId dans postsList du user
      user.postsList.push(savedPost._id);
      await user.save();

      console.log("Post enregistré et ajouté à postsList");
      res.status(200).json({ result: true, post: savedPost });
    } catch (err) {
      console.log("Erreur enregistrement :", err);
      res.status(500).json({ result: false, error: "Database error" });
    }
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

router.delete("/deletePost", async (req, res) => {
  try {
    const { token, photoUrl } = req.body;

    if (!token || !photoUrl) {
      return res
        .status(400)
        .json({ result: false, error: "Token or photoUrl missing" });
    }

    // Trouver le user et supprimer l'id du post dans postsList
    const postToDelete = await Post.findOne({ photoUrl: req.body.photoUrl });
    const user = await User.findOne({ token: req.body.token });
    if (user) {
      await User.updateOne(
        { token: req.body.token },
        { $pull: { postsList: postToDelete._id } }
      );
      console.log("Post removed from user's postsList");
    }

    // Supprimer le post
    await Post.deleteOne({ photoUrl: req.body.photoUrl });

    res.json({
      result: true,
      message: "Post deleted and removed from postsList",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression :", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

router.put("/updateDescription", async (req, res) => {
  try {
    const { token, photoUrl, description } = req.body;

    if (!token || !photoUrl || !description) {
      return res.status(400).json({ result: false, error: "Missing fields" });
    }

    const updated = await Post.updateOne(
      { photoUrl },
      { $set: { description } }
    );

    if (updated.modifiedCount === 0) {
      return res.status(404).json({ result: false, error: "Post not found" });
    }

    res.json({ result: true, message: "Description updated" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

router.put("/likePost", async (req, res) => {
  try {
    const { token, photoUrl } = req.body;

    if (!token || !photoUrl) {
      return res
        .status(400)
        .json({ result: false, error: "Token or photoUrl missing" });
    }

    // Étape 1 : Trouver l'utilisateur
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(404).json({ result: false, error: "User not found" });
    }

    console.log("User found:", user._id);

    // Étape 2 : Ajouter son _id dans le tableau like (en évitant les doublons)
    const update = await Post.updateOne(
      { photoUrl },
      { $addToSet: { like: user._id } }
    );

    res.json({
      result: true,
      message: "Post liked",
      update,
    });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

router.put("/dislikePost", async (req, res) => {
  try {
    const { token, photoUrl } = req.body;

    if (!token || !photoUrl) {
      return res
        .status(400)
        .json({ result: false, error: "Token or photoUrl missing" });
    }

    // Étape 1 : Trouver l'utilisateur
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(404).json({ result: false, error: "User not found" });
    }

    console.log("User found:", user._id);

    // Étape 2 : Ajouter son _id dans le tableau like (en évitant les doublons)
    const update = await Post.updateOne(
      { photoUrl },
      { $addToSet: { dislike: user._id } }
    );

    res.json({
      result: true,
      message: "Post liked",
      update,
    });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;
