// modules/teamUtils.js
const mongoose = require("mongoose");
const Post = require("../models/post");
const Team = require("../models/teams");
const User = require("../models/users");

// 1) Compte les posts par "result" pour un user
async function countUserResults(userId) {
  const rows = await Post.aggregate([
    { $match: { ownerPost: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: "$result", total: { $sum: 1 } } },
  ]);

  // base à 0 pour éviter les undefined
  const counts = { soup: 0, salad: 0, sandwich: 0 };
  rows.forEach((r) => {
    const key = (r._id || "").toLowerCase();
    if (counts[key] !== undefined) counts[key] = r.total;
  });
  return counts;
}

// 2) Choisit l'équipe gagnante (plus de posts)
function pickTeam(counts) {
  // en cas d’égalité, on garde l’ordre soup > salad > sandwich, change si tu veux
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0] && entries[0][1] > 0 ? entries[0][0] : null;
}

// 3) Met à jour l’appartenance du user dans la collection teams
async function setUserTeam(userId, teamName) {
  // enlève le user de toutes les équipes
  await Team.updateMany({ userList: userId }, { $pull: { userList: userId } });
  if (teamName) {
    // ajoute-le dans la bonne équipe
    await Team.updateOne(
      { name: teamName },
      { $addToSet: { userList: userId } }
    );
  }
}

// 4) Fonction tout-en-un à appeler depuis tes routes
async function recomputeUserTeam(userId) {
  // 1) Compter les posts de l’utilisateur par résultat
  const counts = await Post.aggregate([
    { $match: { ownerPost: userId } },
    {
      $group: {
        _id: "$result", // 'soup' | 'salad' | 'sandwich'
        total: { $sum: 1 },
      },
    },
  ]);

  // 2) Trouver la catégorie dominante (par défaut 'salad' si égalité/aucun post)
  const scores = { soup: 0, salad: 0, sandwich: 0 };
  counts.forEach((c) => {
    scores[c._id] = c.total;
  });
  let teamName = "salad";
  if (scores.soup > scores.salad && scores.soup >= scores.sandwich)
    teamName = "soup";
  else if (scores.sandwich > scores.salad && scores.sandwich >= scores.soup)
    teamName = "sandwich";

  // 3) Récupérer la team cible
  const teamDoc = await Team.findOne({ name: teamName });
  if (!teamDoc) throw new Error("Team introuvable: " + teamName);

  // 4) Synchroniser les deux côtés

  // 4a) Retirer l'user de toutes les teams
  await Team.updateMany({}, { $pull: { userList: userId } });

  // 4b) L’ajouter dans la bonne team
  await Team.updateOne(
    { _id: teamDoc._id },
    { $addToSet: { userList: userId } }
  );

  // 4c) Mettre à jour le champ 'team' du user
  await User.updateOne({ _id: userId }, { team: teamDoc._id });

  return teamDoc; // optionnel
}

module.exports = { recomputeUserTeam, countUserResults, pickTeam, setUserTeam };
