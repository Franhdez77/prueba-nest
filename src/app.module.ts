import { IntegrationsController } from './integrations/integrations.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [IntegrationsController],

})
export class AppModule {}
