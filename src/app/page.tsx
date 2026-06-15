import App from "./AigentOS";

/**
 * The dashboard is the product surface now: the AigentOS app (login + leads
 * board + map) mounts at "/". Captured leads persist via /api/chat and show up
 * here live. The receptionist brain remains behind POST /api/chat.
 */
export default function Page() {
  return <App />;
}
