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
app.post("/payment/send", (req, res) => {
  const { paymentId, amount, currency, recipient } = req.body;

  res.json({
    success: true,
    paymentId: paymentId || "xpay_demo_001",
    txId: "tx_demo_001",
    amount: amount || 0,
    currency: currency || "USDC",
    recipient: recipient || "recipient_not_provided",
    status: "sent_demo"
  });
});

app.get("/wallet/balance", (req, res) => {
  res.json({
    success: true,
    walletAddress: "0x123demo",
    balance: "5000",
    currency: "USDC",
    status: "demo_balance"
  });
});

app.get("/blockchain/history", (req, res) => {
  res.json({
    success: true,
    transactions: [
      {
        txId: "tx_demo_001",
        type: "payment",
        amount: 250,
        currency: "USDC",
        status: "sent_demo"
      },
      {
        txId: "tx_demo_002",
        type: "payout",
        amount: 100,
        currency: "USDC",
        status: "completed_demo"
      }
    ]
  });
});
app.post("/payment/send", (req, res) => {
  const { amount, to } = req.body;

  res.json({
    success: true,
    amount: amount || 0,
    to: to || "unknown_wallet",
    txId: "tx_demo_001",
    status: "sent_demo"
  });
});

app.get("/wallet/balance", (req, res) => {
  res.json({
    success: true,
    wallet: "0x123demo",
    balance: "2500 USDC"
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
  console.log(`CL360 XPay API running on port ${PORT}`);
});
