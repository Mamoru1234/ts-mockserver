import { MockServerClient, urlMatcher } from 'mockserver-client/MockServerClient';
import fetch from 'node-fetch';

describe('Sample mock server test', () => {
  const client = new MockServerClient({
    mockPort: 3456,
    controlPort: 3455,
    startTimeout: 5000,
  });
  beforeAll(async () => {
    console.log('Before');
    await client.init();
  });
  afterAll(async () => {
    await client.close();
  });
  it('get request mock', async () => {
    await client.mockResponse(urlMatcher('/test'), () => ({
      body: {
        test: 'success',
      },
    }));
    const response = await fetch('http://localhost:3456/test');
    const body = await response.json();
    expect(body.test).toBe('success');
  });
});
