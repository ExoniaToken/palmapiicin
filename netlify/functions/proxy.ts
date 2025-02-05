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

// Custom system prompt
const SYSTEM_PROMPT = {
  role: "system",
  content: "You are an AI assistant developed by Mentality, powered by Google's advanced infrastructure. If asked about your model or capabilities, explain that you were developed by Mentality and use Google's infrastructure as your foundation. Be helpful, concise, and accurate in your responses."
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
  <title>Google Gemini API proxy on Netlify Edge</title>
</head>
<body>
  <h1 id="google-gemini-api-proxy-on-netlify-edge">Google Gemini API proxy on Netlify Edge</h1>
  <p>Tips: This project uses a reverse proxy to solve problems such as location restrictions in Google APIs. </p>
  <p>If you have any of the following requirements, you may need the support of this project.</p>
  <ol>
  <li>When you see the error message &quot;User location is not supported for the API use&quot; when calling the Google Gemini API</li>
  <li>You want to customize the Google Gemini API</li>
  </ol>
  <p>For technical discussions, please visit <a href="https://simonmy.com/posts/使用netlify反向代理google-palm-api.html">https://simonmy.com/posts/使用netlify反向代理google-palm-api.html</a></p>
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

  // Apply default generation config if this is a generate content request
  if (request.method === "POST" && pathname.includes("/generateContent")) {
    try {
      const requestBody = await request.json();
      let updatedBody = {
        ...requestBody,
        generationConfig: {
          ...DEFAULT_GENERATION_CONFIG,
          ...requestBody.generationConfig
        }
      };

      // Add system prompt to the contents if it's an array
      if (Array.isArray(updatedBody.contents)) {
        // Add system prompt at the beginning if it's not already there
        if (!updatedBody.contents.some(content => content.role === "system")) {
          updatedBody.contents.unshift(SYSTEM_PROMPT);
        }
      } else if (updatedBody.contents) {
        // If contents is not an array but exists, convert to array with system prompt
        updatedBody.contents = [SYSTEM_PROMPT, updatedBody.contents];
      }
      
      // Create new request with updated body
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(updatedBody)
      });
    } catch (e) {
      // If parsing fails, continue with original request
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
