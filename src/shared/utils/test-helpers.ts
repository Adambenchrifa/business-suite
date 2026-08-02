import { Request, Response } from 'express';

/**
 * Creates a fully mocked Express Request object for unit tests.
 */
export function createMockRequest(options: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    cookies: {},
    ...options,
  } as unknown as Request;
}

/**
 * Creates a fully mocked Express Response object that records states for assertions.
 */
export function createMockResponse() {
  const res: Partial<Response> = {};
  
  res.status = function (statusCode: number) {
    this.statusCode = statusCode;
    return this as Response;
  };
  
  res.json = function (data: any) {
    this.jsonData = data;
    return this as Response;
  };

  res.send = function (data: any) {
    this.sendData = data;
    return this as Response;
  };

  // Event emitters replication
  const listeners = new Map<string, Array<() => void>>();
  res.on = function (event: string, callback: any) {
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event)!.push(callback);
    return this as Response;
  };

  (res as any).emitEvent = function (event: string) {
    const list = listeners.get(event);
    if (list) {
      list.forEach((cb) => cb());
    }
  };

  return res as unknown as Response & { jsonData: any; sendData: any; statusCode: number; emitEvent: (event: string) => void };
}

/**
 * Creates a mock Drizzle database instance for querying without opening actual postgres ports.
 */
export function createMockDatabase() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: 'mock-uuid', name: 'Mock Object' }]),
      }),
    }),
    execute: () => Promise.resolve({ rows: [] }),
  };
}
