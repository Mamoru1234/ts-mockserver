import { MockServerClient, urlMatcher } from './MockServerClient';
import axios from 'axios';

const mockClient = new MockServerClient(3045);

const timer = (amount: number) => new Promise((res) => setTimeout(res, amount));

(async () => {
  await mockClient.init();
  await mockClient.mockResponse(urlMatcher('/test'), () => ({
    status: 200,
    body: {
      sample: 'test',
    },
  }));
  const response = await axios.get(`http://localhost:3046/test`);
  console.log(response.data);
  mockClient.close();
})().catch((e) => {
  console.error('Error during main: ', e);
});
