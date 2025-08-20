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

// Route to handle user registration with username, email, and password
router.post("/signup", (req, res) => {
  try {
    checkBody(req.body, ["username", "password", "mail"]);

    User.findOne({ username: req.body.username }).then((data) => {
      if (data === null) {
        const hash = bcrypt.hashSync(req.body.password, 10);

        const newUser = new User({
          username: req.body.username,
          mail: req.body.mail,
          password: hash,
          token: uid2(32),
          avatar:
            "https://res.cloudinary.com/dtaynthro/image/upload/v1755091049/ChatGPT_Image_13_aou%CC%82t_2025_14_49_51_usr5rp.png",
          description: "@" + req.body.username,
          team: "689c8e5990b486292b525155", // Default team ID
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
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred during sign-up",
      errorDetails: error.message,
    });
  }
});

// Route to handle user authentication with username and password
router.post("/signin", (req, res) => {
  try {
    checkBody(req.body, ["username", "password"]);

    User.findOne({ username: req.body.username }).then((data) => {
      if (data && bcrypt.compareSync(req.body.password, data.password)) {
        User.updateOne(
          { username: req.body.username },
          { token: uid2(32) }
        ).then((uptdateData) => {
          User.findOne({ username: req.body.username })
            .populate({ path: "team", select: "name" })
            .populate({
              path: "friendsList",
              select: "username avatar team",
              populate: { path: "team", select: "name -_id" },
            })
            .then((finalData) => {
              console.log("User signed in:", finalData.username);
              res.json({
                result: true,
                username: finalData.username,
                token: finalData.token,
                friendsList: finalData.friendsList,
                avatar: finalData.avatar,
                description: finalData.description,
                team: finalData.team.name,
              });
            });
        });
      } else {
        // console.log("User not found or wrong password");
        res.json({ result: false, error: "User not found or wrong password" });
      }
    });
  } catch (error) {
    // console.error("Error during sign-in:", error);
    res.json({
      result: false,
      error: "An error occurred during sign-in",
      errorDetails: error.message,
    });
  }
});

// Route to authenticate user using stored token from previous login
router.post("/signinToken", (req, res) => {
  try {
    checkBody(req.body, ["token"]);

    User.findOne({ token: req.body.token })
      .populate((path = "team"), (select = "name icon"))
      .populate({
        path: "friendsList",
        select: "username avatar team",
        populate: { path: "team", select: "name -_id" },
      })
      .then((data) => {
        if (data) {
          res.json({
            result: true,
            username: data.username,
            token: data.token,
            friendsList: data.friendsList,
            avatar: data.avatar,
            description: data.description,
            team: data.team,
          });
        } else {
          res.json({ result: false, error: "user not found" });
        }
      });
  } catch (error) {
    // console.error("Error during sign-in:", error);
    res.json({
      result: false,
      error: "An error occurred during sign-in",
      errorDetails: error.message,
    });
  }
});

// Route to delete a user account permanently
router.delete("/", (req, res) => {
  try {
    User.deleteOne({ token: req.body.token }).then((data) => {
      console.log(data);
      if (data.deletedCount === 1) {
        console.log("Account deleted successfully");
        res.json({ result: true, message: "account deleted" });
      } else {
        console.log("Error deleting account");
        res.json({ result: false, error: "error can not delete account" });
      }
    });
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred while deleting the account",
      errorDetails: error.message,
    });
    console.error("Error during account deletion:", error);
  }
});

// Route to fetch all users with their basic information and team data
router.get("/", (req, res) => {
  try {
    // console.log("Fetching all users");
    User.find()
      .populate("team", "name") // populate team name
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
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred while fetching users",
      errorDetails: error.message,
    });
  }
});

// Route to update a user's username if the new username is available
router.put("/changeUsername/:username", (req, res) => {
  try {
    checkBody(req.params, ["username"]);
    User.findOne({ username: req.params.username }).then((data) => {
      // console.log(data);
      if (data) {
        res.json({ result: false, error: "username already used" });
      } else {
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
      }
    });
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred while updating the username",
      errorDetails: error.message,
    });
  }
});

