/**
 * QuanChain Wallet - RPC Client
 * JSON-RPC 2.0 client for QuanChain nodes
 */

export class RpcClient {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.requestId = 0;
  }

  /**
   * Make an RPC call
   * @param {string} method - RPC method name
   * @param {Array} params - Method parameters
   * @returns {Promise<any>} - RPC result
   */
  async call(method, params = []) {
    const id = ++this.requestId;

    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
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
      throw new RpcError(-32603, `RPC call failed: ${error.message}`);
    }
  }

  /**
   * Batch RPC calls
   * @param {Array<{method: string, params: Array}>} calls - Array of method calls
   * @returns {Promise<Array>} - Array of results
   */
  async batch(calls) {
    const requests = calls.map((call, index) => ({
      jsonrpc: '2.0',
      method: call.method,
      params: call.params || [],
      id: ++this.requestId
    }));

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requests)
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((item, index) => {
        if (item.error) {
          return { error: item.error };
        }
        return { result: item.result };
      });
    } catch (error) {
      throw new RpcError(-32603, `Batch RPC call failed: ${error.message}`);
    }
  }

  /**
   * Subscribe to events (WebSocket)
   * Not implemented for HTTP endpoint
   */
  subscribe(event, callback) {
    console.warn('Subscriptions not supported on HTTP endpoint');
    return () => {};
  }

  /**
   * Change endpoint
   * @param {string} endpoint - New RPC endpoint URL
   */
  setEndpoint(endpoint) {
    this.endpoint = endpoint;
  }

  /**
   * Check if endpoint is reachable
   * @returns {Promise<boolean>}
   */
  async isConnected() {
    try {
      await this.call('net_version', []);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * RPC Error class
 */
export class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }
}

// Standard JSON-RPC error codes
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
  TX_ALREADY_EXISTS: -32005
};
