var express = require("express");
var router = express.Router();
const User = require("../models/users");
const Team = require("../models/teams");
const { checkBody } = require("../modules/checkBody");

// Route to create a new team with unique name and description
router.post("/", (req, res) => {
  Team.findOne({ name: req.body.name }).then((data) => {
    if (data === null) {
      const newTeam = new Team({
        name: req.body.name,
        icon: "",
        color: "",
        userList: [],
        description: req.body.description,
      });

      newTeam.save().then((data) => {
        res.json({ result: true, message: data });
      });
    } else {
      res.json({ result: false, error: "Team already exists" });
    }
  });
});

// Route to get all available teams
router.get("/", (req, res) => {
  Team.find().then((data) => {
    res.json({ result: true, teams: data });
  });
});

// Route to add user to a team and remove from previous team
router.put("/add", (req, res) => {
  User.findOne({ token: req.body.token })
  .populate("team")
  .then((data) => {
    //verifier si user existe dans une autre team et le supprimer de cette team
    if (data.team) {
      Team.updateOne(
        { name: data.team.name },
        { $pull: { userList: data._id } }
      ).then(() => {
        Team.updateOne(
          { name: req.body.team },
          { $addToSet: { userList: data._id } }
        ).then(() => {
          Team.findOne({ name: req.body.team }).then((teamInfo) => {
            User.updateOne(
              { token: req.body.token },
              { team: teamInfo._id }
            ).then(() => {
              Team.find().then((teamsdata) => {
                res.json({
                  result: true,
                  message: "user added",
                  team: teamsdata,
                });
              });
            });
          });
        });
      });
    }
  });
});

// Route to get specific team information by name
router.get("/:name", (req, res) => {
  Team.findOne({ name: req.params.name }).then((data) => {
    if (data) {
      res.json({
        result: true,
        name: data.name,
        icon: data.icon,
        color: data.color,
        description: data.description,
        userList: data.userList,
        numberOfUsers: data.userList.length,
      });
    } else {
      res.json({ result: false, error: "Team not found" });
    }
  });
});

module.exports = router;
