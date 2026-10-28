# SHIBAL / 18 — Solana devnet prototype

말 대신 보내는 18. 받으면 묘하게 이득인 비추천.

가벼운 핀잔·장난·리액션으로 18개를 전송하는 독립 밈토큰 개발 실험입니다. 공개 블록체인 거래는 공개되며 익명성을 보장하지 않습니다.

## Status

Development only. No mainnet launch, sale, liquidity pool, or promotion.
On-chain issuance and roundtrip verification are **not completed**: free devnet SOL funding is currently blocked by faucet eligibility. Offline tests: 9 passing. npm audit at development time: 0 known vulnerabilities (not a security audit).

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

`assets/18.svg` is a simple test emblem. Run `npm run assets` to serve `http://127.0.0.1:8180/metadata.json`. Localhost assets cannot be retrieved by external wallets.

Without hosting, deployment creates metadata with an empty URI; on-chain name/symbol and metadata creation still require actual devnet verification. To set a hosted JSON URI before issuance, set `METADATA_URI`. To change it afterward:

```sh
npm run metadata -- https://YOUR_HOST/metadata.json metadata-first
```

The metadata update authority remains with the payer and is distinct from the revoked mint authority. Replace the JSON image and properties.files.uri with publicly accessible asset URLs before using remote hosting. No metadata hosting is configured; the assets are published here as source files only. Some wallets may require PNG instead of SVG. Display is not guaranteed solely by metadata registration.

## Dependencies

Pinned to a compatible official SDK family: Solana Kit 6.10.0, Token 0.13.0, System 0.12.0 and Metaplex Token Metadata Kit 0.0.3. Metaplex currently specifies Kit ^6.5.0; upgrading to another major requires a coordinated compatibility review. The old web3.js/spl-token tree with 9 audit findings was removed without `npm audit fix --force`.

## References

- https://solana.com/docs/tokens/metaplex
- https://www.metaplex.com/docs/smart-contracts/token-metadata/getting-started/kit
- https://github.com/solana-labs/cluster/blob/master/service-env-devnet.sh

No license is granted by this repository beyond GitHub's applicable platform terms; a project license has not yet been selected.

