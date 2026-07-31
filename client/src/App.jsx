import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { FiSend, FiMessageCircle, FiBarChart2 } from "react-icons/fi";
import { sendMessage } from "./services/api";
import { analyzeMarket } from "./services/api";
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

    }

};
    return (

        <div className="min-h-screen bg-slate-950 text-white">

            <header className="border-b border-slate-800 p-5">

                <div className="flex items-center gap-3">

                    <FiMessageCircle size={28} />

                    <div>

                        <h1 className="text-xl font-bold">

                            AI Market Gap Analyzer

                        </h1>

                        <p className="text-sm text-slate-400">

                            Startup Research Assistant

                        </p>

                    </div>

                </div>

            </header>

            <div className="grid lg:grid-cols-3">

                <div className="lg:col-span-2 flex flex-col h-[90vh]">

                    <div className="flex-1 overflow-auto p-5 space-y-4">

                        {messages.map((msg, index) => (

                            <div

                                key={index}

                                className={`flex ${
                                    msg.sender === "user"
                                        ? "justify-end"
                                        : "justify-start"
                                }`}

                            >

                                <div

                                    className={`rounded-xl px-4 py-3 max-w-[80%]
                                    ${
                                        msg.sender === "user"
                                            ? "bg-indigo-600"
                                            : "bg-slate-800"
                                    }`}

                                >

                                    {msg.text}

                                </div>

                            </div>

                        ))}

                        {isLoading && (

                            <div className="text-slate-400">

                                AI is thinking...

                            </div>

                        )}

                    </div>

                    <div className="border-t border-slate-800 p-4 flex gap-3">

    <input
        className="flex-1 rounded-lg bg-slate-900 px-4 py-3 outline-none"
        placeholder="Describe your startup idea..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
    />

    <button
        onClick={handleSend}
        className="bg-indigo-600 rounded-lg px-4 py-3"
    >
        <FiSend />
    </button>

    <button
        onClick={handleAnalyze}
        className="bg-green-600 rounded-lg px-4 py-3"
    >
        Analyze
    </button>

</div>

                </div>

                <div className="border-l border-slate-800 p-6">

                    <div className="flex gap-3 items-center mb-5">

                        <FiBarChart2 />

                        <h2 className="font-bold">

                            Market Insights

                        </h2>

                    </div>

                   <div className="space-y-6">

    <div>
        <p className="text-slate-400">Opportunity Score</p>
        <h2 className="text-4xl font-bold">
            {analysis?.opportunityScore ?? "--"}
        </h2>
    </div>

    <div>
        <p className="font-semibold mb-2">Verdict</p>
        <p>
            {analysis?.verdict || "Waiting for analysis..."}
        </p>
    </div>

    <div>
        <p className="font-semibold mb-2">Competitors</p>

        <ul className="list-disc ml-5">
            {analysis?.competitors?.length ? (
                analysis.competitors.map((item, index) => (
                    <li key={index}>{item}</li>
                ))
            ) : (
                <li>No competitors yet</li>
            )}
        </ul>
    </div>

    <div>
        <p className="font-semibold mb-2">Market Gaps</p>

        <ul className="list-disc ml-5">
            {analysis?.marketGaps?.length ? (
                analysis.marketGaps.map((item, index) => (
                    <li key={index}>{item}</li>
                ))
            ) : (
                <li>No market gaps yet</li>
            )}
        </ul>
    </div>

    <div>
        <p className="font-semibold mb-2">SWOT</p>
        <div className="space-y-2 text-sm text-slate-300">
            {Object.entries(analysis?.swot || {}).map(([key, items]) => (
                <div key={key}>
                    <p className="capitalize font-medium text-slate-100">{key}</p>
                    <ul className="list-disc ml-5">
                        {Array.isArray(items) && items.length ? (
                            items.map((item, index) => <li key={`${key}-${index}`}>{item}</li>)
                        ) : (
                            <li>No data</li>
                        )}
                    </ul>
                </div>
            ))}
        </div>
    </div>

    <div>
        <p className="font-semibold mb-2">Roadmap</p>
        <ul className="list-disc ml-5">
            {analysis?.roadmap?.length ? (
                analysis.roadmap.map((item, index) => (
                    <li key={index}>{item}</li>
                ))
            ) : (
                <li>No roadmap yet</li>
            )}
        </ul>
    </div>

                    </div>

                </div>

           </div>

        </div>

    );

}

export default App;