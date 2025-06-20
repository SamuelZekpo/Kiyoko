const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true
  },
  points: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model("Score", scoreSchema);
