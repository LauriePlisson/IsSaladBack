const mongoose = require("mongoose");

const commentSchema = mongoose.Schema({
  ownerComment: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  text: String,
  date: Date,
  hasLiked: Number,
});

const postSchema = mongoose.Schema({
  photoUrl: String,
  ownerPost: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  date: Date,
  result: { type: mongoose.Schema.Types.ObjectId, ref: "teams" },
  description: String,
  like: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  dislike: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  comments: [commentSchema],
});

const Post = mongoose.model("posts", postSchema);

module.exports = Post;
