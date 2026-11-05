    const CONTRACT_ADDRESS = "0x034b2F529dc9B647DA2c7BCb016064e74e32d7C2";
    const READ_RPC_URL = "https://zynintel.com/api/public/base-rpc";
    const CLAIMS_API_URL = "https://zynintel.com/api/public/zbtc-claims";
    const CHAIN_ID = 8453;
    const CHAIN_ID_HEX = "0x2105";

    const ABI = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function currentReward() view returns (uint256)",
      "function currentEpoch() view returns (uint256)",
      "function mineCount() view returns (uint256)",
      "function remainingMineableSupply() view returns (uint256)",
      "function TOTAL_SUPPLY_CAP() view returns (uint256)",
      "function FOUNDER_SUPPLY() view returns (uint256)",
      "function MINEABLE_SUPPLY() view returns (uint256)",
      "function MINES_PER_EPOCH() view returns (uint256)",
      "function totalMinedSupply() view returns (uint256)",
      "function cooldownRemaining(address miner) view returns (uint256)",
      "function balanceOf(address account) view returns (uint256)",
      "function owner() view returns (address)",
      "function miningCooldown() view returns (uint256)",
      "function INITIAL_REWARD() view returns (uint256)",
      "function setMiningCooldown(uint256 newCooldown) external",
      "event Mined(address indexed miner, uint256 reward, uint256 indexed epoch, uint256 mineCount)",
      "function mine() external returns (uint256)"
    ];

    const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL, CHAIN_ID);
    let readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);
    let userSigner = null;
    let userContract = null;
    let userAccount = null;
    let userHasGas = false;
    let cooldownTimer = null;
    let mineInFlight = false;
    let ownerActionInFlight = false;

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    }

    async function loadPoolHealth() {
      const warning = document.getElementById("poolLiquidityWarning");
      try {
        const response = await fetch("https://zynintel.com/api/public/zbtc-pool-health", { cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const pool = await response.json();
        if (!pool.ok) throw new Error("unavailable");
        document.getElementById("poolReserves").innerText = `${Math.round(pool.zbtcReserve).toLocaleString()} ZBTC + ${Number(pool.usdcReserve).toFixed(2)} USDC`;
        const updatedAt = Number(pool.generatedAt);
        const updateText = Number.isFinite(updatedAt) && updatedAt > 0 ? ` · Updated ${new Date(updatedAt).toLocaleString()}` : "";
        document.getElementById("poolPrice").innerText = `~$${Number(pool.priceUsd).toPrecision(3)} per ZBTC · TVL ~$${Number(pool.tvlUsd).toFixed(2)}${updateText}`;
        const warnings = [];
        if (pool.stale) warnings.push(`Cached pool data may be out of date. Last successful update: ${Number.isFinite(updatedAt) && updatedAt > 0 ? new Date(updatedAt).toLocaleString() : "time unavailable"}. Verify current reserves before acting.`);
        if (pool.isLow) {
          warnings.push(`Low liquidity: pool TVL is about $${Number(pool.tvlUsd).toFixed(2)} (threshold $${Number(pool.lowThreshold).toLocaleString()}). A small swap may have extreme price impact, and spot price may not be executable.`);
        }
        warning.innerText = warnings.map((message) => `⚠ ${message}`).join(" ");
        warning.hidden = warnings.length === 0;
      } catch (error) {
        document.getElementById("poolReserves").innerText = "See pool link";
        document.getElementById("poolPrice").innerText = "Current pool data unavailable.";
        warning.innerText = "⚠ Live liquidity data is unavailable. Verify current reserves and price impact in your wallet before any trade.";
        warning.hidden = false;
        console.error("Pool health unavailable:", error);
      }
    }

    async function loadMiningHistory() {
      const wallet = userAccount || localStorage.getItem("zbtc-connected-wallet");
      const summary = document.getElementById("historySummary");
      const list = document.getElementById("miningHistory");
      if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) return;
      try {
        const data = await (await fetch(`${CLAIMS_API_URL}/${wallet}`, { cache: "no-store" })).json();
        if (!data.ok) throw new Error("unavailable");
        list.innerHTML = "";
        summary.innerText = data.count
          ? `${data.count} confirmed claim(s) · ${Number(data.totalReward).toLocaleString()} ZBTC mined to this wallet.`
          : "No confirmed mining claims for this wallet yet.";
        for (const claim of data.claims) {
          const hash = escapeHtml(claim.txHash);
          const when = claim.blockTime ? new Date(claim.blockTime * 1000).toLocaleString() : `Block ${claim.blockNumber}`;
          const item = document.createElement("li");
          item.innerHTML = `<strong style="color:#f7931a;">+${escapeHtml(claim.reward)} ZBTC</strong> · ${escapeHtml(when)} · <a href="https://basescan.org/tx/${hash}" target="_blank" rel="noopener noreferrer">${hash.slice(0, 10)}… ↗</a>`;
          list.appendChild(item);
        }
      } catch {
        summary.innerText = "Mining history is temporarily unavailable. Check BaseScan for your transactions.";
      }
    }

    async function callWithRpcFallback(fn) {
      return fn(readContract);
    }

    function formatTokenAmount(amount, decimals) {
      return `${Number(ethers.formatUnits(amount, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ZBTC`;
    }

    async function loadTransparencyData() {
      const status = document.getElementById("trustStatus");
      try {
        const [
          decimals,
          cap,
          founderSupply,
          mineableSupply,
          minedSupply,
          remainingSupply,
          currentReward,
          initialReward,
          minesPerEpoch,
          cooldown,
          owner
        ] = await Promise.all([
          readContract.decimals(),
          readContract.TOTAL_SUPPLY_CAP(),
          readContract.FOUNDER_SUPPLY(),
          readContract.MINEABLE_SUPPLY(),
          readContract.totalMinedSupply(),
          readContract.remainingMineableSupply(),
          readContract.currentReward(),
          readContract.INITIAL_REWARD(),
          readContract.MINES_PER_EPOCH(),
          readContract.miningCooldown(),
          readContract.owner()
        ]);
        const [blockNumber, code] = await Promise.all([
          readProvider.getBlockNumber(),
          readProvider.getCode(CONTRACT_ADDRESS)
        ]);
        if (code === "0x") throw new Error("No contract bytecode found at the configured address.");

        document.getElementById("trustCap").innerText = formatTokenAmount(cap, decimals);
        document.getElementById("trustFounder").innerText = formatTokenAmount(founderSupply, decimals);
        document.getElementById("trustReserve").innerText = formatTokenAmount(mineableSupply, decimals);
        document.getElementById("trustMined").innerText = formatTokenAmount(minedSupply, decimals);
        document.getElementById("trustRemaining").innerText = formatTokenAmount(remainingSupply, decimals);
        document.getElementById("trustReward").innerText = formatTokenAmount(currentReward, decimals);
        document.getElementById("trustInitialReward").innerText = formatTokenAmount(initialReward, decimals);
        document.getElementById("trustHalving").innerText = `${Number(minesPerEpoch).toLocaleString()} claims`;
        document.getElementById("trustCooldown").innerText = `${Number(cooldown).toLocaleString()} seconds`;
        const ownerLink = document.getElementById("trustOwner");
        ownerLink.innerText = owner;
        ownerLink.href = `https://basescan.org/address/${encodeURIComponent(owner)}`;
        status.innerText = `Contract reads succeeded on Base · block ${Number(blockNumber).toLocaleString()} · refreshed ${new Date().toLocaleTimeString()}`;
        status.style.color = "var(--text-dim)";
      } catch (error) {
        console.error("Transparency data unavailable:", error);
        status.innerText = "On-chain transparency data is currently unavailable. Retry later or inspect the contract directly on BaseScan.";
        status.style.color = "#fca5a5";
        for (const id of ["trustCap", "trustFounder", "trustReserve", "trustMined", "trustRemaining", "trustReward", "trustInitialReward", "trustHalving", "trustCooldown", "trustOwner"]) {
          document.getElementById(id).innerText = "Unavailable";
        }
      }
    }

    async function updateStats() {
      try {
        const [totalSupply, reward, epoch, mineCount, remainingPool, supplyCap] = await callWithRpcFallback((contract) =>
          Promise.all([
            contract.totalSupply(),
            contract.currentReward(),
            contract.currentEpoch(),
            contract.mineCount(),
            contract.remainingMineableSupply(),
            contract.TOTAL_SUPPLY_CAP()
          ])
        );

        const supplyEth = parseFloat(ethers.formatEther(totalSupply));
        const supplyCapEth = parseFloat(ethers.formatEther(supplyCap));
        const rewardEth = ethers.formatEther(reward);
        document.getElementById("statsStatus").hidden = true;
        
        document.getElementById("statReward").innerText = `${rewardEth} ZBTC`;
        document.getElementById("minePill").innerText = `+${rewardEth} ZBTC Reward`;
        document.getElementById("statEpoch").innerText = `Epoch ${epoch}`;
        document.getElementById("statMines").innerText = Number(mineCount).toLocaleString();
        document.getElementById("statCirculating").innerText = `${supplyEth.toLocaleString()} ZBTC`;

        const pct = (supplyCapEth > 0 ? (supplyEth / supplyCapEth) * 100 : 0).toFixed(2);
        document.getElementById("statMaxCap").innerText = `Max Cap: ${supplyCapEth.toLocaleString()} ZBTC`;
        document.getElementById("statProgressPct").innerText = `${pct}% Minted`;
        document.getElementById("progressFill").style.width = `${pct}%`;

        let activeWallet = userAccount || localStorage.getItem("zbtc-connected-wallet");
        if (activeWallet && !ethers.isAddress(activeWallet)) {
          localStorage.removeItem("zbtc-connected-wallet");
          activeWallet = null;
          document.getElementById("userAddress").innerText = "Not Connected";
          document.getElementById("userBalance").innerText = "0.00 ZBTC";
        } else if (activeWallet) {
          activeWallet = ethers.getAddress(activeWallet);
        }

        if (activeWallet) {
          const [userBal, cooldownSec] = await Promise.all([
            readContract.balanceOf(activeWallet),
            readContract.cooldownRemaining(activeWallet)
          ]);
          document.getElementById("userBalance").innerText = `${parseFloat(ethers.formatEther(userBal)).toLocaleString()} ZBTC`;
          if (!userAccount) {
            document.getElementById("userAddress").innerText = `${activeWallet.slice(0, 6)}...${activeWallet.slice(-4)} (Saved)`;
          }
          handleCooldown(Number(cooldownSec));
        }

        await checkOwnerControls();
      } catch (err) {
        console.error("Error updating stats:", err);
        document.getElementById("statReward").innerText = "Unavailable";
        document.getElementById("minePill").innerText = "Reward unavailable";
        document.getElementById("statEpoch").innerText = "Unavailable";
        document.getElementById("statMines").innerText = "Unavailable";
        document.getElementById("statCirculating").innerText = "Unavailable";
        document.getElementById("statProgressPct").innerText = "Unavailable";
        document.getElementById("progressFill").style.width = "0%";
        const statsStatus = document.getElementById("statsStatus");
        statsStatus.innerText = "On-chain mining stats are unavailable. Check your connection and retry; placeholder values are not shown as current data.";
        statsStatus.hidden = false;
      }
    }

    async function checkOwnerControls() {
      try {
        const [ownerAddr, cdSec] = await Promise.all([
          readContract.owner(),
          readContract.miningCooldown()
        ]);
        document.getElementById("ownerCurrentCd").innerText = `${cdSec.toString()}s (${(Number(cdSec)/60).toFixed(1)}m)`;
        const isOwner = userAccount && userAccount.toLowerCase() === ownerAddr.toLowerCase();
        const ownerPanel = document.getElementById("ownerPanel");
        if (isOwner) {
          document.getElementById("ownerAddrLabel").innerText = `${ownerAddr.slice(0, 6)}...${ownerAddr.slice(-4)}`;
          ownerPanel.style.display = "block";
        } else {
          ownerPanel.style.display = "none";
        }
      } catch (err) {
        console.error("Error checking owner controls:", err);
      }
    }

    async function changeCooldown(seconds) {
      const contract = userContract;
      const signer = userSigner;
      const account = userAccount;
      if (!contract || !signer || !account || ownerActionInFlight) return;
      const msg = document.getElementById("ownerStatusMsg");
      ownerActionInFlight = true;
      try {
        await window.ZynWalletConnection.verifyBaseOwnerContext(signer, account, () => readContract.owner());
        if (!await window.ZynWalletConnection.confirmCooldownIncrease(signer, account, readContract, seconds, CONTRACT_ADDRESS)) {
          msg.innerText = "Cooldown change cancelled; no transaction sent.";
          return;
        }
        if (userContract !== contract || userSigner !== signer || userAccount?.toLowerCase() !== account.toLowerCase()) {
          throw new Error("Wallet changed. Reconnect before changing cooldown.");
        }
        msg.innerText = `Submitting setMiningCooldown(${seconds}s) transaction on Base Mainnet...`;
        msg.style.color = "#60a5fa";
        const tx = await contract.setMiningCooldown(seconds);
        msg.innerText = `Tx sent (${tx.hash.slice(0, 10)}...). Waiting for confirmation...`;
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) throw new Error("Cooldown transaction was not confirmed successfully.");
        msg.innerText = `✅ Success! Mining cooldown is now set to ${seconds} seconds.`;
        msg.style.color = "#10b981";
        await updateStats();
      } catch (err) {
        console.error("Owner cooldown error:", err);
        msg.innerText = "❌ Cooldown update failed: " + (err.shortMessage || err.message);
        msg.style.color = "#ef4444";
      } finally {
        ownerActionInFlight = false;
      }
    }

    function handleCooldown(secondsLeft) {
      clearInterval(cooldownTimer);
      const mineBtn = document.getElementById("mineBtn");
      const cooldownMsg = document.getElementById("cooldownMsg");

      if (secondsLeft <= 0) {
        mineBtn.disabled = !userAccount || !userHasGas || mineInFlight;
        cooldownMsg.innerText = !userAccount ? "Connect Wallet to Mine" : (userHasGas ? "Ready to Mine" : "Base ETH Required for Gas");
        cooldownMsg.classList.remove("active");
        return;
      }

      mineBtn.disabled = true;
      cooldownMsg.classList.add("active");

      let remaining = secondsLeft;
      const updateText = () => {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        cooldownMsg.innerText = `⏳ Mining Cooldown: ${m}m ${s < 10 ? '0' : ''}${s}s`;
        if (remaining <= 0) {
          clearInterval(cooldownTimer);
          mineBtn.disabled = !userAccount || !userHasGas || mineInFlight;
          cooldownMsg.innerText = userHasGas ? "Ready to Mine" : "Base ETH Required for Gas";
          cooldownMsg.classList.remove("active");
        }
        remaining--;
      };

      updateText();
      cooldownTimer = setInterval(updateText, 1000);
    }

    async function connectWallet(options = {}) {
      const silent = options && options.silent;
      if (silent && localStorage.getItem("zbtc-site-disconnected") === "1") return;
      const ethProvider = await window.ZynWalletConnection.selectProvider({ silent });
      if (!ethProvider) return;
      if (!silent) localStorage.removeItem("zbtc-site-disconnected");

      const attempt = ++walletConnectionAttempt;
      selectedWalletProvider = ethProvider;
      if (!observedWalletProviders.has(ethProvider)) {
        observedWalletProviders.add(ethProvider);
        const changed = () => { if (selectedWalletProvider === ethProvider) invalidateWalletConnection(); };
        ethProvider.on?.("accountsChanged", changed);
        ethProvider.on?.("chainChanged", changed);
        ethProvider.on?.("disconnect", () => {
          if (selectedWalletProvider === ethProvider) void disconnectWallet();
        });
      }

      try {
        invalidateWalletConnection();
        let browserProvider = new ethers.BrowserProvider(ethProvider);
        let accounts = [];

        if (silent) {
          accounts = await ethProvider.request({ method: "eth_accounts" });
          if (String(await ethProvider.request({ method: "eth_chainId" })).toLowerCase() !== CHAIN_ID_HEX) return;
        } else if (window.ZynWalletConnection.isCoinbaseWallet(ethProvider)) {
          accounts = await ethProvider.request({ method: "eth_requestAccounts" });
        } else {
          try {
            const permissions = await ethProvider.request({
              method: "wallet_requestPermissions",
              params: [{ eth_accounts: {} }]
            });
            accounts = permissions?.[0]?.caveats?.find(caveat => caveat.type === "authorized")?.value;
            if (!accounts) accounts = await ethProvider.request({ method: "eth_requestAccounts" });
          } catch (error) {
            if (error.code === 4001) throw error;
            accounts = await ethProvider.request({ method: "eth_requestAccounts" });
          }
        }

        if (!accounts || accounts.length === 0) {
          if (!silent) throw new Error("No accounts approved by wallet");
          return;
        }

        await window.ZynWalletConnection.ensureBase(ethProvider);
        const revision = walletConnectionRevision;
        const connectedAccount = accounts[0];

        // Recreate the provider after switching chains so ethers uses Base state.
        browserProvider = new ethers.BrowserProvider(ethProvider);
        const connectedSigner = await browserProvider.getSigner();
        const connectedContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, connectedSigner);
        const gasBalance = await browserProvider.getBalance(connectedAccount);
        let gasEstimateText = "Gas estimate unavailable.";
        try {
          const gasEstimate = await connectedContract.mine.estimateGas();
          const feeData = await browserProvider.getFeeData();
          const estimatedFee = gasEstimate * (feeData.maxFeePerGas || feeData.gasPrice || 0n);
          gasEstimateText = `Estimated gas: ${gasEstimate.toString()} units, up to ${ethers.formatEther(estimatedFee)} ETH.`;
        } catch {
          gasEstimateText = "Gas estimate unavailable; do not sign until your wallet shows the expected fee.";
        }
        const activeAccounts = await ethProvider.request({ method: "eth_accounts" });
        const activeChain = String(await ethProvider.request({ method: "eth_chainId" })).toLowerCase();
        const signerAddress = await connectedSigner.getAddress();
        if (attempt !== walletConnectionAttempt) return;
        if (revision !== walletConnectionRevision || activeChain !== CHAIN_ID_HEX || String(activeAccounts[0]).toLowerCase() !== connectedAccount.toLowerCase() || signerAddress.toLowerCase() !== connectedAccount.toLowerCase()) {
          throw new Error("Wallet account or network changed. Reconnect before mining.");
        }
        userAccount = connectedAccount;
        userSigner = connectedSigner;
        userContract = connectedContract;
        userHasGas = gasBalance > 0n;
        localStorage.setItem("zbtc-connected-wallet", userAccount);
        document.getElementById("gasEstimate").innerText = gasEstimateText;

        document.getElementById("connectBtn").innerText = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
        document.getElementById("disconnectBtn").style.display = "inline-flex";
        document.getElementById("userAddress").innerText = userAccount;
        document.getElementById("mineBtn").disabled = !userHasGas || mineInFlight;
        document.getElementById("statusMsg").innerText = userHasGas
          ? `✅ Connected to Base Mainnet. Gas balance: ${ethers.formatEther(gasBalance)} ETH.`
          : "⚠️ Connected, but this wallet has 0 Base ETH. Add Base ETH before mining.";
        document.getElementById("statusMsg").style.color = userHasGas ? "#10b981" : "#f87171";

        await updateStats();
        loadMiningHistory();
      } catch (err) {
        if (attempt !== walletConnectionAttempt) return;
        invalidateWalletConnection();
        if (!silent) {
          console.error("Connect error:", err);
          document.getElementById("statusMsg").innerText = "Failed to connect: " + (err.shortMessage || err.message);
          document.getElementById("statusMsg").style.color = "#ef4444";
        }
      }
    }

    let selectedWalletProvider = null;
    let walletConnectionAttempt = 0;
    let walletConnectionRevision = 0;
    const observedWalletProviders = new WeakSet();
    function invalidateWalletConnection() {
      walletConnectionRevision++;
      userAccount = null;
      userSigner = null;
      userContract = null;
      userHasGas = false;
      clearInterval(cooldownTimer);
      document.getElementById("mineBtn").disabled = true;
      document.getElementById("connectBtn").innerText = "Connect Wallet";
      document.getElementById("cooldownMsg").innerText = "Reconnect Wallet to Mine";
      document.getElementById("userAddress").innerText = "Not Connected";
      document.getElementById("userBalance").innerText = "0.00 ZBTC";
      document.getElementById("disconnectBtn").style.display = "none";
    }

    async function disconnectWallet() {
      walletConnectionAttempt++;
      localStorage.setItem("zbtc-site-disconnected", "1");
      invalidateWalletConnection();
      selectedWalletProvider = null;
      userAccount = null;
      userSigner = null;
      userContract = null;
      userHasGas = false;
      clearInterval(cooldownTimer);
      localStorage.removeItem("zbtc-connected-wallet");

      document.getElementById("connectBtn").innerText = "Connect Wallet";
      document.getElementById("disconnectBtn").style.display = "none";
      document.getElementById("userAddress").innerText = "Not Connected";
      document.getElementById("userBalance").innerText = "0.00 ZBTC";
      document.getElementById("mineBtn").disabled = true;
      document.getElementById("cooldownMsg").innerText = "Connect Wallet to Mine";
      document.getElementById("cooldownMsg").classList.remove("active");
      document.getElementById("statusMsg").innerText = "Wallet disconnected.";
      document.getElementById("statusMsg").style.color = "var(--text-dim)";
      document.getElementById("miningHistory").innerHTML = "";
      document.getElementById("historySummary").innerText = "Connect a wallet to see confirmed on-chain claims.";
    }

    async function triggerMine() {
      if (!userContract || mineInFlight) return;
      const claimContract = userContract;
      const claimAccount = userAccount;
      const claimProvider = selectedWalletProvider;
      let submittedHash = null;

      const btn = document.getElementById("mineBtn");
      const statusMsg = document.getElementById("statusMsg");
      mineInFlight = true;
      try {
        btn.disabled = true;
        const confirmed = window.confirm("Learning-only warning: this signs a Base Mainnet transaction to the verified ZBTC contract 0x034b2F529dc9B647DA2c7BCb016064e74e32d7C2. You may lose gas and ZBTC has no guaranteed value. Continue?");
        if (!confirmed) {
          btn.disabled = false;
          return;
        }
        const chainId = await userContract.runner.provider.send("eth_chainId", []);
        if (chainId !== CHAIN_ID_HEX) {
          throw new Error("Wallet is not connected to Base Mainnet. Switch networks and reconnect.");
        }
        statusMsg.innerText = "Submitting mine() transaction to Base Mainnet...";
        statusMsg.style.color = "#60a5fa";

        await window.ZynWalletConnection.ensureBase(claimProvider);
        const currentAccounts = await claimProvider.request({ method: "eth_accounts" });
        if (userContract !== claimContract || String(currentAccounts[0]).toLowerCase() !== claimAccount.toLowerCase()) throw new Error("Wallet account changed. Reconnect before mining.");
        const tx = await claimContract.mine();
        submittedHash = tx.hash;
        statusMsg.innerText = `Tx broadcasted: ${tx.hash.slice(0, 10)}... waiting for confirmation...`;

        const receipt = await tx.wait().catch(error => {
          if (error.code === "TRANSACTION_REPLACED" && !error.cancelled && error.reason === "repriced") return error.receipt;
          throw error;
        });
        if (!receipt || receipt.status !== 1) {
          const error = new Error("Mining transaction was not confirmed successfully; check its status on BaseScan.");
          error.receipt = receipt;
          throw error;
        }
        const minedEvent = receipt?.logs
          .filter((log) => log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase())
          .map((log) => {
            try { return claimContract.interface.parseLog(log); } catch { return null; }
          })
          .find((event) => event?.name === "Mined" && event.args.miner.toLowerCase() === claimAccount.toLowerCase());
        const actualReward = minedEvent ? ethers.formatEther(minedEvent.args.reward) : null;
        statusMsg.innerText = actualReward
          ? `🎉 Mine confirmed! +${Number(actualReward).toLocaleString(undefined, { maximumFractionDigits: 18 })} ZBTC added to your wallet.`
          : "Transaction confirmed, but no matching mining reward event was found. Verify the claim on BaseScan; no reward is confirmed by this page.";
        statusMsg.style.color = actualReward ? "#10b981" : "#fbbf24";
        try {
          await fetch("https://zynintel.com/api/public/zbtc-claim-verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash: receipt.hash || tx.hash }),
          });
        } catch {
          // The server indexer picks the claim up within a minute anyway.
        }

        await updateStats();
        loadMiningHistory();
      } catch (err) {
        console.error("Mine error:", err);
        const message = err?.info?.error?.message || err?.shortMessage || err?.reason || err?.message || "Wallet RPC failed";
        if (submittedHash && err?.receipt?.status !== 0 && err?.code !== "TRANSACTION_REPLACED") {
          statusMsg.innerText = `Mining transaction ${submittedHash} was submitted, but its outcome is unverified. Check BaseScan before trying again. ${message}`;
          statusMsg.style.color = "#fbbf24";
          return;
        }
        const rpcFailure = /failed to fetch|could not coalesce|eth_blocknumber|network/i.test(message);
        statusMsg.innerText = rpcFailure
          ? "❌ Wallet RPC unavailable. Switch your wallet to Base Mainnet, ensure Base ETH is available, then disconnect and reconnect."
          : "❌ Mining failed: " + message;
        statusMsg.style.color = "#ef4444";
        btn.disabled = false;
      } finally {
        mineInFlight = false;
        await updateStats();
      }
    }

    document.getElementById("connectBtn").addEventListener("click", () => connectWallet());
    document.getElementById("disconnectBtn").addEventListener("click", disconnectWallet);
    document.getElementById("mineBtn").addEventListener("click", triggerMine);
    document.getElementById("set30MinBtn").addEventListener("click", () => changeCooldown(1800));
    document.getElementById("set60MinBtn").addEventListener("click", () => changeCooldown(3600));
    document.getElementById("set120MinBtn").addEventListener("click", () => changeCooldown(7200));
    // Initial load & recurring refresh
    updateStats().then(() => {
      connectWallet({ silent: true });
    });
    loadMiningHistory();
    loadPoolHealth();
    loadTransparencyData();
    setInterval(updateStats, 10000);
    setInterval(loadPoolHealth, 60000);
    setInterval(loadTransparencyData, 60000);
