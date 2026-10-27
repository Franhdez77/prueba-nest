import { BadRequestException } from '@nestjs/common';
import { ParseIdPipe } from './parse-id.pipe.js';

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe();

  it.each(['1', '42', '2147483647'])('parses the positive integer %s', value => {
    expect(pipe.transform(value)).toBe(Number(value));
  });

  it.each(['0', '-1', '1.5', '1e2', 'abc', '01', '2147483648', '9007199254740992'])('rejects invalid IDs: %s', value => {
    expect(() => pipe.transform(value)).toThrow(BadRequestException);
  });
});
