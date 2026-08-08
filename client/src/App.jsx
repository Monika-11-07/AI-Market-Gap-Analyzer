import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { FiSend, FiMessageCircle, FiBarChart2 } from "react-icons/fi";
import { sendMessage } from "./services/api";
import { analyzeMarket } from "./services/api";

function MessageContent({ text, isBot }) {
    if (!isBot) return text;

    const lines = text.split("\n");
    const content = [];
    let listItems = [];

    const flushList = () => {
        if (!listItems.length) return;

        content.push(
            <ol key={`list-${content.length}`} className="list-decimal space-y-2 pl-5">
                {listItems}
            </ol>
        );
        listItems = [];
    };

    lines.forEach((line, index) => {
        const item = line.match(/^\s*\d+\.\s+\*\*(.+?)\*\*\s+[–-]\s+(.+)$/);

        if (item) {
            listItems.push(
                <li key={`item-${index}`}>
                    <strong>{item[1]}</strong> {item[2]}
                </li>
            );
            return;
        }

        flushList();
        if (line.trim()) {
            content.push(
                <p key={`paragraph-${index}`} className="mb-3 last:mb-0">
                    {line}
                </p>
            );
        }
    });

    flushList();
    return content;
}

function App() {

    const [sessionId] = useState(uuidv4());

    const [message, setMessage] = useState("");
const [analysis, setAnalysis] = useState(null);
    const [messages, setMessages] = useState([
        {
            sender: "bot",
            text: "Hi! 👋 I'm your AI Market Gap Analyzer. What startup idea are you planning to build?"
        }
    ]);

    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleSend = async () => {

        if (!message.trim() || isLoading) return;

        const userMessage = message.trim();

        const updatedMessages = [
            ...messages,
            {
                sender: "user",
                text: userMessage
            }
        ];

        setMessages(updatedMessages);
        setMessage("");
        setIsLoading(true);

        try {

            const response = await sendMessage(
                sessionId,
                updatedMessages
            );

            setMessages([
                ...updatedMessages,
                {
                    sender: "bot",
                    text: response.data.reply
                }
            ]);

        } catch (error) {

            console.error(error);

            setMessages([
                ...updatedMessages,
                {
                    sender: "bot",
                    text: "Sorry, something went wrong."
                }
            ]);

        } finally {

            setIsLoading(false);

        }

    };

    const handleKeyDown = (e) => {

        if (e.key === "Enter") {

            handleSend();

        }

    };

    const handleAnalyze = async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    try {

        const response = await analyzeMarket(messages);
        const report = response?.data ?? {};

        setAnalysis({
            opportunityScore: report.opportunityScore ?? 0,
            verdict: report.verdict ?? "No verdict available.",
            competitors: Array.isArray(report.competitors) ? report.competitors : [],
            marketGaps: Array.isArray(report.marketGaps) ? report.marketGaps : [],
            swot: report.swot && typeof report.swot === "object" ? report.swot : {},
            roadmap: Array.isArray(report.roadmap) ? report.roadmap : []
        });

    } catch (error) {

        console.error("Analyze Error:", error);

        setAnalysis({
            opportunityScore: 0,
            verdict: "Unable to analyze right now. Please try again.",
            competitors: [],
            marketGaps: [],
            swot: {},
            roadmap: []
        });

    } finally {
        setIsAnalyzing(false);
    }

};
    return (
        <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-950 text-white">
            <header className="flex-none border-b border-slate-800 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <FiMessageCircle className="text-indigo-400" size={26} />
                    <div>
                        <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                            AI Market Gap Analyzer
                        </h1>
                        <p className="text-xs text-slate-400 sm:text-sm">
                            Startup Research Assistant
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex min-h-0 flex-1 flex-col md:flex-row">
                <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-slate-800 md:border-b-0 md:border-r">
                    <div className="flex-none border-b border-slate-800 px-4 py-3 sm:px-6">
                        <h2 className="font-semibold text-slate-100">Chat Assistant</h2>
                        <p className="mt-1 text-xs text-slate-500">Explore and refine your startup idea</p>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[78%] ${
                                        msg.sender === "user"
                                            ? "rounded-br-md bg-indigo-600 text-white"
                                            : "rounded-bl-md border border-slate-700 bg-slate-800/90 text-slate-200"
                                    }`}
                                >
                                    <MessageContent text={msg.text} isBot={msg.sender === "bot"} />
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="text-sm text-slate-400">AI is thinking...</div>
                        )}
                    </div>

                    <div className="flex-none border-t border-slate-800 bg-slate-950/95 p-3 sm:p-4">
                        <div className="flex gap-2 sm:gap-3">
                            <input
                                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="Describe your startup idea..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                onClick={handleSend}
                                aria-label="Send message"
                                className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-indigo-600 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isLoading}
                            >
                                <FiSend size={18} />
                            </button>
                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="h-12 flex-none rounded-xl bg-emerald-600 px-3 text-sm font-semibold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                            >
                                {isAnalyzing ? "Analyzing..." : "Analyze"}
                            </button>
                        </div>
                    </div>
                </section>

                <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex-none border-b border-slate-800 px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-3">
                            <FiBarChart2 className="text-emerald-400" />
                            <div>
                                <h2 className="font-semibold text-slate-100">Market Insights</h2>
                                <p className="mt-1 text-xs text-slate-500">Your generated opportunity report</p>
                            </div>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                        <div className="space-y-5 pb-6">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Opportunity Score</p>
                                <div className="mt-2 flex items-end gap-2">
                                    <h2 className="text-5xl font-bold tracking-tight text-emerald-400">
                                        {analysis?.opportunityScore ?? "--"}
                                    </h2>
                                    <span className="pb-1 text-sm text-slate-500">/ 100</span>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                <p className="mb-2 text-sm font-semibold text-slate-300">Verdict</p>
                                <p className="leading-7 text-slate-200">{analysis?.verdict || "Waiting for analysis..."}</p>
                            </div>

                            <div className="grid gap-5 xl:grid-cols-2">
                                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                    <p className="mb-3 text-sm font-semibold text-slate-300">Competitors</p>
                                    <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                                        {analysis?.competitors?.length ? analysis.competitors.map((item, index) => (
                                            <li key={index}>{item}</li>
                                        )) : <li>No competitors yet</li>}
                                    </ul>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                    <p className="mb-3 text-sm font-semibold text-slate-300">Market Gaps</p>
                                    <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                                        {analysis?.marketGaps?.length ? analysis.marketGaps.map((item, index) => (
                                            <li key={index}>{item}</li>
                                        )) : <li>No market gaps yet</li>}
                                    </ul>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                <p className="mb-4 text-sm font-semibold text-slate-300">SWOT</p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {Object.entries(analysis?.swot || {}).map(([key, items]) => (
                                        <div key={key} className="rounded-xl bg-slate-950/60 p-3">
                                            <p className="mb-2 capitalize font-medium text-slate-100">{key}</p>
                                            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-400">
                                                {Array.isArray(items) && items.length ? items.map((item, index) => (
                                                    <li key={`${key}-${index}`}>{item}</li>
                                                )) : <li>No data</li>}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                <p className="mb-3 text-sm font-semibold text-slate-300">Roadmap</p>
                                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                                    {analysis?.roadmap?.length ? analysis.roadmap.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    )) : <li>No roadmap yet</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );

}

export default App;