import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';

export enum NotificationType {
  REQUEST = 'REQUEST',
}

export interface RequestNotification {
  type: NotificationType.REQUEST;
  payload: {
    requestId: string;
    request: SerializedRequest;
  };
}

export type MockNotification = RequestNotification;

export interface SerializedRequest {
  url: string;
  body: any;
  method: string;
  headers: IncomingHttpHeaders;
}

export interface SerializedResponse {
  status?: number;
  body?: any;
  headers?: OutgoingHttpHeaders;
}
