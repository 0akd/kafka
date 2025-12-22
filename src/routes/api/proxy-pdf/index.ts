import { type RequestHandler } from '@builder.io/qwik-city';

export const onGet: RequestHandler = async ({ query, send, status }) => {
  // 1. URL parameter get karein
  const targetUrl = query.get('url');

  if (!targetUrl) {
    status(400);
    send(new Response("Missing 'url' query parameter", { status: 400 }));
    return;
  }

  try {
    // 2. Double decode check: Kabhi kabhi browser double encode kar deta hai
    const decodedUrl = decodeURIComponent(targetUrl);
    
    // Validate ki URL http/https hai
    const urlObj = new URL(decodedUrl);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error('Invalid Protocol');
    }

    // 3. Fetch from Archive.org
    // Mobile browsers ke liye User-Agent aur Referer set karna zaroori hai
    const response = await fetch(decodedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://archive.org/' // Archive.org ko khush rakhne ke liye
        }
    });

    if (!response.ok) {
        status(response.status);
        send(new Response(`Failed to fetch PDF: ${response.statusText}`, { status: response.status }));
        return;
    }

    // 4. Headers forward karein (Zaroori for PDF Viewer)
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Access-Control-Allow-Origin', '*'); // CORS fix
    
    // Content-Length aur Content-Range zaroori hain loading bar ke liye
    if (response.headers.has('Content-Length')) {
        headers.set('Content-Length', response.headers.get('Content-Length')!);
    }
    if (response.headers.has('Content-Range')) {
        headers.set('Content-Range', response.headers.get('Content-Range')!);
    }
    if (response.headers.has('Accept-Ranges')) {
        headers.set('Accept-Ranges', response.headers.get('Accept-Ranges')!);
    }

    // 5. Response Stream karein
    send(new Response(response.body, {
        status: 200,
        headers: headers
    }));

  } catch (error) {
    console.error("Proxy Error:", error);
    status(400); // Agar URL invalid hai toh 400
    send(new Response("Invalid URL or Server Error", { status: 400 }));
  }
};