import axios from "axios";

const API = axios.create({
    baseURL: "http://localhost:5000"
});

export const sendMessage = (sessionId, messages) => {
    return API.post("/api/chat", {
        sessionId,
        messages
    });
};

export const analyzeMarket = (messages) => {
    return API.post("/api/analyze", {
        messages
    });
};
export default API;