const mongoose = require("mongoose");

const teamSchema = mongoose.Schema({
  name: String,
  icon: String,
  color: String,
  userList: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  description: String,
});

const Team = mongoose.model("teams", teamSchema);

module.exports = Team;
