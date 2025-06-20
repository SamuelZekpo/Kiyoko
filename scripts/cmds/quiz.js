const mongoose = require("mongoose");
const Quiz = require("../models/Quiz.js");
const Score = require("../models/Score.js");

let quizState = {
  isRunning: false,
  currentIndex: 0,
  questionList: [],
  paused: false,
  timer: null
};

const arbitreUID = "61577150383580"; // 👈 Mets ton UID arbitre ici
const emojiTrigger = "✅";

module.exports = {
  config: {
    name: "quiz",
    version: "2.0",
    author: "Samuel Zekpo",
    role: 0,
    shortDescription: "Quiz complet : sauvegarde, lancement, score et pause",
    longDescription: "Enregistre, affiche et gère un quiz en plusieurs étapes avec scores et pause/go, avec MongoDB.",
    category: "jeu"
  },

  onStart: async function ({ api, event, args }) {
    const [action, ...rest] = args;
    const threadID = event.threadID;

    if (!action) return api.sendMessage("❌ Utilise : save, show, start, pause, go, reset", threadID);

    if (action === "save") {
      const number = rest.shift();
      const question = rest.join(" ");
      if (!number || !question) return api.sendMessage("❌ Format : -quiz save <numéro> <question>", threadID);
      const existing = await Quiz.findOne({ number });
      if (existing) {
        existing.question = question;
        await existing.save();
      } else {
        await Quiz.create({ number, question });
      }
      return api.sendMessage(`✅ Question ${number} enregistrée.`, threadID);
    }

    if (action === "show") {
      const number = rest[0];
      if (!number) return api.sendMessage("❌ Donne un numéro : -quiz show <numéro>", threadID);
      const found = await Quiz.findOne({ number });
      return api.sendMessage(found ? `📘 Question ${number} : ${found.question}` : "❌ Pas trouvée.", threadID);
    }

    if (action === "reset") {
      await Quiz.deleteMany({});
      await Score.deleteMany({});
      return api.sendMessage("🔄 Quiz et scores réinitialisés.", threadID);
    }

    if (action === "start") {
      if (quizState.isRunning) return api.sendMessage("⚠️ Un quiz est déjà en cours.", threadID);
      quizState.questionList = await Quiz.find({}).sort({ number: 1 });
      if (quizState.questionList.length === 0) return api.sendMessage("📭 Aucune question.", threadID);
      quizState.isRunning = true;
      quizState.currentIndex = 0;
      quizState.paused = false;
      launchNextQuestion(api, threadID);
      return;
    }

    if (action === "pause") {
      quizState.paused = true;
      clearTimeout(quizState.timer);
      return api.sendMessage("⏸️ Quiz en pause.", threadID);
    }

    if (action === "go") {
      if (!quizState.isRunning || !quizState.paused) return api.sendMessage("❌ Aucun quiz en pause.", threadID);
      quizState.paused = false;
      launchNextQuestion(api, threadID);
    }
  }
};

async function launchNextQuestion(api, threadID) {
  if (
    quizState.paused ||
    quizState.currentIndex >= quizState.questionList.length
  ) {
    quizState.isRunning = false;
    return api.sendMessage("✅ Quiz terminé ou interrompu.", threadID);
  }

  const q = quizState.questionList[quizState.currentIndex];
  const message = await api.sendMessage(
    `❓ Question ${q.number} : ${q.question}\n⏱️ 10 secondes pour répondre.`,
    threadID
  );

  const currentMsgID = message.messageID;

  // Stop automatique après 10s
  setTimeout(() => api.sendMessage("✋ STOP ! Temps écoulé.", threadID), 10000);

  // Réaction arbitre = score
  const listenReaction = async (event) => {
    if (
      event.type === "message_reaction" &&
      event.messageID === currentMsgID &&
      event.userID === arbitreUID &&
      event.reaction === emojiTrigger
    ) {
      const targetID = event.reactedUserID;
      if (!targetID) return;
      let player = await Score.findOne({ uid: targetID });
      if (!player) {
        player = new Score({ uid: targetID, points: 10 });
      } else {
        player.points += 10;
      }
      await player.save();

      const all = await Score.find({});
      let result = "🏆 Classement actuel :\n";
      for (const p of all) {
        const info = await api.getUserInfo(p.uid);
        result += `@${info[p.uid]?.name || "??"} : ${p.points} pts\n`;
      }

      return api.sendMessage(result, threadID);
    }
  };

  global.listenEvents.push(listenReaction);

  // Prochaine question après 20s
  quizState.timer = setTimeout(() => {
    quizState.currentIndex++;
    launchNextQuestion(api, threadID);
  }, 20000);
}
