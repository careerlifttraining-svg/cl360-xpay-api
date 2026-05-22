const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
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

app.get("/wallet/balance", (req, res) => {
  const { wallet } = req.query;

  res.json({
    success: true,
    wallet: wallet || "0x123demo",
    balance: "2500",
    currency: "USDC"
  });
});

app.post("/payment/create", (req, res) => {
  const { amount, currency, recipient } = req.body;

  res.json({
    success: true,
    paymentId: "xpay_demo_001",
    amount: amount || 0,
    currency: currency || "USDC",
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

app.post("/payment/send", (req, res) => {
  const { paymentId, amount, currency, recipient } = req.body;

  res.json({
    success: true,
    paymentId: paymentId || "xpay_demo_001",
    txId: "tx_demo_001",
    amount: amount || 0,
    currency: currency || "USDC",
    to: recipient || "unknown_wallet",
    status: "sent_demo"
  });
});

app.get("/blockchain/history", (req, res) => {
  res.json({
    success: true,
    history: [
      "Sent 250 USDC",
      "Received 100 USDC",
      "Connected Ethereum wallet"
    ]
  });
});

app.listen(PORT, () => {
  console.log("CL360 XPay API running on port " + PORT);
});
