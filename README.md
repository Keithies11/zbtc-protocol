# ZBTC Protocol & Deflationary Mining Engine

Deflationary, Bitcoin-inspired proof-of-transaction mining ERC-20 token deployed on **Base Mainnet**.

## 📊 Live Smart Contract Details

- **Network:** Base Mainnet (Chain ID `8453`)
- **Contract Address:** [`0x034b2F529dc9B647DA2c7BCb016064e74e32d7C2`](https://basescan.org/address/0x034b2F529dc9B647DA2c7BCb016064e74e32d7C2)
- **Source verification:** Check the current published source and compiler settings on BaseScan; local source does not prove deployed-source equivalence.
- **Total Hard Cap:** `21,000,000 ZBTC`
- **Founder Allocation:** `1,000,000 ZBTC` (Minted to personal wallet `0x93DeEdc7e8A621C1165159bE94e957594796D15D`)
- **Mineable Pool:** `20,000,000 ZBTC` (Emitted via on-chain `mine()` calls)

---

## 🛠 Project Structure

- `contracts/ProductionZBTCv2.sol`: Production v2 smart contract with 200k-claim geometric halving epochs and an owner-adjustable per-address cooldown.
- `public/index.html`: Web dApp frontend for wallet connection (Rabby, MetaMask, Coinbase Wallet) and live 1-click mining.
- `scripts/mine.js`: Interactive CLI miner.
- `scripts/autolooppMine.js`: Automated 24/7 background mining bot with cooldown sleeping logic.
- `scripts/deployMainnet.js`: Pre-flight gas simulation and deployment script.
- `vercel.json`: Configuration for instant Vercel static deployment.

## 🔎 Transparency Dashboard

The miner page includes a read-only transparency panel that reads the deployed contract's supply cap, founder allocation, mineable reserve, mined amount, remaining reserve, reward parameters, cooldown, and current owner from Base Mainnet. The panel reports when reads fail and links to BaseScan so users can independently inspect contract state and transactions.

On-chain parameters and supply are not a security audit, a guarantee of source verification, a promise of market value, or evidence that ZBTC can be sold at a displayed price. Check pool liquidity and transaction impact separately before taking action.

## ⚠️ Known Operational Limitation

The ZBTC/USDC pool currently has very low liquidity (most recently observed TVL was approximately $16.40). The dashboard labels the spot price as indicative and warns that trades may have extreme price impact or may not execute at that price. Recheck live pool reserves before any transaction; no market value or exit liquidity is guaranteed.

---

## 🚀 Execution Commands

```bash
# Run local smart contract unit tests
npm test

# Deploy to Base Sepolia (safe test network)
npm run deploy:v2

# Mainnet deployment requires explicit network selection and confirmation
CONFIRM_MAINNET_DEPLOY=YES npm run deploy:v2:mainnet

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
   - Open the active ZBTC contract `0x034b2F529dc9B647DA2c7BCb016064e74e32d7C2` on BaseScan.
   - Click "Update Token Info" to upload logo and website URL.
4. **Security Rules:**
   - Private key stays ONLY in `.env`.
   - Never commit `.env` to GitHub.
