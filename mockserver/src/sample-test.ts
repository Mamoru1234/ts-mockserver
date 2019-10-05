import { MockServerClient, urlMatcher } from './MockServerClient';
import axios from 'axios';

const mockClient = new MockServerClient({
  controlPort: 3045,
  mockPort: 3046,
  startTimeout: 10000,
});

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
  await mockClient.close();
})().catch((e) => {
  console.error('Error during main: ', e);
});
