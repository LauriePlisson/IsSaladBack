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

  if (!req.files || !req.files.photoUrl) {
    console.log("Image manquante");
    res.json({ result: false, error: "No file uploaded" });
    return;
  }

  const photoPath = `./tmp/${uniqid()}.jpg`;
  const resultMove = await req.files.mv(photoPath);

  if (resultMove) {
    console.log("Erreur pendant l'enregistrement du fichier");
    res.json({ result: false, error: resultMove });
    return;
  }

  const resultCloudinary = await cloudinary.uploader.upload(photoPath);

  fs.unlinkSync(photoPath);

  if (!checkBody(req.body, ["photoUrl", "result", "ownerPost", "date"])) {
    console.log("go");
    res.json({ result: false, error: "Already have data" });
    return;
  }

  console.log("etape 2");

  const newPost = new Post({
    photoUrl: resultCloudinary.secure_url,
    ownerPost: "req.body.ownerPost",
    date: req.body.date,
    result: "req.body.result",
    description: req.body.description || "",
    like: [],
    dislike: [],
    comments: req.body.dislike,
  });

  newPost
    .save()
    .then(() => {
      console.log("Post enregistré");
      res.status(200).json({ result: true, post: data });
    })
    .catch((err) => {
      console.log("Erreur enregistrement :", err);
      res.status(500).json({ result: false, error: "Database error" });
    });
});

module.exports = router;
