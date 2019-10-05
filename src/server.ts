import express from 'express';
import sockjs from 'sockjs';
import { ControlService } from './ControlService';
import bodyParser from 'body-parser';

const controlApp = express();
const mockApp = express();

const CONTROL_PORT = +process.env['CONTROL_PORT']!;
const MOCK_PORT = +process.env['MOCK_PORT']!;

const notifications = sockjs.createServer({
  prefix: '/notifications',
});

const controlService = new ControlService();

notifications.on('connection', (conn: sockjs.Connection) => {
  controlService.registerConnection(conn);
});

mockApp.use(controlService.handleMockRequest.bind(controlService));

mockApp.listen(MOCK_PORT, (e: any) => {
  if (e) {
    console.error('Mock app Error: ', e);
    return;
  }
  console.log('Mock app listening: ', MOCK_PORT);
});

controlApp.use(bodyParser.json());

controlApp.put('/response', (req: express.Request, res: express.Response) => {
  const { response, requestId } = req.body;
  controlService.handleCallbackResponse(requestId, response);
  res.status(200).send({});
});

controlApp.get('/health', (_req: express.Request, res: express.Response) => {
  res.send();
});

controlApp.put('/shutdown', (_req: express.Request, res: express.Response) => {
  res.send().on('finish', () => {
    console.log('shutdown init');
    setImmediate(() => {
      process.exit(0);
    })
  });
});

notifications.installHandlers(controlApp.listen(CONTROL_PORT, (e: any) => {
  if (e) {
    console.error('Control app Error: ', e);
    return;
  }
  console.log('Control app listening: ', CONTROL_PORT);
}), {
  log(severity: string, message: string): void {
    console.log(`[${severity}] `, message);
  }
});
