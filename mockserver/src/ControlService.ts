import { Connection } from 'sockjs';
import { Response, Request } from 'express';
import { has, uniqueId } from 'lodash';
import { serializeRequest } from './ExpressRequestUtils';

export class ControlService {
  private _session?: Connection;
  private _pendingResponses: {[requestId: string]: Response} = {};

  public registerConnection(conn: Connection) {
    console.log('New connection');
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
    this._session.write(JSON.stringify({
      requestId,
      request: serializeRequest(req),
    }));
    this._pendingResponses[requestId] = res;
  }

  public handleCallbackResponse(requestId: string, response: any) {
    console.log('Handling callback response: ', requestId);
    this._pendingResponses[requestId].status(200).send(response);
    delete this._pendingResponses[requestId];
  }
}
