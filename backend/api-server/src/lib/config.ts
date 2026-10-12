// Use getApiKey() in any route that calls the external service.
// The key stays on the server and is never sent to the browser.
export function getApiKey(): string {
  const key = process.env["API_KEY"];

  if (!key) {
    throw new Error(
      "API_KEY is not set. Add it to backend/api-server/.env (see .env.example).",
    );
  }

  return key;
}
