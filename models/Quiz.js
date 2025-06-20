from pathlib import Path

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

