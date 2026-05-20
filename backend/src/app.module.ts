import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from './auth/auth.module'
import { CertificadosModule } from './certificados/certificados.module'
import { EmpresaModule } from './empresa/empresa.module'
import { NecesidadesModule } from './necesidades/necesidades.module'
import { ContactosModule } from './contactos/contactos.module'
import { ConveniosModule } from './convenios/convenios.module'
import { PersonasModule } from './personas/personas.module'
import { ProyectosModule } from './proyectos/proyectos.module'
import { CapacitadoresModule } from './capacitadores/capacitadores.module'
import { CronogramaModule } from './cronograma/cronograma.module'
import { GruposModule } from './grupos/grupos.module'
import { CertificacionModule } from './certificacion/certificacion.module'
import { ModificacionesModule } from './modificaciones/modificaciones.module'
import { PlataformasVirtualesModule } from './plataformas-virtuales/plataformas-virtuales.module'
import { EvaluadoresModule } from './evaluadores/evaluadores.module'
import { ImportarProyectoModule } from './importar-proyecto/importar-proyecto.module'
import { UsuariosAdminModule } from './usuarios-admin/usuarios-admin.module'

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
    ConveniosModule,
    PersonasModule,
    ProyectosModule,
    CapacitadoresModule,
    CronogramaModule,
    GruposModule,
    CertificacionModule,
    ModificacionesModule,
    PlataformasVirtualesModule,
    EvaluadoresModule,
    ImportarProyectoModule,
    UsuariosAdminModule,
  ],
})
export class AppModule {}
