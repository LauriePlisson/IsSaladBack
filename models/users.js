const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  username: String,
  mail: String,
  password: String,
  token: String,
  avatar: String,
  description: String,
  team: { type: mongoose.Schema.Types.ObjectId, ref: "teams" },
  friendsList: [],
});

const User = mongoose.model("users", userSchema);

module.exports = User;
