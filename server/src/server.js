
const productRoutes = require("./routes/productRoutes");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const analysisRoutes = require("./routes/analysisRoutes");
const connectDB = require("./config/db");
const chatRoutes = require("./routes/chatRoutes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use("/api/products", productRoutes);
app.use("/api/analyze", analysisRoutes);
app.get("/", (req, res) => {
    res.json({
        message: "AI Market Gap Analyzer API is running"
    });
});

app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});