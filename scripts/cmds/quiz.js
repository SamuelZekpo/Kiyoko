//SAMUEL ZEKPO  
// ✅ Commande avancée QUIZ avec pause/go/stop/arbitre/réactions/score

const fs = require("fs");
const path = require("path");

// 📁 Fichiers JSON
const dbPath = path.join(__dirname, "../data/quizData.json");
const scorePath = path.join(__dirname, "../data/quizScores.json");
const configPath = path.join(__dirname, "../data/config.json");


const config = JSON.parse(fs.readFileSync(configPath));
const emojiTrigger = config.emojiReaction;
const arbitreUID = config.arbitreUID;

// Créer les fichiers s'ils n'existent pas
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
if (!fs.existsSync(scorePath)) fs.writeFileSync(scorePath, JSON.stringify({}, null, 2));

let quizState = {
  interval: null,
  paused: false,
  index: 0,
  threadID: null,
  questions: []
};

module.exports = {
  config: {
    name: "quiz",
    version: "5.0",
    author: "Samuel Zekpo",
    role: 0,
    shortDescription: "Quiz auto avec scores, réactions, pause et go",
    longDescription: "Lance un quiz avec gestion du score via réactions d’un arbitre, et pause/go",
    category: "quiz"
  },

  onStart: async function ({ api, event, args }) {
    const db = JSON.parse(fs.readFileSync(dbPath));
    const scores = JSON.parse(fs.readFileSync(scorePath));

    const command = (args[0] || "").toLowerCase();
    const threadID = event.threadID;

    // 🛑 Stop
    if (command === "stop") {
      clearInterval(quizState.interval);
      quizState = { interval: null, paused: false, index: 0, threadID: null, questions: [] };
      return api.sendMessage("🛑 Quiz arrêté.", threadID);
    }

    // ⏸️ Pause
    if (command === "pause") {
      quizState.paused = true;
      return api.sendMessage("⏸️ Quiz mis en pause.", threadID);
    }

    // ▶️ Go
    if (command === "go") {
      if (!quizState.questions.length) return api.sendMessage("⚠️ Aucun quiz n’est en cours.", threadID);
      if (!quizState.paused) return api.sendMessage("⚠️ Le quiz n'est pas en pause.", threadID);
      quizState.paused = false;
      return api.sendMessage("▶️ Quiz repris.", threadID);
    }

    // 🔁 Affichage scores
    if (command === "score") {
      const entries = Object.entries(scores);
      if (!entries.length) return api.sendMessage("📭 Aucun score enregistré.", threadID);
      let msg = "📊 Tableau des scores :

";
      for (const [uid, score] of entries) {
        const name = (await api.getUserInfo(uid))[uid]?.name || "Utilisateur";
        msg += `@${name} : ${score} pts
`;
      }
      return api.sendMessage(msg, threadID);
    }

    // ♻️ Reset base
    if (command === "reset") {
      fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
      return api.sendMessage("♻️ Base des questions réinitialisée.", threadID);
    }

    // 💾 Enregistrer question
    if (command === "save") {
      const number = args[1];
      const question = args.slice(2).join(" ");
      db[number] = question;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return api.sendMessage(`✅ Question ${number} enregistrée.`, threadID);
    }

    // 🔍 Afficher question
    if (command === "show") {
      const number = args[1];
      if (!db[number]) return api.sendMessage(`❌ Question ${number} introuvable.`, threadID);
      return api.sendMessage(`📚 Question ${number} :
${db[number]}`, threadID);
    }

    // ▶️ Lancer quiz auto
    const questions = Object.entries(db).sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!questions.length) return api.sendMessage("❌ Aucune question.", threadID);

    quizState = { interval: null, paused: false, index: 0, threadID, questions };

    quizState.interval = setInterval(() => {
      if (quizState.paused) return;
      if (quizState.index >= quizState.questions.length) {
        clearInterval(quizState.interval);
        return;
      }

      const [num, question] = quizState.questions[quizState.index];
      api.sendMessage(`❓ Q${num}:
${question}`, threadID, (err, info) => {
        if (err) return;
        const messageID = info.messageID;

        setTimeout(() => {
          api.sendMessage("⏱️ STOP", threadID);

          // Réactions arbitre
          api.listenMqtt(async (event) => {
            if (
              event.type === "message_reaction" &&
              event.messageID === messageID &&
              event.userID === arbitreUID &&
              event.reaction === emojiTrigger
            ) {
              const targetID = event.reactedUserID;
              if (!targetID) return;
              scores[targetID] = (scores[targetID] || 0) + 10;
              fs.writeFileSync(scorePath, JSON.stringify(scores, null, 2));

              const info = await api.getUserInfo(targetID);
              const name = info[targetID]?.name || "Utilisateur";
              let scoreBoard = `🎉 +10 pour @${name} !

📊 Scores actuels :
`;
              for (const [uid, sc] of Object.entries(scores)) {
                const n = (await api.getUserInfo(uid))[uid]?.name || "Nom";
                scoreBoard += `@${n} : ${sc} pts
`;
              }
              api.sendMessage(scoreBoard, threadID);
            }
          });
        }, 10_000);
      });

      quizState.index++;
    }, 20_000);

    api.sendMessage("▶️ Quiz lancé !", threadID);
  }
};
