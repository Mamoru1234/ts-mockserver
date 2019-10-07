import axios from 'axios';
import SockJs from 'sockjs-client';
import { RequestNotification, SerializedRequest, SerializedResponse } from './MockServerDto';
import { uniqueId } from 'lodash';
import { execSync } from 'child_process';

export type RequestMatcher = (req: SerializedRequest) => boolean;
export type ResponseProducer = (req: SerializedRequest) => SerializedResponse;

export interface MockItem {
  id: string;
  matcher: RequestMatcher;
  producer: ResponseProducer;
  matchCount: number;
  countToRemove: number;
}

const timer = (amount: number) => new Promise((res) => setTimeout(res, amount));

export interface MockClientConfig {
  controlPort: number,
  mockPort: number;
  startTimeout: number;
}

export class MockServerClient {
  private socket?: WebSocket;
  private readonly serverUrl: string;
  private activeMocks: MockItem[] = [];
  private mocks: {[id: string]: MockItem} = {};
  private error?: Error;
  constructor(
    private _config: MockClientConfig,
  ) {
    this.serverUrl = `http://localhost:${this._config.controlPort}`;
  }
  public async init(): Promise<void> {
    await this.initServer();
    await this.initSocket();
  }
  public mockResponse(matcher: RequestMatcher, producer: ResponseProducer): MockItem {
    const mockItem: MockItem = {
      id: uniqueId('matcher'),
      producer,
      matcher,
      countToRemove: 1,
      matchCount: 0,
    };
    this.mocks[mockItem.id] = mockItem;
    this.activeMocks.push(mockItem);
    return mockItem;
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
  private portMapping(port: number) {
    return `-p ${port}:${port}`
  }
  private initServer(): Promise<void> {
    const config = this._config;
    const image = 'alexeigontarcyber/mockserver:0.1.0';
    let env = '';
    env += ` -e CONTROL_PORT=${config.controlPort}`;
    env += ` -e MOCK_PORT=${config.mockPort}`;
    const command = `docker run -d ${this.portMapping(config.controlPort)} ${this.portMapping(config.mockPort)} ${env} ${image}`;
    console.log('Executing command: ', command);
    execSync(command);
    console.log('Executed');
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
    const notification: RequestNotification = JSON.parse(mes.data);
    console.log('Notification received: ', notification);
    const { request, requestId } = notification.payload;
    const matchedItem = this.activeMocks.find((item) => item.matcher(request));
    if (matchedItem == null) {
      this.sendResponse(requestId, {
        status: 404,
        body: {
          reason: 'Not found',
        },
      });
      return;
    }
    matchedItem.matchCount++;
    if (matchedItem.matchCount === matchedItem.countToRemove) {
      this.activeMocks = this.activeMocks.filter((item) => item.id !== matchedItem.id);
    }
    const response = matchedItem.producer(request);
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
