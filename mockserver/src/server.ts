import express from 'express';
import sockjs from 'sockjs';
import { ControlService } from './ControlService';
import bodyParser from 'body-parser';

const controlApp = express();
const mockApp = express();

const CONTROL_PORT = 3045;
const MOCK_PORT = 3046;

const notifications = sockjs.createServer({
  prefix: '/notifications',
});
const controlService = new ControlService();

notifications.on('connection', (conn: sockjs.Connection) => {
  controlService.registerConnection(conn);
});

mockApp.use(controlService.handleMockRequest.bind(controlService));

mockApp.listen(MOCK_PORT);

controlApp.use(bodyParser.json());

controlApp.put('/response', (req: express.Request, res: express.Response) => {
  const { response, requestId } = req.body;
  controlService.handleCallbackResponse(requestId, response);
  res.status(200).send({});
});

notifications.installHandlers(controlApp.listen(CONTROL_PORT), {
  log(severity: string, message: string): void {
    console.log(`[${severity}] `, message);
  }
});
