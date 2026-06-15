import { business } from "@/config/business";

/**
 * Minimal landing page. The real product surface is the API — this page just
 * documents the one endpoint so the deployment isn't a blank 404 at the root.
 */
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Aigent OS — Receptionist</h1>
      <p style={{ color: "#586472", marginTop: 0 }}>
        AI receptionist for same-day field-service businesses. Configured tenant:{" "}
        <strong>{business.name}</strong>.
      </p>

      <h2 style={{ fontSize: "1.05rem" }}>
        <code>POST /api/chat</code>
      </h2>
      <p>
        Send a conversation; get the receptionist&apos;s reply, plus a structured{" "}
        <code>lead</code> once it has gathered enough detail.
      </p>
      <pre
        style={{
          background: "#0f1318",
          color: "#eef2f7",
          padding: "1rem",
          borderRadius: 10,
          overflowX: "auto",
          fontSize: "0.85rem",
        }}
      >
        {`curl -s localhost:3000/api/chat \\
  -H 'content-type: application/json' \\
  -d '{"messages":[{"role":"user",
       "content":"My AC quit and it is 84 inside with an infant."}]}'`}
      </pre>
      <p style={{ color: "#586472" }}>
        Prove the full flow with <code>npm run test:chat</code> (requires{" "}
        <code>ANTHROPIC_API_KEY</code> and a running dev server).
      </p>
    </main>
  );
}
