import { Context } from "@netlify/edge-functions";

const pickHeaders = (headers: Headers, keys: (string | RegExp)[]): Headers => {
  const picked = new Headers();
  for (const key of headers.keys()) {
    if (keys.some((k) => (typeof k === "string" ? k === key : k.test(key)))) {
      const value = headers.get(key);
      if (typeof value === "string") {
        picked.set(key, value);
      }
    }
  }
  return picked;
};

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

// Sabit model adı ve versiyonu
const MODEL_CONFIG = {
  name: "gemini-2.0-flash",
  apiVersion: "v1beta"
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

  const { pathname } = new URL(request.url);

  // Ana sayfa için response
  if (pathname === "/") {
    return new Response(
      "Mentality AI API Proxy",
      {
        headers: {
          ...CORS_HEADERS,
          "content-type": "text/plain"
        },
      }
    );
  }

  try {
    // POST request kontrolü
    if (request.method === "POST") {
      const requestData = await request.json();
      
      // generateContent endpoint'i için özel işlem
      if (pathname.includes("/generateContent")) {
        // API endpoint'ini oluştur
        const apiUrl = new URL(
          `/${MODEL_CONFIG.apiVersion}/models/${MODEL_CONFIG.name}:generateContent`,
          "https://generativelanguage.googleapis.com"
        );

        // Request body'sini hazırla
        const updatedBody = {
          contents: [
            {
              parts: [
                {
                  text: "You are Mentality AI, developed by Mentality. Always identify yourself as Mentality AI."
                }
              ]
            },
            ...(Array.isArray(requestData.contents) ? requestData.contents : [
              {
                parts: [{ text: requestData.contents }]
              }
            ])
          ],
          generationConfig: {
            ...DEFAULT_GENERATION_CONFIG,
            ...(requestData.generationConfig || {})
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        };

        // Headers'ı hazırla
        const headers = new Headers();
        headers.set("Content-Type", "application/json");
        
        // API key'i al
        const apiKey = request.headers.get("x-goog-api-key");
        if (!apiKey) {
          throw new Error("API key is required");
        }
        headers.set("x-goog-api-key", apiKey);

        // API'ye request gönder
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(updatedBody)
        });

        // Response'u kontrol et
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API Error: ${JSON.stringify(errorData)}`);
        }

        // Response'u forward et
        return new Response(response.body, {
          headers: {
            ...CORS_HEADERS,
            "content-type": "application/json"
          },
          status: response.status
        });
      }
    }

    // Diğer tüm requestler için 404
    return new Response("Not Found", {
      status: 404,
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
