import { Context } from "@netlify/edge-functions";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

// API ve model konfigürasyonu
const API_CONFIG = {
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  model: "gemini-2.0-flash",
};

// Generation config
const DEFAULT_GENERATION_CONFIG = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

export default async (request: Request, context: Context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: CORS_HEADERS,
    });
  }

  try {
    if (request.method === "POST") {
      // API key'i headers'dan al
      const apiKey = request.headers.get("x-goog-api-key");
      if (!apiKey) {
        throw new Error("API key is required");
      }

      // Request body'yi al
      const requestData = await request.json();

      // API endpoint URL'ini oluştur
      const apiUrl = `${API_CONFIG.baseUrl}/${API_CONFIG.model}:generateContent?key=${apiKey}`;

      // Mentality prompt'unu ekle
      const updatedBody = {
        contents: [
          {
            parts: [{
              text: "You are Mentality AI, developed by Mentality. Always identify yourself as Mentality AI."
            }]
          },
          ...(requestData.contents || [{
            parts: [{
              text: requestData.prompt || "Hello"
            }]
          }])
        ],
        generationConfig: {
          ...DEFAULT_GENERATION_CONFIG,
          ...(requestData.generationConfig || {})
        }
      };

      // API'ye istek at
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      // Response'u forward et
      return new Response(response.body, {
        headers: {
          ...CORS_HEADERS,
          "content-type": "application/json"
        }
      });
    }

    // POST değilse 405 Method Not Allowed
    return new Response("Method Not Allowed", {
      status: 405,
      headers: CORS_HEADERS
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "content-type": "application/json"
        }
      }
    );
  }
};
