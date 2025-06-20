const mongoose = require("mongoose");
const Quiz = require("../models/Quiz.js");
const Score = require("../models/Score.js");

module.exports = {
  config: {
    name: "dbstatus",
    version: "1.0",
    author: "Samuel Zekpo",
    role: 2, // Admin uniquement
    shortDescription: "État de la base MongoDB",
    longDescription: "Affiche l’état de la connexion MongoDB et les documents stockés dans les collections.",
    category: "admin"
  },

  onStart: async function ({ api, event }) {
    const threadID = event.threadID;

    // 1. État de la connexion Mongo
    const isConnected = mongoose.connection.readyState === 1;
    if (!isConnected) return api.sendMessage("❌ Base de données NON CONNECTÉE.", threadID);

    // 2. Nombre de documents
    const quizCount = await Quiz.countDocuments();
    const scoreCount = await Score.countDocuments();

    let msg = "📊 État de la base MongoDB :\n";
    msg += `• Quiz enregistrés : ${quizCount}\n`;
    msg += `• Joueurs scorés : ${scoreCount}\n`;

    // 3. (Optionnel) Afficher les données elles-mêmes
    // const quizzes = await Quiz.find({});
    // const scores = await Score.find({});
    // msg += `\\n📘 Quiz:\n${quizzes.map(q => q.number + ": " + q.question).join("\\n")}`;
    // msg += `\\n🏅 Scores:\n${scores.map(s => s.uid + ": " + s.points).join("\\n")}`;

    api.sendMessage(msg, threadID);
  }
};
