# SHIBAL / 18 — Solana devnet prototype

말 대신 보내는 18. 받으면 묘하게 이득인 비추천.

가벼운 핀잔·장난·리액션으로 18개를 전송하는 독립 밈토큰 개발 실험입니다. 공개 블록체인 거래는 공개되며 익명성을 보장하지 않습니다.

## Status

Development only. No mainnet launch, sale, liquidity pool, or promotion.
Devnet issuance and an 18-token roundtrip were completed and verified on 2026-10-28. Mint: `YrDkqvMwkF2pP8eJjZiq9N1Ph6voryK1FRTLX1KcoKk`. Mint and freeze authorities are null; metadata update authority is retained by the test payer. Offline tests: 9 passing. npm audit at development time: 0 known vulnerabilities (not a security audit).

## Test configuration

- Name/symbol: SHIBAL; emblem: 18
- Supply: 1,800,000,000; decimals: 6; reaction transfer: 18
- Standard Solana Token Program
- Initial minting and revocation of mint authority in the same transaction
- No freeze authority
- Metaplex metadata created before mint authority revocation; metadata update authority remains with the test payer, mutable=true
- Full test supply allocated to the test payer; production allocation is undecided

All token parameters are provisional test settings, not launch commitments.

## Run

Node.js 22.18+ and npm are required.

```sh
npm ci --ignore-scripts
npm test
npm run plan
npm run wallets
npm run fund
npm run deploy
npm run roundtrip
npm run verify
```

`wallets` prints only new test wallet public addresses. Fund the payer with free devnet SOL, using https://faucet.solana.com if RPC airdrop is unavailable. Never send real SOL. Windows users can also use `./dev.ps1 test`, `./dev.ps1 deploy`, etc. The optional npm fallback in dev.ps1 requires a separately installed local npm runtime.

Private keys are generated outside this repository in `%LOCALAPPDATA%/SHIBAL-devnet-private` on Windows, or `~/SHIBAL-devnet-private` otherwise. Windows directory ACL inheritance is disabled and access restricted to the current user. Keep this directory local and private; never upload it. Existing wallets are not searched or imported. The recipient signs the return transfer while the payer pays devnet fees.

## Network and recovery

The CLI requires the full devnet genesis hash, not merely a matching RPC URL. `DEVNET_RPC` may select another devnet endpoint; all other genesis hashes are rejected.

Public transaction journals are written under `evidence/` before submission. These contain the mint address, signature, lifetime and signed transaction bytes, never private keys. Journals are excluded from this public repository. Keep them locally for recovery.

```sh
npm run recover -- deploy
npm run recover -- send-18
npm run recover -- return-18
npm run recover -- deploy --rebroadcast
```

Rebroadcast resends the same signed transaction only while valid. Existing operation IDs never silently create new transactions. Expired or failed journals require manual inspection; automatic re-signing with a fresh blockhash is deliberately not provided. Do not delete journals or key files to retry issuance. Reusing a journal with changed parameters is rejected.

`verify` checks supply, decimals, Token Program, mint/freeze authorities, metadata and the two test-wallet balances. Its balance-sum invariant is specific to this two-wallet test: it will fail after tokens are sent to external wallets. Changing the config or payer after deployment is rejected.

A custom transfer requires a unique operation ID:

```sh
npm run send -- RECIPIENT_PUBLIC_ADDRESS 18 send-custom-first
```

## Metadata and local assets

`assets/shibal-18-cute-v1.png` is the approved cute 18 emblem; `assets/18.svg` is the original prototype. Run `npm run assets` to serve `http://127.0.0.1:8180/metadata.json`. Localhost assets cannot be retrieved by external wallets.

Without hosting, deployment creates metadata with an empty URI; on-chain name/symbol and metadata creation have been verified on devnet. To set a hosted JSON URI before issuance, set `METADATA_URI`. To change it afterward:

```sh
npm run metadata -- https://YOUR_HOST/metadata.json metadata-first
```

The metadata update authority remains with the payer and is distinct from the revoked mint authority. Replace the JSON image and properties.files.uri with publicly accessible asset URLs before using remote hosting. The approved PNG and metadata JSON are served from public GitHub raw URLs. The image URL is pinned to a commit; this is development hosting, not guaranteed permanent storage. Some wallets may require PNG instead of SVG. Display is not guaranteed solely by metadata registration.

