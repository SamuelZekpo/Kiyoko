const Quiz = require(process.cwd() + "/models/Quiz.js");
const Score = require(process.cwd() + "/models/Score.js");

let currentIndex = 0;
let isPaused = false;
let isRunning = false;
let quizInterval = null;
let quizData = [];
let lastMessageID = null;
let ARBITER_UID = "61577150383580"; // uid de l'arbitre
let POINT_EMOJI = "✅"; // emoji qui donne les points

module.exports = {
  config: {
    name: "quiz",
    version: "3.1",
    author: "Samuel Zekpo",
    role: 0,
    shortDescription: "Gérer le quiz interactif avec score, réactions et ajout de questions",
    category: "fun",
    guide: "-quiz s <num> <question> | start | pause | go | stop | reset | show | set <uid> <emoji>"
  },

  onStart: async function({ api, event, args }) {
    const { threadID, senderID } = event;
    const command = args[0];

    switch (command) {
      case "s": {
        const number = parseInt(args[1]);
        const question = args.slice(2).join(" ");
        if (!number || !question) return api.sendMessage("❌ Utilisation : -quiz s <num> <question>", threadID);

        await Quiz.findOneAndUpdate(
          { number },
          { question },
          { upsert: true, new: true }
        );

        return api.sendMessage(`✅ Question ${number} enregistrée !`, threadID);
      }

      case "start": {
        if (isRunning) return api.sendMessage("🚫 Quiz déjà en cours.", threadID);
        quizData = await Quiz.find().sort({ number: 1 });
        if (!quizData.length) return api.sendMessage("❌ Aucune question trouvée.", threadID);

        isRunning = true;
        currentIndex = 0;
        sendNextQuestion(api, threadID);
        break;
      }

      case "pause": {
        isPaused = true;
        api.sendMessage("⏸ Quiz mis en pause.", threadID);
        break;
      }

      case "go": {
        if (!isPaused) return api.sendMessage("✅ Quiz déjà actif.", threadID);
        isPaused = false;
        sendNextQuestion(api, threadID);
        break;
      }

      case "stop": {
        clearTimeout(quizInterval);
        isRunning = false;
        isPaused = false;
        currentIndex = 0;
        api.sendMessage("⏹ Quiz arrêté.", threadID);
        break;
      }

      case "reset": {
        await Score.deleteMany({});
        await Quiz.deleteMany({});
        isRunning = false;
        isPaused = false;
        currentIndex = 0;
        api.sendMessage("♻️ Quiz et scores réinitialisés.", threadID);
        break;
      }

      case "set": {
        if (!args[1] || !args[2]) return api.sendMessage("❌ Utilisation : -quiz set <uid> <emoji>", threadID);
        ARBITER_UID = args[1];
        POINT_EMOJI = args[2];
        api.sendMessage(`✅ Arbitre défini sur ${ARBITER_UID}, emoji de score : ${POINT_EMOJI}`, threadID);
        break;
      }

      case "show": {
        const scores = await Score.find().sort({ points: -1 });
        if (!scores.length) return api.sendMessage("Aucun score trouvé.", threadID);

        const topScore = scores[0].points;
        const winners = scores.filter(s => s.points === topScore).map(s => `@${s.uid}`);

        const msg = [
          "🎯 Résultats du Quiz",
          `🧵 Groupe : ${threadID}`,
          `👮 Modo : ${ARBITER_UID}`,
          "",
          ...scores.map((s, i) => `${i + 1}. @${s.uid} ➜ ${s.points} pts`),
          "",
          `🎉 Gagnant${winners.length > 1 ? "s" : ""} : ${winners.join(", ")}`
        ].join("\n");

        api.sendMessage(msg, threadID);
        break;
      }

      default:
        api.sendMessage("Commande inconnue. Utilisez : s | start | pause | go | stop | reset | show | set <uid> <emoji>", threadID);
    }
  },

  onReaction: async function({ api, event }) {
    if (!isRunning || isPaused || event.userID !== ARBITER_UID || event.messageID !== lastMessageID || event.reaction !== POINT_EMOJI)
      return;

    const targetID = event.target?.userID || event.userID;
    let userScore = await Score.findOne({ uid: targetID });
    if (!userScore) userScore = new Score({ uid: targetID, points: 0 });
    userScore.points += 10;
    await userScore.save();

    const scores = await Score.find().sort({ points: -1 });
    const msg = scores.map(s => `• ${s.uid} : ${s.points} pts`).join("\n");
    api.sendMessage(`✅ +10 pour ${targetID}\n\n📊 Classement :\n${msg}`, event.threadID);
  }
};

async function sendNextQuestion(api, threadID) {
  if (isPaused || currentIndex >= quizData.length) return;

  const q = quizData[currentIndex];
  const sent = await api.sendMessage(`❓ Question ${q.number} : ${q.question}`, threadID);
  lastMessageID = sent.messageID;

  setTimeout(() => {
    api.sendMessage("⏱ STOP", threadID);
  }, 10000);

  quizInterval = setTimeout(() => {
    currentIndex++;
    if (!isPaused && currentIndex < quizData.length) {
      sendNextQuestion(api, threadID);
    } else {
      isRunning = false;
      api.sendMessage("✅ Quiz terminé !", threadID);
    }
  }, 20000);
}
