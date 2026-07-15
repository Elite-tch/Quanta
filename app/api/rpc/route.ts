'use server';

import { NextRequest, NextResponse } from 'next/server';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'http://5.189.184.7:8545';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate RPC request format
    if (!body.method) {
      return NextResponse.json(
        { error: { code: -32600, message: 'Invalid Request' } },
        { status: 400 }
      );
    }

    // Make the RPC call to the actual endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(RPC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`[v0] RPC endpoint returned ${response.status}`);
        return NextResponse.json(
          { error: { code: -32603, message: `RPC endpoint error: ${response.status}` } },
          { status: 502 }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (timeoutError) {
      clearTimeout(timeout);
      throw timeoutError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[v0] RPC proxy error:', errorMessage);

    return NextResponse.json(
      {
        error: {
          code: -32603,
          message: `Internal error: ${errorMessage}`,
        },
      },
      { status: 500 }
    );
  }
}
