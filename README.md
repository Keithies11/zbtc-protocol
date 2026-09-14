# ZBTC Protocol & Deflationary Mining Engine

Deflationary, Bitcoin-inspired proof-of-transaction mining ERC-20 token deployed on **Base Mainnet**.

## 📊 Live Smart Contract Details

- **Network:** Base Mainnet (Chain ID `8453`)
- **Contract Address:** [`0x7eAa5CAb87ed0516B1A16c5E71D8794E97C2314E`](https://basescan.org/address/0x7eAa5CAb87ed0516B1A16c5E71D8794E97C2314E)
- **BaseScan Verification:** Verified Source Code (Exact Match, Solidity `0.8.20`)
- **Total Hard Cap:** `21,000,000 ZBTC`
- **Founder Allocation:** `1,000,000 ZBTC` (Minted to personal wallet `0x93DeEdc7e8A621C1165159bE94e957594796D15D`)
- **Mineable Pool:** `20,000,000 ZBTC` (Emitted via on-chain `mine()` calls)

---

## 🛠 Project Structure

- `contracts/ProductionZBTC.sol`: Production smart contract with 200k-mine geometric halving epochs and 10-minute anti-spam cooldowns.
- `public/index.html`: Web dApp frontend for wallet connection (Rabby, MetaMask, Coinbase Wallet) and live 1-click mining.
- `scripts/mine.js`: Interactive CLI miner.
- `scripts/autolooppMine.js`: Automated 24/7 background mining bot with cooldown sleeping logic.
- `scripts/deployMainnet.js`: Pre-flight gas simulation and deployment script.
- `vercel.json`: Configuration for instant Vercel static deployment.

---

## 🚀 Execution Commands

```bash
# Run local smart contract unit tests
npm test

# Mine interactively via CLI
npm run mine

# Run automated background mining bot
node scripts/autolooppMine.js

# Launch local dApp server
node server.js
```

---

## 🌐 Phase 5 — Host Frontend on Vercel

1. Push `deflationary-zbtc` repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. Framework Preset: **Other / Static**.
5. Output Directory: `public` (or leave default since `vercel.json` is included).
6. Click **Deploy**.
7. Attach custom domain (`zbtc.io` or `zynintel.com`).

---

## ⚙️ Phase 6 — Host Server on Render

1. Push `ZYN-FRESH` to GitHub (ensure `.env` is ignored by `.gitignore`).
2. Sign in to [Render](https://render.com) and create a **Web Service**.
3. Connect your GitHub repository.
4. Start Command: `node server.js`
5. Add Environment Variables in Render dashboard settings.
6. Attach subdomain (`api.zynintel.com`).

---

## 📋 Phase 7 to 10 — Visibility, Community & Security

1. **Token Visibility:**
   - DexScreener & GeckoTerminal auto-detect once pool has trading volume.
   - Submit listing on DappRadar under DeFi / Token.
   - Submit to Base Ecosystem Directory.
2. **Community Setup:**
   - Twitter / X, Telegram, Discord channels for halving metrics & block rewards.
3. **BaseScan Token Profile:**
   - Open contract `0x47FAf4Ee3369EBF6867Aa8044A88015A8Ff1B0d3` on BaseScan.
   - Click "Update Token Info" to upload logo and website URL.
4. **Security Rules:**
   - Private key stays ONLY in `.env`.
   - Never commit `.env` to GitHub.
