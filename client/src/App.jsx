import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { FiSend, FiMessageCircle, FiBarChart2, FiPaperclip, FiX } from "react-icons/fi";
import mermaid from "mermaid";
import { sendMessage } from "./services/api";
import { analyzeMarket } from "./services/api";

mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
        background: "#0b1220",
        primaryColor: "#2563eb",
        primaryTextColor: "#f8fafc",
        primaryBorderColor: "#60a5fa",
        lineColor: "#94a3b8",
        secondaryColor: "#0f766e",
        tertiaryColor: "#a16207",
        fontFamily: "ui-sans-serif, system-ui, sans-serif"
    }
});

function MermaidDiagram({ chart, diagramId }) {
    const [svg, setSvg] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;

        mermaid.render(diagramId, chart)
            .then(({ svg: renderedSvg }) => {
                if (active) setSvg(renderedSvg);
            })
            .catch(() => {
                if (active) setError(true);
            });

        return () => {
            active = false;
        };
    }, [chart, diagramId]);

    if (error) {
        return <pre className="my-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-400">{chart}</pre>;
    }

    if (!svg) return <p className="my-3 text-xs text-slate-400">Rendering diagram...</p>;

    return <div className="mermaid-shell my-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function MessageContent({ text, isBot }) {
    if (!isBot) return text;

    const sections = text.split(/```mermaid\s*\n([\s\S]*?)```/gi);
    const lines = sections[0].split("\n");
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

    const renderLines = (sectionLines, keyPrefix = "") => sectionLines.forEach((line, index) => {
        const item = line.match(/^\s*\d+\.\s+\*\*(.+?)\*\*\s+[–-]\s+(.+)$/);
        const heading = line.match(/^#{2,3}\s+(.+)$/);
        const takeaway = line.match(/^\*\*Key Takeaway:\*\*\s*(.+)$/i);

        if (item) {
            listItems.push(
                <li key={`item-${index}`}>
                    <strong>{item[1]}</strong> {item[2]}
                </li>
            );
            return;
        }

        if (heading) {
            flushList();
            content.push(
                <h3 key={`heading-${keyPrefix}${index}`} className="mb-3 mt-2 text-base font-bold text-sky-300">
                    {heading[1]}
                </h3>
            );
            return;
        }

        if (takeaway) {
            flushList();
            content.push(
                <p key={`takeaway-${keyPrefix}${index}`} className="my-4 text-sm text-slate-200">
                    <strong className="text-amber-300">🎯 Key Takeaway:</strong> {takeaway[1]}
                </p>
            );
            return;
        }

        flushList();
        if (line.trim()) {
            content.push(
                <p key={`paragraph-${keyPrefix}${index}`} className="mb-3 last:mb-0">
                    {line}
                </p>
            );
        }
    });

    renderLines(lines);
    flushList();

    for (let index = 1; index < sections.length; index += 2) {
        content.push(
            <MermaidDiagram
                key={`diagram-${index}`}
                chart={sections[index].trim()}
                diagramId={`mermaid-${crypto.randomUUID()}`}
            />
        );
        const trailingText = sections[index + 1];
        if (trailingText) {
            listItems = [];
            renderLines(trailingText.split("\n"), `trailing-${index}-`);
            flushList();
        }
    }

    return content;
}

