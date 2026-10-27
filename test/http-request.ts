import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect } from '@jest/globals';

interface HttpResult {
  status: number;
  // Responses contain external JSON whose structure is checked by the assertions.
  body: any;
  headers: Headers;
}

const listening = new WeakMap<Server, Promise<number>>();

async function serverPort(server: Server): Promise<number> {
  const address = server.address();
  if (address && typeof address !== 'string') return address.port;
  let pending = listening.get(server);
  if (!pending) {
    pending = new Promise<number>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      server.once('error', onError);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve((server.address() as AddressInfo).port);
      });
    });
    listening.set(server, pending);
  }
  return pending;
}

class HttpRequest implements PromiseLike<HttpResult> {
  private readonly headers = new Headers();
  private payload: unknown;
  private readonly checks: Array<(result: HttpResult) => void> = [];
  private pending?: Promise<HttpResult>;

  constructor(private readonly server: Server, private readonly method: string, private readonly path: string) {}

  set(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  send(value: unknown): this {
    this.payload = value;
    this.headers.set('Content-Type', 'application/json');
    return this;
  }

  expect(status: number): this;
  expect(check: (result: HttpResult) => void): this;
  expect(header: string, value: RegExp): this;
  expect(check: number | string | ((result: HttpResult) => void), value?: RegExp): this {
    this.checks.push((result) => {
      if (typeof check === 'number') expect(result.status).toBe(check);
      else if (typeof check === 'function') check(result);
      else expect(result.headers.get(check)).toMatch(value!);
    });
    return this;
  }

  private async execute(): Promise<HttpResult> {
    const port = await serverPort(this.server);
    const response = await fetch(`http://127.0.0.1:${port}${this.path}`, {
      method: this.method,
      headers: this.headers,
      body: this.payload === undefined ? undefined : JSON.stringify(this.payload),
      signal: AbortSignal.timeout(10000),
    });
    const body = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : await response.text();
    const result: HttpResult = { status: response.status, body, headers: response.headers };
    for (const check of this.checks) check(result);
    return result;
  }

  then<TResult1 = HttpResult, TResult2 = never>(
    onfulfilled?: ((value: HttpResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.pending ??= this.execute();
    return this.pending.then(onfulfilled, onrejected);
  }
}

// Send real HTTP requests with native fetch; Jest handles the assertions.
export default function request(server: Server) {
  return {
    get: (path: string) => new HttpRequest(server, 'GET', path),
    post: (path: string) => new HttpRequest(server, 'POST', path),
    patch: (path: string) => new HttpRequest(server, 'PATCH', path),
    delete: (path: string) => new HttpRequest(server, 'DELETE', path),
  };
}
