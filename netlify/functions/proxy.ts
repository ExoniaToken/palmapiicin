import { Context } from "@netlify/edge-functions";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
  "content-type": "application/json",
};

const API_CONFIG = {
  baseUrl: "https://generativelanguage.googleapis.com",
  version: "v1beta",
  model: "gemini-2.0-flash",
};

export default async (request: Request, context: Context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    if (request.method === "POST") {
      const apiKey = request.headers.get("x-goog-api-key");
      if (!apiKey) {
        throw new Error("API key is required in x-goog-api-key header");
      }

      const requestData = await request.json();
      const apiUrl = `${API_CONFIG.baseUrl}/${API_CONFIG.version}/models/${API_CONFIG.model}:generateContent?key=${apiKey}`;

      // Sistem mesajını ve kullanıcı mesajını doğru rollerle ekle
      const formattedBody = {
        contents: [
          {
            role: "user",
            parts: [{
              text: "You are Mentality AI, developed by Mentality. Always identify yourself as Mentality AI."
            }]
          },
          {
            role: "model",
            parts: [{
              text: "I am Mentality AI, developed by Mentality. I understand and will always identify myself as Mentality AI."
            }]
          }
        ]
      };

      // Kullanıcı mesajını ekle
      if (typeof requestData === "string") {
        formattedBody.contents.push({
          role: "user",
          parts: [{ text: requestData }]
        });
      } else if (requestData.contents) {
        // Her mesaja role ekle
        const userContents = requestData.contents.map(content => ({
          role: "user",
          parts: content.parts
        }));
        formattedBody.contents.push(...userContents);
      } else if (requestData.prompt) {
        formattedBody.contents.push({
          role: "user",
          parts: [{ text: requestData.prompt }]
        });
      }

      console.log('Request URL:', apiUrl);
      console.log('Request Body:', JSON.stringify(formattedBody, null, 2));

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      
      return new Response(JSON.stringify(responseData), {
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS
    });

  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: CORS_HEADERS
      }
    );
  }
};
