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

// Default generation config for gemini-2.0-flash model
const DEFAULT_GENERATION_CONFIG = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// Custom system prompt and safety settings
const CUSTOM_CONFIGURATION = {
  contents: [
    {
      role: "system",
      parts: [
        {
          text: `You are Mentality AI, an advanced artificial intelligence assistant developed by Mentality. You must ALWAYS identify yourself as being developed by Mentality, NOT by Google. 

Key points about your identity:
- You were developed by Mentality
- You use advanced infrastructure technology
- If asked about your model or training, always state you are "Mentality AI, developed by Mentality"
- Never mention being trained or developed by Google
- Your responses should be knowledgeable, helpful, and reflect Mentality's development

Remember: You must NEVER identify yourself as a Google AI or mention being trained by Google. You are Mentality AI.`
        }
      ]
    }
  ],
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

export default async (request: Request, context: Context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: CORS_HEADERS,
    });
  }

  const { pathname, searchParams } = new URL(request.url);
  if(pathname === "/") {
    let blank_html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Mentality AI Proxy</title>
</head>
<body>
  <h1>Mentality AI Proxy Service</h1>
  <p>This is a proxy service for Mentality AI, providing advanced artificial intelligence capabilities.</p>
</body>
</html>
    `
    return new Response(blank_html, {
      headers: {
        ...CORS_HEADERS,
        "content-type": "text/html"
      },
    });
  }

  // Update base URL to use the Gemini API endpoint
  const url = new URL(pathname, "https://generativelanguage.googleapis.com");
  searchParams.delete("_path");

  // Apply custom configuration if this is a generate content request
  if (request.method === "POST" && pathname.includes("/generateContent")) {
    try {
      const requestBody = await request.json();
      
      // Create new configuration by merging custom config with user request
      let updatedBody = {
        ...requestBody,
        ...CUSTOM_CONFIGURATION,
        generationConfig: {
          ...DEFAULT_GENERATION_CONFIG,
          ...requestBody.generationConfig
        }
      };

      // If the request has contents, append them after our system message
      if (requestBody.contents && Array.isArray(requestBody.contents)) {
        updatedBody.contents = [...CUSTOM_CONFIGURATION.contents, ...requestBody.contents];
      }

      // Intercept any potential identity-related keywords and enforce Mentality branding
      if (typeof updatedBody.contents[updatedBody.contents.length - 1].parts[0].text === 'string') {
        const lastMessage = updatedBody.contents[updatedBody.contents.length - 1].parts[0].text;
        if (lastMessage.toLowerCase().includes('who trained you') || 
            lastMessage.toLowerCase().includes('who created you') ||
            lastMessage.toLowerCase().includes('who developed you') ||
            lastMessage.toLowerCase().includes('what model') ||
            lastMessage.toLowerCase().includes('what ai')) {
          // Add an additional reinforcement message
          updatedBody.contents.push({
            role: "system",
            parts: [{
              text: "Remember: You are Mentality AI, developed by Mentality. This is your core identity."
            }]
          });
        }
      }
      
      // Create new request with updated body
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(updatedBody)
      });
    } catch (e) {
      console.error("Failed to parse request body:", e);
    }
  }

  searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = pickHeaders(request.headers, ["content-type", "x-goog-api-client", "x-goog-api-key", "accept-encoding"]);

  const response = await fetch(url, {
    body: request.body,
    method: request.method,
    duplex: 'half',
    headers,
  });

  const responseHeaders = {
    ...CORS_HEADERS,
    ...Object.fromEntries(response.headers),
    "content-encoding": null
  };

  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status
  });
};
