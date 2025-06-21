const Quiz = require(process.cwd() + "/models/Quiz.js");
const Score = require(process.cwd() + "/models/Score.js");

let state = {};

module.exports = {
  config: {
    name: "quiz",
    version: "4.1",
    author: "Samuel Zekpo + GPT",
    role: 0,
    shortDescription: "Quiz avancé avec score, pause, réaction et enregistrement de questions",
    category: "fun",
    guide: "-quiz start | pause | go | stop | reset | show | set <uid> <emoji> | s <num> <question>"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, senderID } = event;
    const command = args[0];

    if (!state[threadID]) {
      state[threadID] = {
        currentIndex: 0,
        isPaused: false,
        isRunning: false,
        quizInterval: null,
        quizData: [],
        lastMessageID: null,
        ARBITER_UID: "61577150383580",
        POINT_EMOJI: "✅"
      };
    }

    const s = state[threadID];

    switch (command) {
      case "start": {
        if (s.isRunning) return api.sendMessage("🚫 Quiz déjà en cours.", threadID);
        s.quizData = await Quiz.find().sort({ number: 1 });
        if (!s.quizData.length) return api.sendMessage("❌ Aucune question trouvée.", threadID);

        s.isRunning = true;
        s.currentIndex = 0;
        sendNextQuestion(api, threadID);
        break;
      }

      case "pause": {
        s.isPaused = true;
        api.sendMessage("⏸ Quiz mis en pause.", threadID);
        break;
      }

      case "go": {
        if (!s.isPaused) return api.sendMessage("✅ Quiz déjà actif.", threadID);
        s.isPaused = false;
        sendNextQuestion(api, threadID);
        break;
      }

      case "stop": {
        clearTimeout(s.quizInterval);
        s.isRunning = false;
        s.isPaused = false;
        s.currentIndex = 0;
        api.sendMessage("⏹ Quiz arrêté.", threadID);
        break;
      }

      case "reset": {
        await Score.deleteMany({});
        await Quiz.deleteMany({});
        s.isRunning = false;
        s.isPaused = false;
        s.currentIndex = 0;
        api.sendMessage("♻️ Quiz et scores réinitialisés.", threadID);
        break;
      }

      case "set": {
        if (!args[1] || !args[2]) return api.sendMessage("❌ Utilisation : -quiz set <uid> <emoji>", threadID);
        s.ARBITER_UID = args[1];
        s.POINT_EMOJI = args[2];
        api.sendMessage(`✅ Arbitre : ${s.ARBITER_UID}, emoji : ${s.POINT_EMOJI}`, threadID);
        break;
      }

      case "show": {
        const scores = await Score.find().sort({ points: -1 });
        if (!scores.length) return api.sendMessage("Aucun score trouvé.", threadID);

        const topScore = scores[0].points;
        const winners = scores.filter(s => s.points === topScore).map(s => `@${s.uid}`);

        const msg = [
          "🧾 Résultats du Quiz",
          `🧵 Groupe : ${threadID}`,
          `👮 Arbitre : ${s.ARBITER_UID}`,
          "",
          ...scores.map((s, i) => `${i + 1}. @${s.uid} ➜ ${s.points} pts`),
          "",
          `🏆 Gagnant${winners.length > 1 ? "s" : ""} : ${winners.join(", ")}`
        ].join("\n");

        api.sendMessage(msg, threadID);
        break;
      }

      case "s": {
        if (!args[1] || !args[2]) return api.sendMessage("❌ Utilisation : -quiz s <numéro> <question>", threadID);
        const number = parseInt(args[1]);
        const question = args.slice(2).join(" ");
        if (isNaN(number)) return api.sendMessage("❌ Le numéro de la question doit être un nombre.", threadID);

        let existing = await Quiz.findOne({ number });
        if (existing) {
          existing.question = question;
          await existing.save();
          api.sendMessage(`✅ Question ${number} mise à jour.`, threadID);
        } else {
          await Quiz.create({ number, question });
          api.sendMessage(`✅ Question ${number} enregistrée.`, threadID);
        }
        break;
      }

      default:
        api.sendMessage("Commande inconnue. Utilisez : start | pause | go | stop | reset | show | set <uid> <emoji> | s <num> <question>", threadID);
    }
  },

  onReaction: async function ({ api, event }) {
    const { threadID, userID, reaction, messageID } = event;
    const s = state[threadID];
    if (!s || !s.isRunning || s.isPaused || userID !== s.ARBITER_UID || messageID !== s.lastMessageID || reaction !== s.POINT_EMOJI)
      return;

    const targetID = event.target?.userID || userID;
    let userScore = await Score.findOne({ uid: targetID });
    if (!userScore) userScore = new Score({ uid: targetID, points: 0 });
    userScore.points += 10;
    await userScore.save();

    const scores = await Score.find().sort({ points: -1 });
    const msg = scores.map(s => `• ${s.uid} : ${s.points} pts`).join("\n");
    api.sendMessage(`✅ +10 pour ${targetID}\n\n📊 Classement :\n${msg}`, threadID);
  }
};

async function sendNextQuestion(api, threadID) {
  const s = state[threadID];
  if (!s || s.isPaused || s.currentIndex >= s.quizData.length) return;

  const q = s.quizData[s.currentIndex];
  const sent = await api.sendMessage(`❓ Question ${q.number} : ${q.question}`, threadID);
  s.lastMessageID = sent.messageID;

  setTimeout(() => {
    api.sendMessage("⏱ STOP", threadID);
  }, 10000);

  s.quizInterval = setTimeout(() => {
    s.currentIndex++;
    if (!s.isPaused && s.currentIndex < s.quizData.length) {
      sendNextQuestion(api, threadID);
    } else {
      s.isRunning = false;
      api.sendMessage("✅ Quiz terminé !", threadID);
    }
  }, 20000);
}