## Local 18-transfer lab

After deployment and the CLI roundtrip have created both test token accounts, run `npm run lab` (Windows: `./dev.ps1 lab`) and open http://127.0.0.1:8181 in Chrome. This is a local development tool using the two dedicated devnet wallets, not a browser-extension wallet connection. Keep this server local; do not deploy it or expose its port through a tunnel.

The buttons transfer exactly 18 tokens A → B or B → A. The server checks devnet genesis and token invariants, accepts only the fixed wallet pair, and requires a same-origin session token for writes. Request IDs and signatures are persisted before submission; a retry checks the existing transaction instead of issuing another one. An unresolved transaction blocks new requests and requires journal recovery. Do not delete journals to work around a timeout. Browser requests cannot specify an amount, recipient, mint, or key path. The local server process has access to the dedicated test keys; browsers receive no private keys.

Run `npm run test:devnet-safety` to simulate revoked mint authority, absent freeze authority, and insufficient balance. The simulation never submits these transactions and checks that supply and balances stay unchanged. Supply remains 1.8 billion for these devnet experiments; mainnet settings are undecided.

## Amount-specific gift links (local devnet prototype)

Run `npm run gifts` or `./dev.ps1 gifts`, then open http://127.0.0.1:8182. Choose 18, 180, 1800 or 28. Each amount has its own original 1200×630 PNG, title, server-rendered Open Graph and Twitter Card tags. `/preview/18` and the other amount pages only preview cards; GET requests never create or claim gifts. Actual gift URLs take their immutable amount from the saved gift record, not URL query parameters. Cards deliberately describe the original gift amount rather than its changing claim status, because external previews can be cached.

Creating a gift moves existing tokens from test wallet A to a fresh dedicated test holding wallet. On its page, claim transfers to fixed test wallet B; cancel returns an unclaimed gift to A. This is **local custodial testing**, not a deployed escrow contract, public bearer-link service, X-account authentication, or user-wallet authentication. Anyone with local application access can operate these fixed test wallets. Never expose this signing server with hosting, a tunnel, or port forwarding. Keys stay in the private directory outside the repository. Gift IDs are public identifiers, not passwords or private keys.

Persisted gift records and per-action signed transaction journals are under ignored `evidence/gifts/`. Request retries reuse signatures; persisted claim/refund intent prevents the opposite action. A cross-process lock prevents simultaneous mutations. A process crash leaves `operation.lock` deliberately: stop/verify the recorded process, inspect the matching signed journal and chain status before removing only the stale lock. Do not delete gift records or transaction journals. A timeout is recovered by the same request; an expired or failed transaction requires operator investigation, never a fresh gift ID as a workaround. Automatic expiry/refund is not implemented; cancellation is an explicit action before claim intent.

Offline tests: `npm test`. Explicit on-chain integration checks: `npm run check:gifts:devnet` (requires the gift server and devnet funding). Its saved run IDs make reruns resumable; completed checks are skipped. Checks cover 180/28 claims, 1800 cancellation, duplicate actions, opposing actions, crawler GETs and cross-origin POSTs. The 18-token flow is also tested through Chrome. The integration runner is intentionally outside Node's automatic test filename pattern. Generate PNGs on Windows with `powershell -File scripts/make-cards.ps1`.

**External preview remains unverified:** localhost links cannot be fetched by X or opened from another device. Next, publish only a separate read-only card/landing site to a chosen public HTTPS host, then check real X preview rendering. Public wallet-signed claims need their own authentication and escrow design before public use; do not publish this local signing server. No X post or paid service is created by this prototype.

## Dependency versions

Pinned to a compatible official SDK family: Solana Kit 6.10.0, Token 0.13.0, System 0.12.0 and Metaplex Token Metadata Kit 0.0.3. Metaplex currently specifies Kit ^6.5.0; upgrading to another major requires a coordinated compatibility review. The old web3.js/spl-token tree with 9 audit findings was removed without `npm audit fix --force`.

## References

- https://solana.com/docs/tokens/metaplex
- https://www.metaplex.com/docs/smart-contracts/token-metadata/getting-started/kit
- https://github.com/solana-labs/cluster/blob/master/service-env-devnet.sh

No license is granted by this repository beyond GitHub's applicable platform terms; a project license has not yet been selected.

