import { type RequestHandler } from '@builder.io/qwik-city';

export const onGet: RequestHandler = async ({ query, send, status }) => {
  const targetUrl = query.get('url');

  if (!targetUrl) {
    status(400);
    send(new Response("Missing 'url' query parameter", { status: 400 }));
    return;
  }

  try {
    // 🔥 FIX 1: URL ko Decode karna zaroori hai
    const decodedUrl = decodeURIComponent(targetUrl);

    // Check karein ki URL valid hai ya nahi
    try {
        new URL(decodedUrl);
    } catch (e) {
        throw new Error(`Invalid URL format: ${decodedUrl}`);
    }

    console.log("Fetching PDF from:", decodedUrl);

    // 🔥 FIX 2: Mobile/Archive.org ke liye proper Headers
    const response = await fetch(decodedUrl, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://archive.org/',
            'Accept': '*/*'
        }
    });

    if (!response.ok) {
        console.error(`Upstream Error: ${response.status} ${response.statusText}`);
        status(response.status);
        send(new Response(`Failed to fetch PDF. Upstream says: ${response.statusText}`, { status: response.status }));
        return;
    }

    // 🔥 FIX 3: Headers ko clean karke forward karna
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Access-Control-Allow-Origin', '*'); 
    
    // PDF loading bar ke liye ye headers zaroori hain
    const copyHeader = (name: string) => {
        const val = response.headers.get(name);
        if (val) headers.set(name, val);
    };

    copyHeader('Content-Length');
    copyHeader('Content-Range');
    copyHeader('Accept-Ranges');
    copyHeader('Last-Modified');

    // Stream the response back
    send(new Response(response.body, {
        status: 200,
        headers: headers
    }));

  } catch (error: any) {
    console.error("Proxy Internal Error:", error);
    status(400);
    send(new Response(`Proxy Error: ${error.message}`, { status: 400 }));
  }
};