const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
require("dotenv").config();
const mongoose = require("mongoose");

const requestIp = require("request-ip");
const { router: Auth } = require("./routes/User");
const Budget = require("./routes/API");

const { Authenticate } = require("./routes/User");

mongoose.connect(
  "mongodb+srv://bharadwaajatadikonda:QuCH1k5Gu6kbQdwv@cluster0.oij34gb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
);
const db = mongoose.connection;
db.on("error", (error) => {
  console.error("Connection error:", error);
});
db.once("open", () => {
  console.log("Connected to the database");
});

app.use(express.json());
app.use(requestIp.mw());
app.use(express.urlencoded({ extended: false }));
app.get("/", (req, res) => {
  res.json({
    message: "Backend-4 is working",
  });
});
app.use("/user", Auth);
app.use("/budget", Authenticate, Budget);
app.use((req, res, next) => {
  const error = new Error("Not found");
  error.status = 404;
  next();
});

app.use((error, req, res, next) => {
  res.status(error.status || 500).json({
    message: error.message,
  });
});
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
