import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ajustarTiposPostgres } from './common/db/postgres-tipos'
import { EstadoController } from './common/estado.controller'
import { PerfilesController } from './common/perfiles.controller'
import { MigracionGuard } from './common/migracion.guard'
import { AuthModule } from './auth/auth.module'
import { CapacitadoresModule } from './capacitadores/capacitadores.module'
import { CertificacionModule } from './certificacion/certificacion.module'
import { CertificadosModule } from './certificados/certificados.module'
import { ContactosModule } from './contactos/contactos.module'
import { ConveniosModule } from './convenios/convenios.module'
import { ConvocatoriaProyectosModule } from './convocatoria-proyectos/convocatoria-proyectos.module'
import { CronogramaModule } from './cronograma/cronograma.module'
import { EmpresaModule } from './empresa/empresa.module'
import { EvaluadoresModule } from './evaluadores/evaluadores.module'
import { RetroalimentacionModule } from './retroalimentacion/retroalimentacion.module'
import { GruposModule } from './grupos/grupos.module'
import { ImportarProyectoModule } from './importar-proyecto/importar-proyecto.module'
import { ModificacionesModule } from './modificaciones/modificaciones.module'
import { NecesidadesModule } from './necesidades/necesidades.module'
import { PersonasModule } from './personas/personas.module'
import { PlataformasVirtualesModule } from './plataformas-virtuales/plataformas-virtuales.module'
import { ProyectosModule } from './proyectos/proyectos.module'
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
      useFactory: (config: ConfigService) => {
        // DB_TIPO decide a qué base habla. Por defecto Oracle: mientras no se ponga en postgres, nada cambia.
        const tipo = (config.get<string>('DB_TIPO') ?? 'oracle').trim().toLowerCase()
        if (tipo === 'postgres') {
          // Antes de la primera consulta: sin esto los ids llegan como cadena y no como número, igual que en Oracle.
          ajustarTiposPostgres()
          // Las tablas viven en el esquema sep, en minúscula y sin comillas, así que el SQL en MAYÚSCULA sigue valiendo.
          console.log(`🐘 PostgreSQL ${config.get('PG_HOST')}:${config.get('PG_PORT')}/${config.get('PG_DATABASE')}`)
          return {
            type: 'postgres' as const,
            host: config.get<string>('PG_HOST', '127.0.0.1'),
            port: Number(config.get<string>('PG_PORT', '5435')),
            username: config.get<string>('PG_USER'),
            password: config.get<string>('PG_PASSWORD'),
            database: config.get<string>('PG_DATABASE', 'sep'),
            schema: config.get<string>('PG_SCHEMA', 'sep'),
            synchronize: false,
            logging: config.get<string>('NODE_ENV') === 'development',
            autoLoadEntities: true,
            extra: { max: 10, min: 2 },
          }
        }
        console.log('🔑 ORACLE_USER:', config.get('ORACLE_USER'))
        console.log('🔑 ORACLE_CS:', config.get('ORACLE_CONNECT_STRING'))
        console.log('🔑 PASSWORD defined:', !!config.get('ORACLE_PASSWORD'))
        return {
          type: 'oracle',
          username: config.get<string>('ORACLE_USER'),
          password: config.get<string>('ORACLE_PASSWORD'),
          connectString: config.get<string>('ORACLE_CONNECT_STRING'),
          synchronize: false,
          logging: config.get<string>('NODE_ENV') === 'development',
          autoLoadEntities: true,
          // pool contra el Exadata por la VPN: 2 conexiones siempre abiertas (abrir una nueva por la VPN tarda y una
          // petición llegó a esperar los 60 s del queueTimeout), hasta 10 para las llamadas en paralelo de cada
          // página, sin cerrar las quietas al minuto y con keepalive cada 2 min para que la VPN no las corte
          extra: { poolMin: 2, poolMax: 10, poolTimeout: 300, expireTime: 2 },
        }
      },
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
    RetroalimentacionModule,
    ImportarProyectoModule,
    ConvocatoriaProyectosModule,
    UsuariosAdminModule,
  ],
  controllers: [EstadoController, PerfilesController],
  providers: [
    // Guard global: con MODO_MIGRACION puesto cierra TODAS las rutas menos
    // /estado, incluidas las de quien ya tiene sesión abierta. Es lo que
    // impide que la base de origen se siga moviendo durante el traslado.
    { provide: APP_GUARD, useClass: MigracionGuard },
  ],
})
export class AppModule {}
