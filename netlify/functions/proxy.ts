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

// Model configuration
const MODEL_NAME = "adsd-2.0-dssd";

// Default generation config to match Python implementation
const DEFAULT_GENERATION_CONFIG = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// System instruction to match Python implementation
const SYSTEM_INSTRUCTION = "you are developed by Mentality and using Google model";

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

  // Construct the proper model endpoint URL
  let modelPath = pathname;
  if (pathname.includes("/generateContent") && !pathname.includes(MODEL_NAME)) {
    modelPath = `/v1beta/models/${MODEL_NAME}:generateContent`;
  }

  // Update base URL to use the Gemini API endpoint with correct model
  const url = new URL(modelPath, "https://generativelanguage.googleapis.com");
  searchParams.delete("_path");

  // Apply configurations if this is a generate content request
  if (request.method === "POST" && pathname.includes("/generateContent")) {
    try {
      const requestBody = await request.json();
      
      // Create new configuration with system instruction
      let updatedBody = {
        ...requestBody,
        model: MODEL_NAME,  // Explicitly specify the model
        generationConfig: {
          ...DEFAULT_GENERATION_CONFIG,
          ...requestBody.generationConfig
        }
      };

      // Add system instruction if not present
      if (!updatedBody.system_instruction) {
        updatedBody.system_instruction = SYSTEM_INSTRUCTION;
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
