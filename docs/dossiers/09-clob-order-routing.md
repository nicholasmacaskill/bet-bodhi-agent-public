# [Dossier 09] Web3 Liquidity Resolution & CLOB Order Routing

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Web3 Primitives & Cryptographic Routing` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-06-20`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *on-chain order execution*

**Executive Summary:** Resolves CLOB token identifiers via the Gamma API and routes bounded limit orders directly to Polygon with custom wallet adapters.

- **Telemetry:** `chain_id: 137 // contract: usdc.e_0x2791B... // signature_type: poly_proxy`
- **Tech Stack:** `Ethers.js v6`, `@polymarket/clob-client`, `Polygon CTF`, `RPC Node`, `Polymarket Gamma API`, `USDC.e Approvals`, `Limit Order Placement`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **max_execution_slippage** | `$0.05` |
| **safety_stake_limit** | `$35.00` |

## Technical Architecture & Findings

### Ethers.js v6 Signer Adapter

The `@polymarket/clob-client` SDK expects an Ethers v5 signer. A custom signature adapter bridges v6 wallet declarations without duplicating dependency weight and handles the `SignatureType.POLY_PROXY` execution structure for proxy wallets:

```typescript
const signerAdapter: any = {
    getAddress: async () => wallet.address,
    signMessage: async (message: string | Uint8Array) => wallet.signMessage(
        typeof message === 'string' ? message : ethers.hexlify(message)
    ),
    _signTypedData: async (domain: any, types: any, value: any) => {
        const { EIP712Domain, ...restTypes } = types;
        return await wallet.signTypedData(domain, restTypes, value);
    },
    connect: () => signerAdapter
};
```

### Execution Flow

Orders are placed as bounded limit orders using resolved contract tokens. To protect against slippage, execution limits are bounded dynamically:

$$\text{Execution Price} = \min(\text{Target Price} + 0.05, 0.99)$$

If `POLY_PROXY_ADDRESS` is specified in the environment, the client routes transactions through the proxy, verifying USDC.e on-chain balances on the Polygon network prior to order submission.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
