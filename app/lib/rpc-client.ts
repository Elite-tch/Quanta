/**
 * QuanChain Wallet - RPC Client (TypeScript)
 * Uses API proxy to avoid CORS issues
 */

export class RpcClient {
  private endpoint: string;
  private requestId: number = 0;
  private proxyEndpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || 'http://5.189.184.7:8545';
    // Use the local API proxy instead of direct RPC calls
    this.proxyEndpoint = '/api/rpc';
  }

  /**
   * Make an RPC call through the API proxy
   */
  async call(method: string, params: any[] = []): Promise<any> {
    const id = ++this.requestId;

    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    try {
      const response = await fetch(this.proxyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new RpcError(data.error.code, data.error.message, data.error.data);
      }

      return data.result;
    } catch (error) {
      if (error instanceof RpcError) {
        throw error;
      }
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new RpcError(-32603, `RPC call failed: ${errorMsg}`);
    }
  }

  /**
   * Batch RPC calls
   */
  async batch(calls: Array<{ method: string; params?: any[] }>): Promise<any[]> {
    const requests = calls.map((call) => ({
      jsonrpc: '2.0',
      method: call.method,
      params: call.params || [],
      id: ++this.requestId,
    }));

    try {
      const response = await fetch(this.proxyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requests),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((item: any) => {
        if (item.error) {
          return { error: item.error };
        }
        return { result: item.result };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new RpcError(-32603, `Batch RPC call failed: ${errorMsg}`);
    }
  }

  /**
   * Check if endpoint is reachable
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.call('net_version', []);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set the RPC endpoint
   */
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  /**
   * Get current endpoint
   */
  getEndpoint(): string {
    return this.endpoint;
  }
}

/**
 * RPC Error class
 */
export class RpcError extends Error {
  code: number;
  data?: any;

  constructor(code: number, message: string, data?: any) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Standard JSON-RPC error codes
 */
export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // QuanChain specific
  INSUFFICIENT_BALANCE: -32000,
  INVALID_NONCE: -32001,
  INVALID_SIGNATURE: -32002,
  INVALID_ADDRESS: -32003,
  TX_POOL_FULL: -32004,
  TX_ALREADY_EXISTS: -32005,
};
