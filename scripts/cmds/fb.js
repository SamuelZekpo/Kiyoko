const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ytdl = require("ytdl-core"); // Pour l’exemple, mais on utilisera une API à la place
const tmp = path.join(__dirname, "fb_temp.mp4");

module.exports = {
  config: {
    name: "fb",
    version: "1.0",
    author: "Samuel Zekpo",
    role: 0,
    shortDescription: "Télécharge une vidéo Facebook",
    longDescription: "Télécharge et envoie une vidéo Facebook via son lien.",
    category: "outil"
  },

  onStart: async function ({ api, event, args }) {
    const link = args[0];
    const threadID = event.threadID;

    if (!link || !link.includes("facebook.com")) {
      return api.sendMessage("❌ Fournis un lien Facebook valide.", threadID);
    }

    try {
      api.sendMessage("⏳ Téléchargement en cours...", threadID);

      const res = await axios.get(`https://api.anisk.dev/fb?url=${encodeURIComponent(link)}`);
      if (!res.data || !res.data.sd) {
        return api.sendMessage("❌ Impossible d’obtenir la vidéo. Lien invalide ou privé.", threadID);
      }

      const videoURL = res.data.hd || res.data.sd;

      const videoStream = (await axios.get(videoURL, { responseType: "stream" })).data;
      const writer = fs.createWriteStream(tmp);
      videoStream.pipe(writer);

      writer.on("finish", () => {
        api.sendMessage({
          body: "📥 Voici ta vidéo Facebook :",
          attachment: fs.createReadStream(tmp)
        }, threadID, () => fs.unlinkSync(tmp));
      });
    } catch (err) {
      console.error("Erreur téléchargement FB:", err);
      api.sendMessage("❌ Une erreur est survenue. Lien incorrect ou vidéo non publique.", threadID);
    }
  }
};