function App() {

    const loadSavedValue = (key, fallback) => {
        if (typeof window === "undefined") return fallback;
        try {
            const saved = window.localStorage.getItem(key);
            if (!saved) return fallback;
            return JSON.parse(saved);
        } catch {
            return fallback;
        }
    };

    const [sessionId, setSessionId] = useState(() => loadSavedValue("ai-market-gap-sessionId", uuidv4()));
    const [message, setMessage] = useState("");
    const [analysis, setAnalysis] = useState(() => loadSavedValue("ai-market-gap-analysis", null));
    const [selectedAttachment, setSelectedAttachment] = useState(null);
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef(null);
    const [messages, setMessages] = useState(() => loadSavedValue("ai-market-gap-messages", [
        {
            sender: "bot",
            text: "Hi! 👋 I'm your AI Market Gap Analyzer. What startup idea are you planning to build?"
        }
    ]));

    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAttachmentChange = (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        const supportedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        if (!supportedTypes.includes(file.type)) {
            setUploadError("Please choose a JPG, JPEG, PNG, WEBP, PDF, or DOCX file.");
            return;
        }

        if (file.size > 12 * 1024 * 1024) {
            setUploadError("Attachments must be smaller than 12 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setSelectedAttachment({
                name: file.name,
                type: file.type,
                size: file.size,
                dataUrl: reader.result
            });
            setUploadError("");
        };
        reader.onerror = () => setUploadError("The file could not be read. Please choose it again.");
        reader.readAsDataURL(file);
    };

    const removeAttachment = () => {
        setSelectedAttachment(null);
        setUploadError("");
    };

    const handleSend = async () => {

        if ((!message.trim() && !selectedAttachment) || isLoading) return;

        const userMessage = message.trim();

        const updatedMessages = [
            ...messages,
            {
                sender: "user",
                text: userMessage,
                ...(selectedAttachment
                    ? selectedAttachment.type.startsWith("image/")
                        ? { image: selectedAttachment }
                        : { file: selectedAttachment }
                    : {})
            }
        ];

        setMessages(updatedMessages);
        setMessage("");
        setSelectedAttachment(null);
        setUploadError("");
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
                    text: error.response?.data?.error || "Sorry, the message could not be processed."
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

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem("ai-market-gap-sessionId", JSON.stringify(sessionId));
        } catch {
            // ignore storage errors
        }
    }, [sessionId]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem("ai-market-gap-messages", JSON.stringify(messages));
        } catch {
            // ignore storage errors
        }
    }, [messages]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem("ai-market-gap-analysis", JSON.stringify(analysis));
        } catch {
            // ignore storage errors
        }
    }, [analysis]);

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
                                        className={`max-w-[88%] px-1 py-1 text-sm leading-6 sm:max-w-[78%] ${
                                        msg.sender === "user"
                                            ? "rounded-xl bg-indigo-600 px-4 py-3 text-white"
                                            : "text-slate-200"
                                    }`}
                                >
                                            {msg.image?.dataUrl && (
                                    <img
                                        src={msg.image.dataUrl}
                                        alt={msg.image.name || "Attached image"}
                                        className="mb-3 max-h-64 w-full rounded-lg object-contain"
                                    />
                                )}
                                {msg.file?.dataUrl && (
                                    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                                        <div className="font-semibold text-slate-100">{msg.file.name}</div>
                                        <div className="mt-1 text-slate-400">{msg.file.type}</div>
                                    </div>
                                )}
                                    <MessageContent text={msg.text} isBot={msg.sender === "bot"} />
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="text-sm text-slate-400">AI is thinking...</div>
                        )}
                    </div>

                    <div className="flex-none border-t border-slate-800 bg-slate-950/95 p-3 sm:p-4">
                        {selectedAttachment && (
                            <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-2">
                                {selectedAttachment.type.startsWith("image/") ? (
                                    <img
                                        src={selectedAttachment.dataUrl}
                                        alt="Selected attachment preview"
                                        className="h-14 w-14 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800 text-sm text-slate-300">
                                        {selectedAttachment.type === "application/pdf" ? "PDF" : "DOCX"}
                                    </div>
                                )}
                                <p className="min-w-0 flex-1 truncate text-sm text-slate-300">{selectedAttachment.name}</p>
                                <button
                                    type="button"
                                    onClick={removeAttachment}
                                    aria-label="Remove selected attachment"
                                    className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>
                        )}
                        {uploadError && <p className="mb-2 text-sm text-rose-400">{uploadError}</p>}
                        <div className="flex gap-2 sm:gap-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={handleAttachmentChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Upload image"
                                title="Upload image"
                                className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-indigo-500 hover:text-white"
                            >
                                <FiPaperclip size={18} />
                            </button>
                            <input
                                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder={selectedAttachment ? "Ask something about this attachment..." : "Describe your startup idea..."}
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