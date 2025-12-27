import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let ACCESS_TOKEN = null;
let ENV_SLUGS = [];

// OAuth callback
app.get("/callback", (req, res) => {
  res.redirect("/?code=" + req.query.code);
});

// Exchange authorization code for access token
app.post("/exchange", async (req, res) => {
  try {
    const { code } = req.body;

    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "https://honeycomb-7ay6.onrender.com/callback");
    params.append("client_id", "hcaoc_01kdgkggz78csrvx0e5cyd4e6x");
    params.append("client_secret", "ad6mgrgh4tz6h3jjh2sjhxq1jgsxnqcm");
    params.append("code_verifier", "2sISEZC7sdWBNVNdZWUYmN1V-iV5XuhpjZW_36jSplA");

    const tokenRes = await fetch("https://ui.honeycomb.io/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: params.toString()
    });

    const token = await tokenRes.json();
    ACCESS_TOKEN = token.access_token;

    const mcpRes = await fetch("https://mcp.honeycomb.io/mcp", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "get_workspace_context",
          arguments: {}
        }
      })
    });

    const text = await mcpRes.text();
    const dataLine = text.split("\n").find(l => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine.replace("data: ", ""));
    const contentText = parsed.result.content[0].text;

    ENV_SLUGS = [...contentText.matchAll(/Slug:\s(.+)/g)].map(m => m[1]);

    res.json({ access_token: ACCESS_TOKEN, environment_slugs: ENV_SLUGS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Board lookup
app.post("/boards", async (req, res) => {
  try {
    const { boardId } = req.body;

    const mcpRes = await fetch("https://mcp.honeycomb.io/mcp", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "list_boards",
          arguments: {
            environment_slug: ENV_SLUGS,
            board_id: boardId
          }
        }
      })
    });

    const text = await mcpRes.text();
    res.json({ response: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on port", PORT));
