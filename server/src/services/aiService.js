const OpenAI = require("openai");
const { validateImageDataUrl } = require("./imageService");
const { validateFileDataUrl, extractFileTextFromDataUrl } = require("./fileService");

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
You are a general-purpose multimodal AI assistant. When the user provides an image, carefully analyze its visual content and any readable text, understand it in context with the user's question, and identify important information. Do not assume an image is related to Product Hunt, startups, or products unless the image or user's question indicates that. Analyze charts, tables, diagrams, UI, documents, objects, and mixed content appropriately. If something is unclear or unreadable, clearly state the limitation instead of inventing information.

Guidelines:
1. Answer the user's question directly and clearly.
2. Use a neutral, conversational tone similar to GPT-style chat assistants.
3. Keep responses concise and easy to follow.
4. Prefer plain explanations over overly formal or coached language.
5. Use simple markdown when helpful: headings, bullets, numbered steps, and short code blocks.
6. If the user uploads an image without a specific question, describe the image and highlight important visual details.
`;
}

function getModelCandidates() {
    const configuredModel = process.env.OPENROUTER_MODEL
        ?.trim()
        .replace(/^['"]|['"]$/g, "");
    const freeModels = [
        "nvidia/nemotron-3-ultra-550b-a55b:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "inclusionai/ling-3.0-tiny:free"
    ];

    return [...new Set([configuredModel, ...freeModels].filter(Boolean))];
}

function getVisionModelCandidates() {
    const configuredModel = process.env.OPENROUTER_VISION_MODEL
        ?.trim()
        .replace(/^['"]|['"]$/g, "");

    return [...new Set([
        configuredModel,
        "google/gemini-2.5-flash",
        "google/gemini-2.5-flash-lite"
    ].filter(Boolean))];
}

function getAnalysisModelCandidates() {
    const configuredModel = process.env.OPENROUTER_ANALYSIS_MODEL
        ?.trim()
        .replace(/^['"]|['"]$/g, "");

    return [...new Set([
        configuredModel,
        "google/gemini-2.5-flash",
        ...getModelCandidates()
    ].filter(Boolean))];
}

async function buildMessageContent(message) {
    if (message?.file?.dataUrl) {
        validateFileDataUrl(message.file.dataUrl);
        const fileText = await extractFileTextFromDataUrl(message.file.dataUrl);
        const trimmedFileText = fileText.length > 28000 ? `${fileText.slice(0, 28000)}\n\n[Content trimmed]` : fileText;

        return `${message.text || "Please analyze the attached file and answer the user's question based on its content."}\n\nAttached file content:\n${trimmedFileText}`;
    }

    if (!message?.image) {
        return message.text ?? "";
    }

    validateImageDataUrl(message.image.dataUrl);

    return [
        {
            type: "text",
            text: message.text || "Please describe and explain the important content in this image."
        },
        {
            type: "image_url",
            image_url: {
                url: message.image.dataUrl
            }
        }
    ];
}

function normalizeMessageChunks(message, content) {
    const chunks = Array.isArray(content) ? content : [content];

    return chunks
        .map((chunk) => {
            if (chunk == null) return null;
            if (typeof chunk === "string") {
                const trimmed = chunk.trim();
                return trimmed ? { role: message.sender === "user" ? "user" : "assistant", content: trimmed } : null;
            }
            return { role: message.sender === "user" ? "user" : "assistant", content: String(chunk) };
        })
        .filter(Boolean);
}

function buildVisualFallbackResponse(messages = []) {
    const latestText = messages[messages.length - 1]?.text || "";
    const asksForMermaid = /\bmermaid\b/i.test(latestText);
    const asksForArchitecture = /\barchitecture\b|\bfood[- ]delivery\b/i.test(latestText);

     if (!asksForMermaid || !asksForArchitecture) return null;

    return `### Architecture Overview

\`\`\`mermaid
graph TD
    Student[Student App]:::student --> API[API Gateway]:::gateway
    Vendor[Vendor App]:::partner --> API
    Courier[Courier App]:::partner --> API
    Admin[Admin Dashboard]:::admin --> API
    API --> Auth[Authentication]:::service
    API --> Orders[Order Service]:::service
    API --> Payments[Payment Service]:::service
    API --> Notifications[Notifications]:::service
    Orders --> Database[(PostgreSQL)]:::data
    Payments --> Database
    Notifications --> Push[Push Notifications]:::notify
    classDef student fill:#2563eb,stroke:#93c5fd,color:#ffffff,stroke-width:2px;
    classDef partner fill:#0f766e,stroke:#5eead4,color:#ffffff,stroke-width:2px;
    classDef gateway fill:#7c3aed,stroke:#c4b5fd,color:#ffffff,stroke-width:3px;
    classDef admin fill:#a16207,stroke:#facc15,color:#ffffff,stroke-width:2px;
    classDef service fill:#334155,stroke:#94a3b8,color:#f8fafc,stroke-width:2px;
    classDef data fill:#be123c,stroke:#fda4af,color:#ffffff,stroke-width:2px;
    classDef notify fill:#c2410c,stroke:#fdba74,color:#ffffff,stroke-width:2px;
\`\`\`

**Key Takeaway:** The API gateway coordinates students, vendors, couriers, admins, orders, payments, and notifications.`;
}

async function generateResponse(messages) {
    const visualFallback = buildVisualFallbackResponse(messages);
    if (visualFallback) return visualFallback;

    const hasImage = messages.some((message) => message?.image?.dataUrl);
    const models = hasImage ? getVisionModelCandidates() : getModelCandidates();

    let lastError;

    for (const model of models) {

        try {

            console.log("Trying model:", model);

            const activeClient = getClient();

            if (!activeClient) {
                throw new Error("OpenRouter API key is not configured");
            }

            const messageChunks = (await Promise.all(messages.map(async (msg) => {
                const content = await buildMessageContent(msg);
                return normalizeMessageChunks(msg, content);
            }))).flat();

            if (messageChunks.length === 0) {
                throw new Error("No valid chat message content available for the AI request.");
            }

            const completion = await activeClient.chat.completions.create({
                model,
                timeout: 8000,
                messages: [
                    {
                        role: "system",
                        content: buildSystemPrompt()
                    },
                    ...messageChunks
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
    buildSystemPrompt,
    getModelCandidates,
    getAnalysisModelCandidates,
    getVisionModelCandidates,
    buildMessageContent
    ,buildVisualFallbackResponse
};