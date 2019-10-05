import { Connection } from 'sockjs';
import { Request, Response } from 'express';
import { has, uniqueId, forEach } from 'lodash';
import {
  MockNotification,
  NotificationType,
  RequestNotification,
  SerializedResponse,
  serializeRequest,
} from './ExpressUtils';

export class ControlService {
  private _session?: Connection;
  private _pendingResponses: {[requestId: string]: Response} = {};

  public registerConnection(conn: Connection) {
    conn.once('close', () => {
      this._session = undefined;
    });
    this._session = conn;
  }

  public handleMockRequest(req: Request, res: Response) {
    if (!this._session) {
      res.status(500).send({});
      return;
    }
    const requestId = uniqueId(process.pid + '');
    const notification: RequestNotification = {
      type: NotificationType.REQUEST,
      payload: {
        requestId,
        request: serializeRequest(req),
      },
    };
    this.sendNotification(notification);
    this._pendingResponses[requestId] = res;
  }

  public handleCallbackResponse(requestId: string, response: SerializedResponse) {
    console.log('Handling request: ', requestId);
    if (!has(this._pendingResponses, requestId)) {
      console.warn('No pending request for such request');
    }
    const pendingResponse = this._pendingResponses[requestId]
      .status(response.status || 200);
    if (response.headers) {
      forEach(response.headers, (headerValue: number | string | string[] | undefined, headerKey: string) => {
        if (headerValue == undefined) {
          return;
        }
        pendingResponse.setHeader(headerKey, headerValue);
      });
    }
    pendingResponse.send(response.body);
    delete this._pendingResponses[requestId];
  }

  private sendNotification(notification: MockNotification) {
    if (!this._session) {
      console.warn('Session not initialized');
      return;
    }
    this._session.write(JSON.stringify(notification));
  }
}
