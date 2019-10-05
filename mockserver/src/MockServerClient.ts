import axios from 'axios';
import SockJs from 'sockjs-client';
import { RequestNotification, SerializedRequest, SerializedResponse } from './ExpressUtils';
import { pullAt } from 'lodash';
import { ChildProcess, exec } from 'child_process';

export type RequestMatcher = (req: SerializedRequest) => boolean;
export type ResponseProducer = (req: SerializedRequest) => SerializedResponse;

export interface MockItem {
  matcher: RequestMatcher;
  producer: ResponseProducer;
}

export const urlMatcher = (url: string) => (req: SerializedRequest) => req.url === url;
const timer = (amount: number) => new Promise((res) => setTimeout(res, amount));

export interface MockClientConfig {
  controlPort: number,
  mockPort: number;
  startTimeout: number;
}

export class MockServerClient {
  private socket?: WebSocket;
  private readonly serverUrl: string;
  private mockItems: MockItem[] = [];
  private error?: Error;
  private serverProcess?: ChildProcess;
  constructor(
    private _config: MockClientConfig,
  ) {
    this.serverUrl = `http://localhost:${this._config.controlPort}`;
  }
  public init(): Promise<void> {
    return this.initServer()
      .then(() => this.initSocket());
  }
  public async mockResponse(matcher: RequestMatcher, producer: ResponseProducer) {
    this.mockItems.push({
      producer,
      matcher,
    });
  }
  public async close(): Promise<void> {
    if (!this.socket) {
      throw new Error('Mock server already closed');
    }
    if (this.error) {
      throw this.error;
    }
    this.socket.close();
    await axios.put(`${this.serverUrl}/shutdown`);
  }
  private sendResponse(requestId: string, response: SerializedResponse) {
    axios.put(`${this.serverUrl}/response`, {
      requestId,
      response,
    }).catch((e: Error) => {
      console.log('Response error: ', e);
      this.error = e;
    });
  }
  private initServer(): Promise<void> {
    this.serverProcess = exec('npx ts-node ./server.ts', {
      cwd: __dirname,
      env: {
        CONTROL_PORT: this._config.controlPort + '',
        MOCK_PORT: this._config.mockPort + '',
      }
    }, (e: Error | null, stdout: string, stderr: string) => {
      if (e) {
        console.log('stdout: ', stdout);
        console.log('stderr: ', stderr);
      }
      this.serverProcess = undefined;
    });
    return this.waitServer();
  }
  private initSocket(): Promise<void> {
    console.log('init socket');
    return new Promise((res) => {
      const socket = new SockJs(`${this.serverUrl}/notifications`);
      socket.onopen = () => {
        console.log('Socket opened');
        this.socket = socket;
        res();
      };
      socket.onerror = (e) => {
        console.error('Socket error: ', e);
      };
      socket.onclose = () => {
        console.log('Socket closed');
        this.socket = undefined;
      };
      socket.onmessage = this.socketMessageHandler;
    });
  }
  private socketMessageHandler = (mes: MessageEvent) => {
    console.log('Notification received: ', mes.data);
    const notification: RequestNotification = JSON.parse(mes.data);
    const { request, requestId } = notification.payload;
    const matchedItemInd = this.mockItems.findIndex((item) => item.matcher(request));
    if (matchedItemInd === -1) {
      this.sendResponse(requestId, {
        status: 404,
        body: {
          reason: 'Not found',
        },
      });
      return;
    }
    const item = this.mockItems[matchedItemInd];
    pullAt(this.mockItems, matchedItemInd);
    const response = item.producer(request);
    this.sendResponse(requestId, response);
  }
  private async waitServer(): Promise<void> {
    const startTime = Date.now();
    while (true) {
      try {
        const response = await axios.get(`${this.serverUrl}/health`);
        if (response.status === 200) {
          break;
        }
      } catch (e) {
        // ignore
      }
      const diff = Date.now() - startTime;
      if (diff > this._config.startTimeout) {
        throw new Error('Timeout waiting for server');
      }
      await timer(300);
    }
  }
}
