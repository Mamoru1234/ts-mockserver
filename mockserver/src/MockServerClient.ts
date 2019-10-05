import axios from 'axios';
import SockJs from 'sockjs-client';
import { RequestNotification, SerializedRequest, SerializedResponse } from './ExpressUtils';
import { pullAt } from 'lodash';

export type RequestMatcher = (req: SerializedRequest) => boolean;
export type ResponseProducer = (req: SerializedRequest) => SerializedResponse;

export interface MockItem {
  matcher: RequestMatcher;
  producer: ResponseProducer;
}

export const urlMatcher = (url: string) => (req: SerializedRequest) => req.url === url;

export class MockServerClient {
  private socket?: WebSocket;
  private readonly serverUrl: string;
  private mockItems: MockItem[] = [];
  private error?: Error;
  constructor(
    private _port: number,
  ) {
    this.serverUrl = `http://localhost:${this._port}`;
  }
  public init(): Promise<void> {
    return new Promise((res) => {
      const socket = new SockJs(`${this.serverUrl}/notifications`);
      socket.onopen = () => {
        this.socket = socket;
        res();
      };
      socket.onerror = (e) => {
        console.error('Socket error: ', e);
      };
      socket.onclose = () => {
        this.socket = undefined;
      };
      socket.onmessage = (mes: MessageEvent) => {
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
      };
    });
  }
  public async mockResponse(matcher: RequestMatcher, producer: ResponseProducer) {
    this.mockItems.push({
      producer,
      matcher,
    });
  }
  public close() {
    if (!this.socket) {
      throw new Error('Mock server already closed');
    }
    if (this.error) {
      throw this.error;
    }
    this.socket.close();
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
}
