import { Context } from "@netlify/edge-functions";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
  "content-type": "application/json",
};

// API Configuration
const API_CONFIG = {
  baseUrl: "https://generativelanguage.googleapis.com",
  version: "v1beta",
  model: "gemini-2.0-flash",
};

export default async (request: Request, context: Context) => {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    if (request.method === "POST") {
      // Get API key from headers
      const apiKey = request.headers.get("x-goog-api-key");
      if (!apiKey) {
        throw new Error("API key is required in x-goog-api-key header");
      }

      // Get request body
      const requestData = await request.json();

      // Construct the API URL
      const apiUrl = `${API_CONFIG.baseUrl}/${API_CONFIG.version}/models/${API_CONFIG.model}:generateContent?key=${apiKey}`;

      // Format the request body properly
      const formattedBody = {
        contents: [{
          parts: [{
            text: "You are Mentality AI, developed by Mentality. Always identify yourself as Mentality AI."
          }]
        }]
      };

      // Add the user's message
      if (typeof requestData === "string") {
        // If the input is just a string
        formattedBody.contents.push({
          parts: [{ text: requestData }]
        });
      } else if (requestData.contents) {
        // If the input is already in the correct format
        formattedBody.contents.push(...requestData.contents);
      } else if (requestData.prompt) {
        // If the input uses a 'prompt' field
        formattedBody.contents.push({
          parts: [{ text: requestData.prompt }]
        });
      }

      console.log('Request URL:', apiUrl);
      console.log('Request Body:', JSON.stringify(formattedBody, null, 2));

      // Make the API request
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedBody)
      });

      // Handle API response
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
