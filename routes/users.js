var express = require("express");
var router = express.Router();
const User = require("../models/users");
const Team = require("../models/teams");
const { checkBody } = require("../modules/checkBody");
const uid2 = require("uid2");
const bcrypt = require("bcrypt");

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const uniqid = require("uniqid");

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
        description: "@" + req.body.username,
        team: null,
        friendsList: [],
        postsList: [],
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
  User.deleteOne({ token: req.body.token }).then((data) => {
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

//put modif username
router.put("/changeUsername/:username", (req, res) => {
  if (!checkBody(req.params, ["username"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  User.updateOne(
    { token: req.body.token },
    { username: req.params.username }
  ).then((data) => {
    if (data.modifiedCount > 0) {
      User.findOne({ token: req.body.token }).then((userdata) => {
        res.json({ result: true, username: userdata.username });
      });
    } else {
      res.json({ result: false, error: "no modification" });
    }
  });
});

//put modif description
router.put("/changeDescription", (req, res) => {
  User.updateOne(
    { token: req.body.token },
    { description: req.body.description }
  ).then((data) => {
    if (data.modifiedCount > 0) {
      User.findOne({ token: req.body.token }).then((userdata) => {
        res.json({ result: true, data: userdata.description });
      });
    } else {
      res.json({ result: false, error: "no modification" });
    }
  });
});

//put modif avatar
router.put("/changeAvatar", async (req, res) => {
  const avatarPath = `./tmp/${uniqid()}.jpg`;
  const resultMove = await req.files.avatarUrl.mv(avatarPath);

  if (!resultMove) {
    const resultCloudinary = await cloudinary.uploader.upload(avatarPath);
    fs.unlinkSync(avatarPath);

    User.updateOne(
      { token: req.body.token },
      { avatar: resultCloudinary.secure_url }
    ).then((data) => {
      if (data.modifiedCount > 0) {
        User.findOne({ token: req.body.token }).then((userdata) => {
          res.json({ result: true, data: userdata.avatar });
        });
      } else {
        res.json({ result: false, error: "no modification" });
      }
    });
  } else {
    res.json({ result: false, error: "File upload failed" });
  }
});

//modif password

router.put("/changePassword", (req, res) => {
  if (!checkBody(req.body, ["newpassword", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  User.findOne({ token: req.body.token }).then((data) => {
    if (data && bcrypt.compareSync(req.body.password, data.password)) {
      const hash = bcrypt.hashSync(req.body.newpassword, 10);
      User.updateOne({ token: req.body.token }, { password: hash }).then(
        (data) => {
          res.json({ result: true, message: "password Changed" });
        }
      );
    } else {
      res.json({ result: false, error: "error, wrong password" });
    }
  });
});

//faire ajout suppression ami
router.put("/addFriend", (req, res) => {
  // if (!checkBody(req.body, ["token", "friendUsername"])) {
  //   res.json({ result: false, error: "Missing or empty fields" });
  //   return;
  // }

  User.findOne({ token: req.body.token }).then((data) => {
    if (data) {
      User.findOne({ username: req.body.friendUsername }).then((friendData) => {
        if (
          !data.friendsList.some(
            (elem) => elem.toString() === friendData._id.toString()
          )
        ) {
          User.updateOne(
            { token: req.body.token },
            { $addToSet: { friendsList: friendData._id } }
          ).then(() => {
            User.findOne({ token: req.body.token }).then((userData) => {
              res.json({
                result: true,
                message: "Friend added",
                friendList: userData.friendsList,
              });
            });
          });
        } else {
          console.log("Friend already exists or not found");
          User.updateOne(
            { token: req.body.token },
            { $pull: { friendsList: friendData._id } }
          ).then(() => {
            console.log("Friend removed");
            User.findOne({ token: req.body.token }).then((userData) => {
              res.json({
                result: true,
                message: "Friend removed",
                friendList: userData.friendsList,
              });
            });
          });
        }
      });
    }
  });
});

//get one user
router.get("/:username", (req, res) => {
  console.log("Fetching user:", req.params.username);
  User.findOne({ username: req.params.username })
    .populate("team")
    .populate("postsList")
    .then((data) => {
      if (data) {
        res.json({
          result: true,
          username: data.username,
          avatar: data.avatar,
          description: data.description,
          team: data.team,
          friendList: data.friendsList,
          numberOfFriends: data.friendsList.length,
          postsList: data.postsList,
          numberOfPosts: data.postsList.length,
        });
      } else {
        res.json({ result: false, error: "User not found" });
      }
    });
});

module.exports = router;
