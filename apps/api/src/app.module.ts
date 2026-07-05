import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { EnvModule } from './infrastructure/env/env.module';
import { ClinicalAiModule } from './modules/clinical-ai/clinical-ai.module';

@Module({
  imports: [EnvModule, DatabaseModule, ClinicalAiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
