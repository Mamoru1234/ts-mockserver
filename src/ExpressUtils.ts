import { Request } from 'express';
import { SerializedRequest } from './MockServerDto';

export function serializeRequest(req: Request): SerializedRequest {
  return {
    headers: req.headers,
    method: req.method,
    url: req.url,
    body: req.body,
  };
}
