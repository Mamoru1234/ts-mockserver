import { SerializedRequest } from './MockServerDto';
import { RequestMatcher } from './MockServerClient';

export const urlMatcher = (url: string): RequestMatcher => (req: SerializedRequest) => req.url === url;

export const routeMatcher = (method: string, url: string): RequestMatcher => (req: SerializedRequest) => {
  return req.method === method && req.url === url;
};

export const getMatcher = (url: string) => routeMatcher('GET', url);

export const combineMatchers = (...matchers: RequestMatcher[]): RequestMatcher => (req: SerializedRequest) => {
  return matchers.every((matcher) => matcher(req));
};
