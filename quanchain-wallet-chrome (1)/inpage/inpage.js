/**
 * QuanChain Wallet - In-Page Provider
 * Injected into web pages to provide window.quanchain
 */

(function() {
  'use strict';

  // Request ID counter
  let requestId = 0;
  const pendingRequests = new Map();

  // Event emitter
  class EventEmitter {
    constructor() {
      this.events = {};
    }

    on(event, callback) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(callback);
      return this;
    }

    off(event, callback) {
      if (!this.events[event]) return this;
      this.events[event] = this.events[event].filter(cb => cb !== callback);
      return this;
    }

    emit(event, ...args) {
      if (!this.events[event]) return this;
      this.events[event].forEach(callback => {
        try {
          callback(...args);
        } catch (e) {
          console.error('QuanChain event handler error:', e);
        }
      });
      return this;
    }

    once(event, callback) {
      const onceWrapper = (...args) => {
        this.off(event, onceWrapper);
        callback(...args);
      };
      return this.on(event, onceWrapper);
    }
  }

  /**
   * QuanChain Provider
   * Similar to MetaMask's window.ethereum
   */
  class QuanChainProvider extends EventEmitter {
    constructor() {
      super();
      this.isQuanChain = true;
      this.isConnected = false;
      this.chainId = '0x2'; // Testnet = 2
      this.networkVersion = '2';
      this.selectedAddress = null;

      // Listen for responses from content script
      window.addEventListener('message', this._handleMessage.bind(this));
    }

    /**
     * Connect to the wallet
     * @returns {Promise<string[]>} Array of addresses
     */
    async connect() {
      const result = await this._request('CONNECT_DAPP', {});

      if (result.connected) {
        this.isConnected = true;
        this.selectedAddress = result.address;
        this.chainId = '0x' + result.chainId.toString(16);
        this.networkVersion = result.chainId.toString();

        this.emit('connect', { chainId: this.chainId });
        this.emit('accountsChanged', [result.address]);

        return [result.address];
      }

      throw new Error('User rejected connection');
    }

    /**
     * Disconnect from the wallet
     */
    async disconnect() {
      await this._request('DISCONNECT_DAPP', {});
      this.isConnected = false;
      this.selectedAddress = null;
      this.emit('disconnect');
    }

    /**
     * Request method (EIP-1193 style)
     * @param {object} args - { method, params }
     * @returns {Promise<any>}
     */
    async request({ method, params = [] }) {
      switch (method) {
        case 'qc_requestAccounts':
          return this.connect();

        case 'qc_accounts':
          return this.selectedAddress ? [this.selectedAddress] : [];

        case 'qc_chainId':
          return this.chainId;

        case 'net_version':
          return this.networkVersion;

        case 'qc_getBalance':
          const balanceResult = await this._request('GET_BALANCE', {
            address: params[0] || this.selectedAddress
          });
          return balanceResult.balance;

        case 'qc_sendTransaction':
          if (!this.isConnected) {
            throw new Error('Not connected');
          }
          // Note: In production, this would need password handling via popup
          const sendResult = await this._request('SEND_TRANSACTION', {
            tx: params[0]
          });
          return sendResult.hash;

        case 'qc_estimateGas':
          const gasResult = await this._request('ESTIMATE_GAS', {
            tx: params[0]
          });
          return gasResult.gasEstimate;

        case 'qc_getTransaction':
          const txResult = await this._request('GET_TRANSACTION', {
            hash: params[0]
          });
          return txResult.transaction;

        case 'qc_networkInfo':
          return await this._request('GET_NETWORK_INFO', {});

        default:
          throw new Error(`Method not supported: ${method}`);
      }
    }

    /**
     * Send request to content script
     */
    _request(method, params) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;

        pendingRequests.set(id, { resolve, reject });

        window.postMessage({
          type: 'QUANCHAIN_REQUEST',
          id,
          payload: { method, params }
        }, '*');

        // Timeout after 60 seconds
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 60000);
      });
    }

    /**
     * Handle messages from content script
     */
    _handleMessage(event) {
      if (event.source !== window) return;

      const { type, id, payload, error } = event.data;

      if (type === 'QUANCHAIN_RESPONSE') {
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(payload);
          }
        }
      }

      if (type === 'QUANCHAIN_PROVIDER_READY') {
        this.emit('ready');
      }
    }

    // Legacy methods for compatibility
    async enable() {
      return this.connect();
    }

    send(method, params) {
      return this.request({ method, params });
    }

    sendAsync(payload, callback) {
      this.request(payload)
        .then(result => callback(null, { result }))
        .catch(error => callback(error));
    }
  }

  // Create and expose provider
  const provider = new QuanChainProvider();

  // Expose on window
  if (typeof window.quanchain === 'undefined') {
    window.quanchain = provider;
  }

  // Also expose as qch for convenience
  if (typeof window.qch === 'undefined') {
    window.qch = provider;
  }

  // Announce provider (EIP-6963 style)
  window.dispatchEvent(new CustomEvent('quanchain#initialized'));

  console.log('QuanChain Wallet provider initialized');
})();
