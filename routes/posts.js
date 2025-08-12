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
  console.log("MON IMAGE LA", req.body);

  try {
    let prompt =
      'Sandwiches are any food that is contained in itself OR in an bread-like containment. Soups are any food that is completely engulfed in broth/liquid. Everything else is a salad. With that in mind, what is this food. Your reponse must be "soup", "salad" or "sandwich" and nothing else.';
    // Try to make this shorter from here...
    if (!checkBody(req.body, ["token"])) {
      console.log("Missing date in request body");

      return res
        .status(400)
        .json({ result: false, error: "Missing or empty fields" });
    }
    if (!req.files.photoUrl)
      return res.status(400).json({ result: false, error: "No file uploaded" });

    const user = await User.findOne({ token: req.body.token });

    if (!user)
      return res.status(400).json({ result: false, error: "User not found" });

    const photoPath = `./tmp/${uniqid()}.jpg`;
    const resultMove = await req.files.photoUrl.mv(photoPath);

    if (resultMove)
      return res.status(500).json({
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
          return res.status(500).json({
            result: false,
            error: "Cloudinary error :" + error.message,
          });
        }
        const imageUrl = result.secure_url;
        console.log("Image uploaded to Cloudinary:", imageUrl);

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
            date: new Date(),
            result: aiResult,
            description: req.body.description || "",
            like: [],
            dislike: [],
            comments: [],
          });
          await newPost.save();
          user.postsList.push(newPost._id);
          await user.save();
          res.status(200).json({ result: true, post: newPost });
        } catch (err) {
          fs.unlinkSync(photoPath); // Delete temporary file after processing
          res
            .status(500)
            .json({ result: false, error: "Database error" + err.message });
        }
        // finally {
        //   fs.unlinkSync(photoPath); // Delete temporary file after processing
        // }
      }
    );
    // Pipe file buffer into Cloudinary upload stream
    uploadStream.end(fileBuffer);
  } catch (err) {
    res.status(500).json({
      result: false,
      error: "Error in /createPost route: " + err.message,
    });
  }
});

router.get("/getPosts", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ date: -1 }) // les plus récents en premier
      .populate("ownerPost", { username: 1, avatar: 1 }) // récuperation du nom d'utilisateur
      .populate("comments.ownerComment", "username");

    posts.forEach((elem) => {
      if (Array.isArray(elem.comments)) {
        elem.comments.sort(
          (first, last) => new Date(first.date) - new Date(last.date)
        );
      }
    });
    // check user.token in like/dislike arrays and return boolean and like/dislike count
    const userToken = req.headers.authorization?.split(" ")[1] || null;
    const user = await User.findOne({ token: userToken });
    const postsWithUserInfo = posts.map((post) => {
      const userHasLiked = post.like.includes(user._id.toString());
      const userHasDisliked = post.dislike.includes(user._id.toString());
      return {
        ...post.toObject(),
        userHasLiked,
        userHasDisliked,
        likeCount: post.like.length,
        dislikeCount: post.dislike.length,
      };
    });
    res.json({ result: true, posts: postsWithUserInfo });
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
      .populate("ownerPost", { username: 1, avatar: 1 })
      .populate("comments.ownerComment", { username: 1, avatar: 1 });

    posts.forEach((elem) => {
      if (Array.isArray(elem.comments)) {
        elem.comments.sort(
          (first, last) => new Date(first.date) - new Date(last.date)
        );
      }
    });

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

    const post = await Post.findOne({ photoUrl });

    // Étape 2 : Ajouter son _id dans le tableau like (en évitant les doublons)

    if (post.like.some((e) => e.equals(user._id))) {
      // Si je trouve l'id dans like, je l'enlève
      const removeIdToLikes = await Post.updateOne(
        { photoUrl },
        { $pull: { like: user._id } }
      );
    } else {
      if (post.dislike.some((e) => e.equals(user._id))) {
        const removeIdToDislikes = await Post.updateOne(
          { photoUrl },
          { $pull: { dislike: user._id } }
        );
      }
      const addIdToLikes = await Post.updateOne(
        { photoUrl },
        { $addToSet: { like: user._id } }
      );
    }

    res.json({
      result: true,
      message: "Post liked",
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

    const post = await Post.findOne({ photoUrl });

    // Étape 2 : Ajouter son _id dans le tableau like (en évitant les doublons)
    if (post.dislike.some((e) => e.equals(user._id))) {
      // Si je trouve l'id dans dislike, je l'enlève
      const removeIdToDislikes = await Post.updateOne(
        { photoUrl },
        { $pull: { dislike: user._id } }
      );
    } else {
      if (post.like.some((e) => e.equals(user._id))) {
        const removeIdToLikes = await Post.updateOne(
          { photoUrl },
          { $pull: { like: user._id } }
        );
      }
      const addIdToDislikes = await Post.updateOne(
        { photoUrl },
        { $addToSet: { dislike: user._id } }
      );
    }

    res.json({
      result: true,
      message: "Post disliked",
    });
  } catch (error) {
    console.error("Dislike error:", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

router.delete("/deleteAllFromOne", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ result: false, error: "Token missing" });
    }

    const user = await User.findOne({ token });

    await Post.deleteMany({ ownerPost: user._id });

    res.json({
      result: true,
      message: "Posts deleted",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression :", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

// router.post("/addComment", async (req, res) => {
//   try {
//     const { token, postId, text } = req.body;
//     if (!token || !postId || !text) {
//       return res.status(400).json({ result: false, error: "Missing fields" });
//     }

//     const user = await User.findOne({ token });
//     if (!user)
//       return res.status(404).json({ result: false, error: "User not found" });

//     const comment = { ownerComment: user._id, text, date: new Date() };

//     // push le commentaire et renvoyer le post mis à jour (avec populate)
//     const updatedPost = await Post.findByIdAndUpdate(
//       postId,
//       { $push: { comments: comment } },
//       { new: true }
//     )
//       .populate("ownerPost", {"username": 1, "avatar": 1, "team": 1})
//       .populate("comments.ownerComment", {"username": 1, "avatar": 1, "team": 1})
//       .lean();

//     // tri des comments (au cas où)
//     if (Array.isArray(updatedPost?.comments)) {
//       updatedPost.comments.sort((a, b) => new Date(b.date) - new Date(a.date));
//     }

//     res.json({ result: true, post: updatedPost });
//   } catch (error) {
//     console.error("Erreur addComment :", error);
//     res.status(500).json({ result: false, error: "Internal server error" });
//   }
// });

router.post("/addComment", async (req, res) => {
  try {
    const { token, postId, text } = req.body;
    if (!token || !postId || !text) {
      return res.status(400).json({ result: false, error: "Missing fields" });
    }

    const user = await User.findOne({ token });
    if (!user)
      return res.status(404).json({ result: false, error: "User not found" });

    const comment = { ownerComment: user._id, text, date: new Date() };

    // push le commentaire et renvoyer le post mis à jour (avec populate)
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $push: { comments: comment } },
      { new: true }
    )
      .populate("ownerPost", { username: 1, avatar: 1, team: 1 })
      .populate("comments.ownerComment", { username: 1, avatar: 1, team: 1 })
      .lean();

    // tri des comments (au cas où)
    if (Array.isArray(updatedPost?.comments)) {
      updatedPost.comments.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    res.json({ result: true, post: updatedPost });
  } catch (error) {
    console.error("Erreur addComment :", error);
    res.status(500).json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;
