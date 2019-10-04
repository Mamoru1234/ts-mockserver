import axios from 'axios';
import SockJs from 'sockjs-client';
import { SerializedRequest } from './ExpressRequestUtils';

export type RequestMatcher = (req: SerializedRequest) => boolean;
export type ResponseProducer = (req: SerializedRequest) => any;

export interface MockItem {
  matcher: RequestMatcher;
  producer: ResponseProducer;
}

export const urlMatcher = (url: string) => (req: SerializedRequest) => req.url === url;

export class MockServerClient {
  private socket?: WebSocket;
  private serverUrl: string;
  private mockItems: MockItem[] = [];
  private _responses: {[callbackId: string]: () => any} = {};
  constructor(
    private _port: number,
  ) {
    this.serverUrl = `http://localhost:${this._port}`;
  }
  public init(): Promise<void> {
    return new Promise((res) => {
      this.socket = new SockJs(`${this.serverUrl}/notifications`);
      this.socket.onopen = () => res();
      this.socket.onerror = (e) => {
        console.error('Socket error: ', e);
      };
      this.socket.onclose = () => {
        console.log('Closed');
      };
      this.socket.onmessage = (mes: MessageEvent) => {
        console.log('Notification received: ', mes.data);
        const { requestId, request } = JSON.parse(mes.data);
        this.mockItems.some((item) => {
          const match = item.matcher(request);
          if (!match) {
            return false;
          }
          const response = item.producer(request);
          axios.put(`${this.serverUrl}/response`, {
            requestId,
            response,
          }).catch((e) => {
            console.log('Response error: ', e);
          });
          return true;
        });
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
    this.socket!.close();
  }
}
