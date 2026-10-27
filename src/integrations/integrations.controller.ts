import { ApiSecurity, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccess, ApiErrors } from '../docs/api-responses.decorator.js';
import { IntegrationStatusResponseDto } from '../docs/response.dto.js';
import { Controller, Get } from '@nestjs/common';
import { ApiKeyAuth } from '../auth/decorators/api-key-auth.decorator.js';

@ApiTags('Integraciones')
@ApiSecurity('api-key')
@ApiKeyAuth()
@Controller('integrations')
export class IntegrationsController {
  @ApiOperation({
    summary: 'Comprobar integración externa',
    description: 'Requiere x-api-key; no requiere JWT.',
  })
  @ApiSuccess(200, IntegrationStatusResponseDto)
  @ApiErrors(401, 500)
  @Get('status')
  status() {
    return { service: 'FleetCore', status: 'ok' };
  }
}
