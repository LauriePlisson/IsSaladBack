var express = require("express");
var router = express.Router();
const User = require("../models/users");
const Team = require("../models/teams");
const { checkBody } = require("../modules/checkBody");

//post creer nouvelle team
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

//get pour avoir les teams

router.get("/", (req, res) => {
  Team.find().then((data) => {
    res.json({ teams: data });
  });
});

//put pour update userList AFINIR!!!!!!
router.put("/add", (req, res) => {
  User.findOne({ token: req.body.token }).then((data) => {
    Team.updateOne(
      { name: req.body.team },
      { $addToSet: { userList: [data._id.toString()] } }
    ).then((teamdata) => {
      Team.find().then((teamsdata) => {
        res.json({ result: true, message: "user added", team: teamsdata });
      });
    });
  });
});

module.exports = router;
