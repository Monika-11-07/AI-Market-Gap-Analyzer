const { analyzeIdea } = require("../services/analysisService");

const analyzeMarket = async (req, res) => {
console.log("===== Analyze API HIT =====");
    try {

        const { messages } = req.body;

        const report = await analyzeIdea(messages);

        res.json(report);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

};

module.exports = {
    analyzeMarket
};