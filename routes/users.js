var express = require("express");
var router = express.Router();
const User = require("../models/users");
const Team = require("../models/teams");
const { checkBody } = require("../modules/checkBody");
const uid2 = require("uid2");
const bcrypt = require("bcrypt");

// signUp inscription
router.post("/signup", (req, res) => {
  if (!checkBody(req.body, ["username", "password", "mail"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  User.findOne({ username: req.body.username }).then((data) => {
    if (data === null) {
      const hash = bcrypt.hashSync(req.body.password, 10);

      const newUser = new User({
        username: req.body.username,
        mail: req.body.mail,
        password: hash,
        token: uid2(32),
        avatar: "",
        description: "",
        team: null,
        friendsList: [],
      });

      newUser.save().then((data) => {
        res.json({ result: true, message: data.username + " is created" });
      });
    } else {
      res.json({ result: false, error: "User already exists" });
    }
  });
});

//signin connexion
router.post("/signin", (req, res) => {
  if (!checkBody(req.body, ["username", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  User.findOne({ username: req.body.username }).then((data) => {
    if (data && bcrypt.compareSync(req.body.password, data.password)) {
      User.updateOne({ username: req.body.username }, { token: uid2(32) }).then(
        (uptdateData) => {
          User.findOne({ username: req.body.username })
            .populate("team")
            .then((finalData) => {
              res.json({
                result: true,
                username: finalData.username,
                token: finalData.token,
                friendsList: finalData.friendsList,
                avatar: finalData.avatar,
                description: finalData.description,
                team: finalData.team,
              });
            });
        }
      );
    } else {
      res.json({ result: false, error: "User not found or wrong password" });
    }
  });
});

//suppression compte
router.delete("/", (req, res) => {
  User.deleteOne({ username: req.body.username }).then((data) => {
    console.log(data);
    if (data.deletedCount === 1) {
      res.json({ result: true, message: "account deleted" });
    } else {
      res.json({ result: false, error: "error can not delete account" });
    }
  });
});

//get all users
router.get("/", (req, res) => {
  User.find()
    .populate("team")
    .then((data) => {
      let users = [];
      for (let user of data) {
        users.push({
          username: user.username,
          avatar: user.avatar,
          description: user.description,
          team: user.team,
        });
      }
      res.json({ result: true, users: users });
    });
});

//put modif profile

// router.put("/:username", (req, res) => {
//   User.updateOne({ token: req.body.token }, { username: req.params.username });
// });

module.exports = router;