// Route to update a user's profile description
router.put("/changeDescription", (req, res) => {
  try {
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
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred while updating the description",
      errorDetails: error.message,
    });
  }
});

// Route to upload and update a user's avatar image via Cloudinary
router.put("/changeAvatar", async (req, res) => {
  try {
    const avatarPath = `./tmp/${uniqid()}.jpg`;
    const resultMove = await req.files.avatar.mv(avatarPath);
    if (!resultMove) {
      const resultCloudinary = await cloudinary.uploader.upload(avatarPath, {
        folder: "IsSalad/avatars",
      });
      // console.log("Cloudinary upload result:", resultCloudinary);
      fs.unlinkSync(avatarPath);

      User.updateOne(
        { token: req.body.token },
        { avatar: resultCloudinary.secure_url }
      ).then((data) => {
        if (data.modifiedCount > 0) {
          User.findOne({ token: req.body.token }).then((userdata) => {
            res.json({ result: true, avatarUrl: userdata.avatar });
          });
        } else {
          res.json({ result: false, error: "no modification" });
        }
      });
    } else {
      res.json({ result: false, error: "File upload failed" });
    }
  } catch (error) {
    // console.error("Error during avatar upload:", error);
    res.json({
      result: false,
      error: "An error occurred while uploading the avatar",
      errorDetails: error.message,
    });
  }
});

// Route to change user password after verifying current password
router.put("/changePassword", (req, res) => {
  try {
    checkBody(req.body, ["newpassword", "password"]);

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
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred while changing the password",
      errorDetails: error.message,
    });
    // console.error("Error during password change:", error);
  }
});

// Route to add or remove a friend from user's friend list
router.put("/addFriend", (req, res) => {
  try {
    User.findOne({ token: req.body.token }).then((data) => {
      if (data) {
        User.findOne({ username: req.body.friendUsername }).then(
          (friendData) => {
            console.log("Friend data:", friendData);
            if (
              !data.friendsList.some(
                (elem) => elem.toString() === friendData._id.toString()
              )
            ) {
              User.updateOne(
                { token: req.body.token },
                { $addToSet: { friendsList: friendData._id } }
              ).then(() => {
                User.findOne({ token: req.body.token })
                  .populate({
                    path: "friendsList",
                    select: "username avatar team",
                    populate: { path: "team", select: "name -_id" },
                  })
                  .then((userData) => {
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
                User.findOne({ token: req.body.token })
                  .populate({
                    path: "friendsList",
                    select: "username avatar team",
                    populate: { path: "team", select: "name -_id" },
                  })
                  .then((userData) => {
                    res.json({
                      result: true,
                      message: "Friend removed",
                      friendList: userData.friendsList,
                    });
                  });
              });
            }
          }
        );
      }
    });
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred while adding/removing a friend",
      errorDetails: error.message,
    });
  }
});

// Route to get a specific user's profile information and posts
router.get("/:username", (req, res) => {
  const queryRegex = new RegExp("^" + req.params.username + "$", "i");

  try {
    User.findOne({ username: queryRegex })
      .populate({
        path: "postsList",
        populate: [
          {
            path: "ownerPost",
            select: "username avatar team -_id",
            populate: { path: "team", select: "name -_id" },
          },
          {
            path: "comments.ownerComment",
            select: "username avatar team -_id",
            populate: { path: "team", select: "name -_id" },
          },
        ],
      })
      .populate({ path: "team", select: "name -_id" })
      .then((data) => {
        if (data) {
          res.json({
            result: true,
            username: data.username,
            avatar: data.avatar,
            description: data.description,
            team: data.team.name,
            friendList: data.friendsList,
            numberOfFriends: data.friendsList.length,
            postsList: data.postsList,
            numberOfPosts: data.postsList.length,
          });
        } else {
          res.json({ result: false, error: "User not found" });
        }
      });
  } catch (error) {
    res.json({
      result: false,
      error: "An error occurred while fetching the user",
      errorDetails: error.message,
    });
  }
});

module.exports = router;
