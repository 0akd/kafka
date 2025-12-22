// File: src/routes/api/proxy-pdf/index.ts
import { type RequestHandler } from '@builder.io/qwik-city';

export const onGet: RequestHandler = async ({ query, send, headers }) => {
  const targetUrl = query.get('url');

  if (!targetUrl) {
    send(400, 'Missing URL parameter');
    return;
  }

  try {
    console.log("Proxying request to:", targetUrl); // Server logs mein dikhega

    const response = await fetch(targetUrl);

    if (!response.ok) {
      console.error("Proxy Fetch Failed:", response.status, response.statusText);
      send(response.status, `Failed to fetch Source PDF`);
      return;
    }

    // Headers set karein
    headers.set('Content-Type', 'application/pdf');
    headers.set('Access-Control-Allow-Origin', '*');
    
    // 🔥 Important: ArrayBuffer convert karke Uint8Array bhejein
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    send(200, uint8Array);

  } catch (err) {
    console.error('Proxy Server Error:', err);
    send(500, 'Internal Proxy Error');
  }
};