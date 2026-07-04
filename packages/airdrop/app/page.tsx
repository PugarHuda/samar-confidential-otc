import { MsIcon, Panel } from "@/components/ui";

const STEPS = [
  {
    icon: "rocket_launch",
    title: "Create & fund",
    body: "Admin picks an ERC-7984 token and deploys a campaign clone via the TokenOps factory, funding the pool with an encrypted amount — the total never appears in plaintext.",
    code: "factory.createAndFundConfidentialAirdrop({ params, amount })",
  },
  {
    icon: "encrypted",
    title: "Sign per-recipient allocation",
    body: "For each recipient the admin encrypts an allocation bound to that address and signs the handle (EIP-712). Individual amounts are never revealed — not even to other recipients.",
    code: "encryptUint64({ userAddress: recipient }) → signClaimAuthorization(...)",
  },
  {
    icon: "redeem",
    title: "Claim & decrypt",
    body: "The recipient submits the signed authorization, receives the confidential tokens, and decrypts their own balance locally via the Zama relayer. Only they can read it.",
    code: "airdrop.claim({ encryptedInput, signature }) → userDecrypt",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-page text-txt">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-topbar px-4">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-purple text-page">
          <MsIcon name="redeem" size={15} />
        </span>
        <span className="font-display text-lg font-700">Confidential Airdrop</span>
        <span className="ml-2 rounded-full border border-yellow/30 px-2 py-0.5 font-mono text-[10px] text-yellow">TOKENOPS × ZAMA</span>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="font-mono text-[12px] uppercase tracking-wider text-purple">Special Bounty · TokenOps SDK</div>
        <h1 className="mt-3 font-display text-4xl font-700 leading-tight">
          Airdrop tokens where every allocation stays <span className="text-purple">encrypted</span>.
        </h1>
        <p className="mt-4 text-lg text-muted">
          A confidential distribution app on the TokenOps SDK: totals and per-recipient amounts are FHE-encrypted on-chain, yet
          each recipient can verify and claim exactly their share. Built on ERC-7984 + Zama fhEVM.
        </p>

        <div className="mt-10 grid gap-4">
          {STEPS.map((s, i) => (
            <Panel key={s.title}>
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-panel2 text-purple">
                  <MsIcon name={s.icon} size={22} />
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-faint">0{i + 1}</div>
                  <div className="font-display text-lg font-600">{s.title}</div>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-panel2 p-2.5 font-mono text-[11px] text-dim">{s.code}</pre>
                </div>
              </div>
            </Panel>
          ))}
        </div>

        <Panel className="mt-6 border-yellow/20 bg-panel2">
          <div className="flex items-start gap-3">
            <MsIcon name="build" size={20} className="text-yellow" />
            <p className="text-sm text-muted">
              <span className="font-mono text-dim">STATUS:</span> flow verified against the TokenOps SDK type defs; the two-role
              admin/recipient UI is in active development. Full build plan &amp; exact API in{" "}
              <span className="font-mono text-dim">submission/tokenops-plan.md</span>. Part of the Samar confidential-finance
              suite on Zama.
            </p>
          </div>
        </Panel>
      </main>
    </div>
  );
}
