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
const { recomputeUserTeam } = require("../modules/team");

router.post("/createPost", async (req, res) => {

  try {
    let prompt = `
Look at the image and output EXACTLY ONE of these labels:
"soup", "salad", "sandwich", "ravioli", "ravioli-salad", "other".

Decision rules (in this order):
1) If the image contains humans, with their faces partially or totally visible on first plan:
  - If there are two or more distinct people -> "ravioli-salad".
  - If there is exactly one person -> "ravioli".
2) If the image does NOT primarily depict food or humans (e.g., landscape, desk, computer, empty table, random objects) -> "other".
3) Otherwise classify the food:
  - "soup": food mainly immersed in broth/liquid.
  - "sandwich": food inside or between a bread-like container/wrap.
  - "salad": everything else.

Important:
- Output ONLY one of the allowed labels, with no extra words or punctuation.
`;
// assistant IsSaladBot : asst_ggPvexhvF1xhHtLfBjsJy93f
// Check how to use the assistant: https://platform.openai.com/docs/guides/assistants

    // Try to make this shorter from here...
    if (!checkBody(req.body, ["token"])) {
      console.log("Missing token in request body");

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
    const fileBuffer = fs.readFileSync(photoPath); //createReadableStreamFrom(photoPath);

    if (!fileBuffer) {
      return res
        .status(400)
        .json({ result: false, error: "File buffer is empty" });
    }
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

          //normaliser la réponse IA en 'soup' | 'salad' | 'sandwich' | 'raviolis' | 'ravioli-salad' | 'other'
          let aiResult = (response.choices?.[0]?.message?.content || "")
            .toLowerCase()
            .replace(/\./g, "")
            .trim();
          const allowed = [
            "soup",
            "salad",
            "sandwich",
            "ravioli",
            "ravioli-salad",
            "other",
          ];
          if (!allowed.includes(aiResult)) aiResult = "other";
          console.log("AI result:", aiResult);

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
          // await recomputeUserTeam(user._id);

          try {
            await recomputeUserTeam(user._id);
          } catch (e) {
            console.log("recomputeUserTeam (non bloquant):", e.message);
          }

          fs.unlink(photoPath, () => {});

          res.status(200).json({ result: true, post: newPost });
        } catch (err) {
          fs.unlinkSync(photoPath); // Delete temporary file after processing
          res
            .status(500)
            .json({ result: false, error: "Database error" + err.message });
        }
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
    const userToken = req.headers.authorization?.split(" ")[1] || undefined;
    console.log("User token:", userToken);
    const user = await User.findOne({ token: userToken });

    if (!user) {
      return res.status(401).json({ result: false, error: "Invalid token" });
    }

    // On garde juste les posts de mes amis et de moi-même
    const friendsAndMe = [...user.friendsList, user._id];

    // Récupération des posts de mes amis et de moi-même
    const posts = await Post.find({ ownerPost: { $in: friendsAndMe } })
      .sort({ date: -1 })
      .populate({
        path: "ownerPost",
        select: "username avatar team",
        populate: { path: "team", select: "name -_id" },
      }) // récuperation du nom d'utilisateur, avatar et team du createur du post
      .populate({
        path: "comments",
        select: "ownerComment text date hasLiked",
        populate: {
          path: "ownerComment",
          select: "username avatar team -_id",
          populate: { path: "team", select: "name -_id" },
        },
      }); // récuperation des noms d'utilisateurs, avatars et teams des commentaires;
    posts.forEach((elem) => {
      if (Array.isArray(elem.comments)) {
        elem.comments.sort(
          (first, last) => new Date(first.date) - new Date(last.date)
        );
      }
    });
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
    // }
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
      .populate({
        path: "ownerPost",
        select: "username avatar team",
        populate: { path: "team", select: "name -_id" },
      }) // Récupération du nom d'utilisateur, avatar et team du créateur du post
      .populate({
        path: "comments",
        select: "ownerComment text date hasLiked",
        populate: { path: "ownerComment", select: "name avatar team-_id" }, // Récupération des noms d'utilisateurs, avatars et teams des commentaires
      });

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

    // 1) Trouver le post
    const postToDelete = await Post.findOne({ photoUrl });
    if (!postToDelete) {
      return res.status(404).json({ result: false, error: "Post not found" });
    }

    // 2) Retirer cet ObjectId de toutes les postsList où il apparaît
    await User.updateMany(
      { postsList: postToDelete._id },
      { $pull: { postsList: postToDelete._id } }
    );

    // 3) Supprimer le post
    await Post.deleteOne({ _id: postToDelete._id });

    // 4) Recalcul de team pour l’utilisateur qui a fait la demande (si on le trouve)
    const user = await User.findOne({ token: token });
    if (user) {
      try {
        await recomputeUserTeam(user._id);
      } catch (e) {
        console.log("recomputeUserTeam (non bloquant):", e.message);
      }
    }

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
    // First delete all comments made by the user
    const post = await Post.find();
    const userComments = post.filter((post) =>
      post.comments.some((comment) => comment.ownerComment.equals(user._id))
    );
    if (userComments.length !== 0) {
      for (const post of userComments) {
        await Post.updateOne(
          { _id: post._id },
          { $pull: { comments: { ownerComment: user._id } } }
        );
      }
    }
    // Then delete all posts made by the user
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
      .populate({
        path: "ownerPost",
        select: "username avatar team",
        populate: { path: "team", select: "name -_id" },
      })
      .populate({
        path: "comments",
        select: "ownerComment text date hasLiked",
        populate: {
          path: "ownerComment",
          select: "username avatar team -_id",
          populate: { path: "team", select: "name -_id" },
        },
      }) // Récupération des noms d'utilisateurs, avatars et teams des commentaires
      .lean();

    // tri des commentaires par date décroissante
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
