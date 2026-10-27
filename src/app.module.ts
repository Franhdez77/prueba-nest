import { MaintenancesModule } from './maintenances/maintenances.module.js';
import { WorkshopsModule } from './workshops/workshops.module.js';
import { MechanicsModule } from './mechanics/mechanics.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
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
    VehiclesModule,
    MechanicsModule,
    WorkshopsModule,
    MaintenancesModule,
  ],
  controllers: [IntegrationsController],
})
export class AppModule {}
