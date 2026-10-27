import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id) || id > 2147483647) {
      throw new BadRequestException('El identificador debe ser un entero positivo');
    }
    return id;
  }
}
