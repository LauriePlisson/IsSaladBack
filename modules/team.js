// modules/teamUtils.js
const mongoose = require("mongoose");
const Post = require("../models/post");
const Team = require("../models/teams");
const User = require("../models/users");

// Function to count user's posts by classification result (soup, salad, sandwich, etc.)
async function countUserResults(userId) {
  const rows = await Post.aggregate([
    { $match: { ownerPost: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: "$result", total: { $sum: 1 } } },
  ]);

  // base à 0 pour éviter les undefined
  const counts = { soup: 0, salad: 0, sandwich: 0, raviolis: 0 };
  rows.forEach((r) => {
    const key = (r._id || "").toLowerCase();
    if (counts[key] !== undefined) counts[key] = r.total;
  });
  return counts;
}

// Function to determine winning team based on post counts
function pickTeam(counts) {
  // en cas d’égalité, on garde l’ordre soup > salad > sandwich, change si tu veux
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0] && entries[0][1] > 0 ? entries[0][0] : null;
}

// Function to update user's team membership in the teams collection
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

// Main function to recalculate and update user's team based on their post classifications
async function recomputeUserTeam(userId) {
  // 1) Compter les posts de l’utilisateur par résultat
  const counts = await Post.aggregate([
    { $match: { ownerPost: userId } },
    {
      $group: {
        _id: "$result", // 'soup' | 'salad' | 'sandwich' | 'raviolis' | 'ravioli-salad' | 'other'
        total: { $sum: 1 },
      },
    },
  ]);
  console.log("Counts:", counts);
  // 2) Trouver la catégorie dominante (par défaut 'other' si aucun post)
  const scores = { soup: 0, salad: 0, sandwich: 0, raviolis: 0, "ravioli-salad": 0, other: 0 };
  counts.forEach((c) => {
    scores[c._id] = c.total;
  });
  let teamName = '';
  if (scores.soup > scores.salad && scores.soup > scores.sandwich && scores.soup > scores.raviolis && scores.soup > scores["ravioli-salad"] && scores.soup > scores.other)
    teamName = "soup";
  else if (scores.salad > scores.soup && scores.salad > scores.sandwich && scores.salad > scores.raviolis && scores.salad > scores["ravioli-salad"] && scores.salad > scores.other)
    teamName = "salad";
  else if (scores.sandwich > scores.salad && scores.sandwich > scores.soup && scores.sandwich > scores.raviolis && scores.sandwich > scores["ravioli-salad"] && scores.sandwich > scores.other)
    teamName = "sandwich";
  else if (scores.raviolis > scores.salad && scores.raviolis > scores.soup && scores.raviolis > scores.sandwich && scores.raviolis > scores["ravioli-salad"] && scores.raviolis > scores.other)
    teamName = "raviolis";
  else if (scores["ravioli-salad"] > scores.salad && scores["ravioli-salad"] > scores.soup && scores["ravioli-salad"] > scores.sandwich && scores["ravioli-salad"] > scores.raviolis && scores["ravioli-salad"] > scores.other)
    teamName = "ravioli-salad";
  else if (scores.salad === 0 && scores.soup === 0 && scores.sandwich === 0 && scores.raviolis === 0 && scores["ravioli-salad"] === 0)
    teamName = "other"; // si aucun post, on va sur 'other'
  else if ((scores.salad === scores.soup && scores.salad === scores.sandwich && scores.salad === scores.raviolis && scores.salad === scores["ravioli-salad"] && scores.salad === scores.other) || (scores.soup === scores.sandwich && scores.soup === scores.raviolis && scores.soup === scores["ravioli-salad"] && scores.soup === scores.other))
    teamName = "other"; // si égalité totale, on va sur 'other'
  // Si 'other' est le plus grand

  if (scores.other > scores.soup && scores.other > scores.salad && scores.other > scores.sandwich && scores.other > scores.raviolis && scores.other > scores["ravioli-salad"]) {
    teamName = "other";
  } else {
    // Vérifie s'il y a égalité entre deux équipes gagnantes (hors 'other')
    const maxScore = Math.max(scores.soup, scores.salad, scores.sandwich, scores.raviolis, scores["ravioli-salad"]);
    const winners = ["soup", "salad", "sandwich", "raviolis", "ravioli-salad"].filter(k => scores[k] === maxScore && maxScore > 0);
    if (winners.length >= 2) {
      // Deux équipes gagnantes ou plus, pas de changement d'équipe
      return await User.findById(userId).then(user => Team.findById(user.team));
    } else if (winners.length === 1) {
      teamName = winners[0]; // Une seule équipe gagnante
    } else {
      teamName = "other"; // Si aucun score positif
    }
  }
  // 3) Récupérer la team cible
  const teamDoc = await Team.findOne({ name: teamName });
  if (!teamDoc) throw new Error("Team introuvable: " + teamName);

  // 4) Synchroniser les deux côtés
  const userTeam = await User.findById(userId).then(user => Team.findById(user.team));
  if (userTeam && userTeam.name === teamName) {
    // Si l'utilisateur est déjà dans la bonne équipe, rien à faire
    return userTeam;
  }
  // 4a) Retirer l'user de son ancienne team
  await Team.updateOne({ _id: userTeam._id }, { $pull: { userList: userId } });

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
