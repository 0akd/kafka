import { component$, useSignal, useVisibleTask$, $, noSerialize } from '@builder.io/qwik';
import { Form } from '@builder.io/qwik-city';
import { useLoginAction, useUserLoader } from '../layout';

export default component$(() => {
  const user = useUserLoader();
  const loginAction = useLoginAction();
  const logs = useSignal<string[]>([]);
  const testStatus = useSignal<Record<string, boolean>>({});

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const addLog = (message: string) => {
      logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] ${message}`];
    };

    addLog('Page loaded');

    // Test 1: Check Google SDK
    const checkGoogle = () => {
      if ((window as any).google) {
        addLog('✅ Google SDK loaded');
        testStatus.value = { ...testStatus.value, googleSDK: true };
      } else {
        addLog('⏳ Waiting for Google SDK...');
        testStatus.value = { ...testStatus.value, googleSDK: false };
        setTimeout(checkGoogle, 500);
      }
    };
    checkGoogle();

    // Test 2: Check environment variables
    const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;
    const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
    
    if (clientId) {
      addLog(`✅ Google Client ID: ${clientId.substring(0, 20)}...`);
      testStatus.value = { ...testStatus.value, clientId: true };
    } else {
      addLog('❌ Google Client ID missing');
      testStatus.value = { ...testStatus.value, clientId: false };
    }

    if (backendUrl) {
      addLog(`✅ Backend URL: ${backendUrl}`);
      testStatus.value = { ...testStatus.value, backendUrl: true };
    } else {
      addLog('❌ Backend URL missing');
      testStatus.value = { ...testStatus.value, backendUrl: false };
    }

    // Test 3: Check backend connectivity
    fetch(`${backendUrl}/api/books`)
      .then(res => {
        if (res.ok) {
          addLog('✅ Backend is reachable');
          testStatus.value = { ...testStatus.value, backend: true };
        } else {
          addLog(`⚠️ Backend returned ${res.status}`);
          testStatus.value = { ...testStatus.value, backend: false };
        }
      })
      .catch(err => {
        addLog(`❌ Backend unreachable: ${err.message}`);
        testStatus.value = { ...testStatus.value, backend: false };
      });

    // Test 4: Check cookie
    const hasCookie = document.cookie.includes('user_session');
    if (hasCookie) {
      addLog('✅ User session cookie found');
      testStatus.value = { ...testStatus.value, cookie: true };
    } else {
      addLog('ℹ️ No user session cookie');
      testStatus.value = { ...testStatus.value, cookie: false };
    }

    // Load Google script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    // Google credential callback
    (window as any).handleGoogleCredential = (response: any) => {
      addLog('🔐 Google credential received');
      addLog(`Credential length: ${response.credential.length} chars`);
      
      const input = document.getElementById('google-token-input') as HTMLInputElement;
      const submitBtn = document.getElementById('google-submit-btn') as HTMLButtonElement;

      if (input && submitBtn) {
        addLog('✅ Form elements found');
        input.value = response.credential;
        addLog('🚀 Submitting login form...');
        submitBtn.click();
      } else {
        addLog('❌ Form elements not found');
      }
    };

    script.onload = () => {
      const google = (window as any).google;
      if (!google) {
        addLog('❌ Google SDK failed to initialize');
        return;
      }

      addLog('🔧 Initializing Google Sign-In...');

      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (window as any).handleGoogleCredential,
        });

        const container = document.getElementById('google-btn-container');
        if (container) {
          addLog('✅ Rendering Google button');
          google.accounts.id.renderButton(container, { 
            theme: 'outline', 
            size: 'large',
            text: 'signin_with',
          });
          addLog('✅ Google button rendered - ready to click!');
        } else {
          addLog('❌ Button container not found');
        }
      } catch (err) {
        addLog(`❌ Error initializing Google: ${err}`);
      }
    };

    script.onerror = () => {
      addLog('❌ Failed to load Google SDK script');
    };
  });

  const checkCookies = $(() => {
    logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] 🔍 Checking cookies...`];
    logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] Cookies: ${document.cookie || 'None'}`];
  });

  const testBackend = $(async () => {
    logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] 🔍 Testing backend auth endpoint...`];
    try {
      const res = await fetch(
        'https://backendfor-drnunpvzu-arjun-kumar-dubeys-projects.vercel.app/api/auth',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: 'test' })
        }
      );
      const data = await res.json();
      logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] Backend response: ${JSON.stringify(data)}`];
    } catch (err) {
      logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] ❌ Backend test failed: ${err}`];
    }
  });

  const clearAndReload = $(() => {
    logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] 🗑️ Clearing all data...`];
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach(c => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    logs.value = [...logs.value, `[${new Date().toLocaleTimeString()}] ✅ Data cleared, reloading...`];
    setTimeout(() => location.reload(), 1000);
  });

  return (
    <div class="min-h-screen bg-slate-900 text-white p-8">
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-8">🔍 Login Debug Page</h1>

        {/* Current User Status */}
        <div class="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Current User Status</h2>
          {user.value ? (
            <div class="space-y-2">
              <p class="text-green-400">✅ Logged In</p>
              <p>Email: {user.value.email}</p>
              <p>Name: {user.value.name}</p>
              {user.value.picture && (
                <img src={user.value.picture} class="w-16 h-16 rounded-full" alt="Profile" width={64} height={64} />
              )}
            </div>
          ) : (
            <p class="text-yellow-400">⚠️ Not Logged In</p>
          )}
        </div>

        {/* System Tests */}
        <div class="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">System Tests</h2>
          <div class="space-y-2 font-mono text-sm">
            {Object.entries(testStatus.value).map(([test, passed]) => (
              <div key={test} class={passed ? 'text-green-400' : 'text-red-400'}>
                {passed ? '✅' : '❌'} {test}
              </div>
            ))}
          </div>
        </div>

        {/* Google Login */}
        <div class="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Google Login</h2>
          
          {loginAction.value?.success && (
            <div class="bg-green-600 text-white p-3 rounded mb-4">
              ✅ Login successful! User: {loginAction.value.user.email}
            </div>
          )}

          {loginAction.value?.failed && (
            <div class="bg-red-600 text-white p-3 rounded mb-4">
              ❌ Login failed: {loginAction.value.message}
            </div>
          )}

          <div id="google-btn-container" class="mb-4 min-h-[44px]"></div>

          <Form action={loginAction} class="hidden">
            <input type="hidden" name="credential" id="google-token-input" />
            <button type="submit" id="google-submit-btn">Login</button>
          </Form>
        </div>

        {/* Debug Logs */}
        <div class="bg-slate-800 rounded-lg p-6">
          <h2 class="text-xl font-bold mb-4">Debug Logs</h2>
          <div class="bg-black rounded p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
            {logs.value.length === 0 ? (
              <p class="text-slate-500">No logs yet...</p>
            ) : (
              logs.value.map((log, i) => (
                <div key={i} class="text-green-400">{log}</div>
              ))
            )}
          </div>
        </div>

        {/* Manual Tests */}
        <div class="bg-slate-800 rounded-lg p-6 mt-6">
          <h2 class="text-xl font-bold mb-4">Manual Tests</h2>
          <div class="space-y-3">
            <button
              onClick$={checkCookies}
              class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-bold"
            >
              Check Cookies
            </button>

            <button
              onClick$={testBackend}
              class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-bold ml-3"
            >
              Test Backend
            </button>

            <button
              onClick$={clearAndReload}
              class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold ml-3"
            >
              Clear & Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});