from pathlib import Path

# Recréation du fichier après reset
quiz_model = """
const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true
  },
  question: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model("Quiz", quizSchema);
"""

quiz_model_path = "/mnt/data/models/Quiz.js"
Path(quiz_model_path).parent.mkdir(parents=True, exist_ok=True)
Path(quiz_model_path).write_text(quiz_model.strip(), encoding="utf-8")

quiz_model_path
