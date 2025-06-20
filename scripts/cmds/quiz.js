const Quiz = require(process.cwd() + "/models/Quiz.js");
const Score = require(process.cwd() + "/models/Score.js");
const ThreadInfo = require("fbstate-extra").ThreadInfo;

let currentIndex = 0;
let isPaused = false;
let isRunning = false;
let quizInterval = null;
let quizData = [];
let lastMessageID = null;
let ARBITER_UID = "61577150383580";
let POINT_EMOJI = "✅";

module.exports = {
  config: {
    name: "quiz",
    version: "4.0",
    author: "Samuel Zekpo",
    role: 0,
    shortDescription: "Gérer le quiz interactif avec score, réaction et affichage graphique",
    category: "fun",
    guide: "-quiz start | pause | go | stop | reset | show | set <arbitre_uid> <emoji>"
  },

  onStart: async function({ api, event, args }) {
    const { threadID } = event;
    const command = args[0];

    switch (command) {
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
        clearInterval(quizInterval);
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

      case "show": {
        const scores = await Score.find().sort({ points: -1 });
        if (!scores.length) return api.sendMessage("Aucun score trouvé.", threadID);

        const threadInfo = await api.getThreadInfo(threadID);
        const groupName = threadInfo.threadName || "Groupe inconnu";
        const adminIDs = threadInfo.adminIDs.map(admin => admin.id);
        const modo = adminIDs.includes(ARBITER_UID) ? "👑 Arbitre" : "👤 Utilisateur";

        const maxPoints = Math.max(...scores.map(s => s.points));
        const winners = scores.filter(s => s.points === maxPoints);

        let board = "🎯 Résultats du Quiz\n";
        board += `🧵 Groupe : ${groupName}\n`;
        board += `👮 Modo : ${modo}\n\n`;
        scores.forEach((s, i) => {
          const line = winners.find(w => w.uid === s.uid) ? `🏆` : `${i + 1}.`;
          board += `${line} ${s.uid} ➜ ${s.points} pts\n`;
        });
        board += `\n🎉 Gagnant${winners.length > 1 ? 's' : ''} : ${winners.map(w => w.uid).join(", ")}`;

        api.sendMessage(board, threadID);
        break;
      }

      case "set": {
        if (!args[1] || !args[2]) return api.sendMessage("❗ Usage: -quiz set <uid> <emoji>", threadID);
        ARBITER_UID = args[1];
        POINT_EMOJI = args[2];
        api.sendMessage(`✅ Arbitre défini sur ${ARBITER_UID}, emoji de score : ${POINT_EMOJI}`, threadID);
        break;
      }

      default:
        api.sendMessage("Commande inconnue. Utilisez : start | pause | go | stop | reset | show | set", threadID);
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
