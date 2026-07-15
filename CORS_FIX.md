# CORS & Network Connection Fix

## Problem
The wallet app was showing "Connecting..." indefinitely and displaying the error:
```
Network Connection failed
Error: RPC call failed: Failed to fetch
```

This was caused by **CORS (Cross-Origin Resource Sharing) restrictions**. The browser was attempting to make direct HTTP requests to the RPC endpoint (`http://5.189.184.7:8545`), but the endpoint doesn't allow cross-origin requests from browser clients.

## Root Cause
- Browser JavaScript can only make requests to the same origin or endpoints that explicitly allow CORS
- The QuanChain RPC endpoint doesn't have CORS headers configured
- Direct fetch() calls from the browser to the RPC endpoint were being blocked

## Solution: API Proxy Pattern
Instead of making direct RPC calls from the browser, we now use a backend API proxy:

```
Browser → /api/rpc (Next.js API Route) → RPC Endpoint
```

### How It Works
1. **Browser Request**: Client-side code calls `fetch('/api/rpc', {...})`
2. **Same-Origin**: Request goes to the local Next.js server (same origin, no CORS issues)
3. **Backend Proxy**: The `/api/rpc` endpoint receives the RPC request
4. **Forward to RPC**: The backend safely forwards the request to the actual RPC endpoint
5. **Response**: The RPC response is sent back to the browser

## Files Changed

### New Files
1. **`app/api/rpc/route.ts`** - Backend API proxy
   - Receives JSON-RPC requests from the browser
   - Validates the request format
   - Forwards to the RPC endpoint with 10-second timeout
   - Handles errors and returns appropriate responses

2. **`app/lib/rpc-client.ts`** - TypeScript RPC Client
   - New client that uses the local API proxy instead of direct RPC calls
   - Provides the same interface as the original RPC client
   - All RPC calls go through `/api/rpc` endpoint
   - Implements proper error handling and timeouts

### Updated Files
1. **`app/components/Dashboard.tsx`**
   - Changed import from `../lib/rpc` to `../lib/rpc-client`
   - Now uses the proxy-based RPC client

## Network Status Improvements
Enhanced network status display in Dashboard:
- ✅ **Green indicator** - Successfully connected
- ⏳ **Yellow animated pulse** - Attempting connection
- ❌ **Red indicator** - Connection failed
- Error message shows specific failure reason
- "Retry connection" button for failed connections
- 5-second timeout prevents indefinite hanging

## Technical Details

### API Proxy Implementation
```typescript
// Client makes request to local API
await fetch('/api/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'net_version', params: [], id: 1 })
})

// Backend receives and proxies
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Set 10-second timeout using AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  // Forward to RPC endpoint
  const response = await fetch(RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
  });
  
  // Return RPC response
  return NextResponse.json(await response.json());
}
```

## Testing the Fix
To verify the fix is working:

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Open the app**: Navigate to `http://localhost:3000`

3. **Check network status**: The sidebar should show:
   - Loading state during connection attempt
   - "Connected" with network version once successful
   - Or "Connection failed" with error details if the endpoint is unreachable

4. **Test RPC call** (optional):
   ```bash
   curl -X POST http://localhost:3000/api/rpc \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "method": "net_version",
       "params": [],
       "id": 1
     }'
   ```

## Benefits of This Approach
✅ **Eliminates CORS issues** - Proxy runs on same origin as browser  
✅ **More secure** - RPC endpoint URL not exposed in client code  
✅ **Better error handling** - Backend can handle network errors gracefully  
✅ **Timeout protection** - Prevents indefinite hanging with 10-second timeout  
✅ **Scalable** - Can add additional logic (caching, rate limiting, etc.) in the proxy  
✅ **Production-ready** - Standard pattern used in production web3 applications  

## Troubleshooting

### Still seeing "Connection failed"?
- The RPC endpoint might be down or unreachable
- Check the error message in the network status panel
- The endpoint URL is configured in `app/api/rpc/route.ts` as `RPC_ENDPOINT`
- You can set a custom endpoint via the `RPC_ENDPOINT` environment variable

### To use a different RPC endpoint:
Add to `.env.local`:
```
RPC_ENDPOINT=http://your-rpc-endpoint:8545
```

Then restart the dev server.
