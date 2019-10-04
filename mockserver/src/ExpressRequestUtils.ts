import { Request } from 'express';

export interface SerializedRequest {
  url: string;
  body: any;
}

export function serializeRequest(req: Request): SerializedRequest {
  return {
    url: req.url,
    body: req.body,
  };
}
