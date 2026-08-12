const { generateResponse } = require("../services/aiService");
const Conversation = require("../models/Conversation");
const { validateImageDataUrl } = require("../services/imageService");
const { validateFileDataUrl } = require("../services/fileService");

const chat = async (req, res) => {
    try {
        const { sessionId, messages } = req.body;

        // Validate request
        if (!sessionId) {
            return res.status(400).json({
                error: "Session ID is required"
            });
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "Messages are required"
            });
        }

        try {
            for (const message of messages) {
                if (message?.image?.dataUrl) {
                    validateImageDataUrl(message.image.dataUrl);
                }
                if (message?.file?.dataUrl) {
                    validateFileDataUrl(message.file.dataUrl);
                }
            }
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        // Generate AI response
        const reply = await generateResponse(messages);

        // Add AI response to conversation
        const updatedMessages = [
            ...messages.map(({ sender, text, image }) => ({
                sender,
                text: text || (image ? "[Image attachment]" : ""),
                ...(image ? { hasImage: true } : {})
            })),
            {
                sender: "bot",
                text: reply
            }
        ];

        // Save conversation in MongoDB
        await Conversation.findOneAndUpdate(
            { sessionId },
            {
                sessionId,
                messages: updatedMessages
            },
            {
                upsert: true,
                returnDocument: "after"
            }
        );

        // Send response to frontend
        res.json({
            reply
        });

    } catch (error) {
        console.error("Chat Controller Error:", error);

        res.status(500).json({
            error: error.message || "Internal Server Error"
        });
    }
};

module.exports = {
    chat
};