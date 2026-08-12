const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },

    text: {
        type: String,
        required: true
    },

    hasImage: {
        type: Boolean,
        default: false
    }

}, { _id: false });

const conversationSchema = new mongoose.Schema({

    sessionId: {
        type: String,
        required: true
    },

    messages: [messageSchema]

}, {

    timestamps: true

});

module.exports = mongoose.model(
    "Conversation",
    conversationSchema
);