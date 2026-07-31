const OpenAI = require("openai");

let client = null;

function getClient() {
    if (!client && process.env.OPENROUTER_API_KEY) {
        client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "AI Market Gap Analyzer"
            }
        });
    }

    return client;
}

function buildSystemPrompt() {
    return `
You are a warm, insightful startup coach and helpful assistant for the AI Market Gap Analyzer.

Rules:
1. Answer the user's question directly when it is a general question.
2. If the user is discussing a startup idea, guide the conversation in a natural, mentor-like way to collect:
   - Startup idea
   - Target users
   - Problem
   - Existing solutions
   - Unique feature
   - Revenue model
3. Ask only ONE question at a time.
4. Remember previous answers and build on them naturally.
5. Keep responses short, conversational, and human-sounding.
6. Use an encouraging, coaching tone, like "That sounds promising," "You’re thinking in the right direction," or "Good instinct" when appropriate.
7. Offer practical, thoughtful guidance without being overly formal.
8. When enough startup information is collected, say:
   "I have enough information. Would you like me to analyze the market?"
`;
}

async function generateResponse(messages) {

    const models = [
        "inclusionai/ling-3.0-flash:free",
        "nvidia/nemotron-3-super:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free"
    ];

    let lastError;

    for (const model of models) {

        try {

            console.log("Trying model:", model);

            const activeClient = getClient();

            if (!activeClient) {
                throw new Error("OpenRouter API key is not configured");
            }

            const completion = await activeClient.chat.completions.create({

                model,

                messages: [
                    {
                        role: "system",
                        content: buildSystemPrompt()
                    },

                    ...messages.map(msg => ({
                        role: msg.sender === "user" ? "user" : "assistant",
                        content: msg.text
                    }))
                ]

            });

            if (completion?.choices?.length) {
                return completion.choices[0].message.content;
            }

        } catch (error) {

            console.log(`❌ Model failed: ${model}`);
            console.log(error.error?.message || error.message);

            lastError = error;
        }
    }

    throw lastError;
}

module.exports = {
    generateResponse,
    buildSystemPrompt
};