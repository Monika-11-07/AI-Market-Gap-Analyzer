const OpenAI = require("openai");
const { searchProducts } = require("./productHuntService");

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

function buildFallbackReport(messages = []) {
    const text = (messages || [])
        .map((msg) => `${msg.sender}: ${msg.text}`)
        .join("\n")
        .toLowerCase();

    const hasAi = text.includes("ai") || text.includes("artificial intelligence");
    const hasSaaS = text.includes("saas") || text.includes("software");
    const hasLocal = text.includes("local") || text.includes("small business");
    const hasAutomation = text.includes("automate") || text.includes("automation");

    let opportunityScore = 62;

    if (hasAi) opportunityScore += 8;
    if (hasSaaS) opportunityScore += 5;
    if (hasLocal) opportunityScore += 4;
    if (hasAutomation) opportunityScore += 6;

    opportunityScore = Math.min(95, Math.max(45, opportunityScore));

    const competitors = [
        "Established vertical SaaS platforms",
        "General-purpose productivity tools",
        "Manual spreadsheet or CRM workflows"
    ];

    const marketGaps = [
        "Clear niche positioning for the target customer",
        "A stronger onboarding experience for non-technical users",
        "A more compelling workflow automation story"
    ];

    const verdict = opportunityScore >= 75
        ? "Strong opportunity with a clear niche and room for differentiation."
        : "Promising idea, but the market needs sharper positioning and a stronger value story.";

    return {
        opportunityScore,
        verdict,
        competitors,
        marketGaps,
        swot: {
            strengths: ["Problem-driven positioning", "Clear AI angle", "Good fit for workflow automation"],
            weaknesses: ["Needs stronger differentiation", "Requires early user validation"],
            opportunities: ["Rising AI adoption", "Under-served niche segments"],
            threats: ["Fast-moving competitors", "Potential pricing pressure"]
        },
        roadmap: [
            "Validate the problem with 5-10 target users",
            "Build a simple MVP around one core workflow",
            "Measure retention and upgrade willingness before scaling"
        ]
    };
}

function mergeProductInsights(report, productData) {
    const edges = productData?.data?.posts?.edges || [];
    const products = edges
        .map((edge) => edge?.node?.name)
        .filter(Boolean);

    const mergedCompetitors = Array.from(new Set([...(report.competitors || []), ...products]));
    const mergedGaps = Array.from(new Set([
        ...(report.marketGaps || []),
        "Opportunity to differentiate with deeper restaurant-specific workflows"
    ]));

    return {
        ...report,
        competitors: mergedCompetitors,
        marketGaps: mergedGaps
    };
}

async function analyzeIdea(messages) {
    const fallbackReport = buildFallbackReport(messages);

    if (!process.env.OPENROUTER_API_KEY) {
        try {
            const productData = await searchProducts("AI");
            return mergeProductInsights(fallbackReport, productData);
        } catch (error) {
            return fallbackReport;
        }
    }

    try {
        const activeClient = getClient();

        if (!activeClient) {
            return fallbackReport;
        }

        const completion = await activeClient.chat.completions.create({
            model: process.env.OPENROUTER_MODEL || "inclusionai/ling-3.0-flash:free",
            messages: [
                {
                    role: "system",
                    content: "You are a startup market analyst. Return a compact JSON object with opportunityScore (number), verdict (string), competitors (array of strings), marketGaps (array of strings), swot (object with strengths, weaknesses, opportunities, threats arrays), and roadmap (array of strings)."
                },
                {
                    role: "user",
                    content: `Analyze this startup conversation and return only valid JSON.\n${(messages || []).map((msg) => `${msg.sender}: ${msg.text}`).join("\n")}`
                }
            ]
        });

        const content = completion?.choices?.[0]?.message?.content || "{}";
        const cleaned = content.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        const enriched = mergeProductInsights({
            ...fallbackReport,
            ...parsed,
            opportunityScore: Number(parsed.opportunityScore ?? fallbackReport.opportunityScore),
            competitors: Array.isArray(parsed.competitors) ? parsed.competitors : fallbackReport.competitors,
            marketGaps: Array.isArray(parsed.marketGaps) ? parsed.marketGaps : fallbackReport.marketGaps,
            swot: parsed.swot && typeof parsed.swot === "object" ? parsed.swot : fallbackReport.swot,
            roadmap: Array.isArray(parsed.roadmap) ? parsed.roadmap : fallbackReport.roadmap
        }, await searchProducts("AI"));

        return enriched;
    } catch (error) {
        console.warn("AI analysis fallback triggered:", error.message);
        return fallbackReport;
    }
}

module.exports = {
    analyzeIdea,
    mergeProductInsights
};