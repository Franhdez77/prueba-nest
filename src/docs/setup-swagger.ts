import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('FleetCore API')
    .setDescription(
      'Gestión del mantenimiento de flotas. Registra un técnico, inicia sesión y copia data.accessToken en Authorize → bearer. Las integraciones usan x-api-key. Las respuestas de negocio están envueltas en data.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: '/docs-json',
    swaggerOptions: { persistAuthorization: false },
  });
  return document;
}
