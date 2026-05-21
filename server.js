const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    app: "CL360 XPay API",
    status: "live",
    version: "1.0.0"
  });
});

app.get("/ping", (req, res) => {
  res.json({ success: true, message: "pong" });
});

app.post("/wallet/connect", (req, res) => {
  const { walletAddress, chain } = req.body;

  res.json({
    success: true,
    walletAddress: walletAddress || "wallet_not_provided",
    chain: chain || "ethereum",
    status: "connected_demo"
  });
});

app.post("/payment/create", (req, res) => {
  const { amount, currency, recipient } = req.body;

  res.json({
    success: true,
    paymentId: "xpay_demo_001",
    amount: amount || 0,
    currency: currency || "USD",
    recipient: recipient || "recipient_not_provided",
    status: "created_demo"
  });
});

app.get("/payment/status", (req, res) => {
  res.json({
    success: true,
    paymentId: "xpay_demo_001",
    status: "pending_demo"
  });
});

app.listen(PORT, () => {
  console.log(`CL360 XPay API running on port ${PORT}`);
});
