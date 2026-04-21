import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from './auth/auth.module'
import { CertificadosModule } from './certificados/certificados.module'
import { EmpresaModule } from './empresa/empresa.module'
import { NecesidadesModule } from './necesidades/necesidades.module'
import { ContactosModule } from './contactos/contactos.module'
import { ProyectosModule } from './proyectos/proyectos.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'oracle',
        username: config.get<string>('ORACLE_USER'),
        password: config.get<string>('ORACLE_PASSWORD'),
        connectString: config.get<string>('ORACLE_CONNECT_STRING'),
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    CertificadosModule,
    EmpresaModule,
    NecesidadesModule,
    ContactosModule,
    ProyectosModule,
  ],
})
export class AppModule {}
