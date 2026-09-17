// UTC antes de importar oracledb/TypeORM: si no, el driver desplaza los DATE
process.env.TZ = 'UTC'

// LOB completos con la fila: como Lob hay que leerlos después y TypeORM ya devolvió la conexión al pool
// eslint-disable-next-line @typescript-eslint/no-require-imports
const oracledb = require('oracledb') as {
  fetchAsString: number[]; CLOB: number
  fetchAsBuffer: number[]; BLOB: number
}
oracledb.fetchAsString = [oracledb.CLOB]
oracledb.fetchAsBuffer = [oracledb.BLOB]

import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { DataSource } from 'typeorm'
import { AppModule } from './app.module'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { UploadErrorFilter } from './common/filters/upload-error.filter'
import { OracleErrorFilter } from './common/filters/oracle-error.filter'
import { enMigracion } from './common/migracion.guard'
import { triggersDeId } from './common/db/ids'
import { fijarMotor } from './common/db/motor'
import { envolverParaPostgres } from './common/db/postgres-runner'
import { fijarDocumentosEnDisco } from './common/documentos/documentos-disco'
import { resolverPerfiles } from './common/perfiles'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // límite alto por los NCLOB grandes (análisis, eslabones)
  app.useBodyParser('json', { limit: '20mb' })
  app.useBodyParser('urlencoded', { extended: true, limit: '20mb' })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Nest recorre los filtros al revés: el de Oracle va primero para aplicarse de último
  app.useGlobalFilters(new OracleErrorFilter(), new UploadErrorFilter())

  const extraOrigins = [
    process.env.APP_URL,
    'https://pre-sep.sena.edu.co',
    'https://sep.sena.edu.co',
  ].filter((v): v is string => !!v && v.trim() !== '')

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8081',
      ...extraOrigins,
    ],
    credentials: true,
    // sin exponer Content-Disposition el navegador lo oculta cross-origin y la descarga pierde el nombre
    exposedHeaders: ['X-New-Token', 'Content-Disposition'],
  })

  const configService = app.get(ConfigService)

  // Lo que cambia de una base a otra se lee al arrancar: qué tablas tienen trigger de id (en el Exadata, los de
  // GeneXus) y el id del perfil gestor de evaluadores (15 en el XE, 103 en el Exadata). Si no se puede, no arranca:
  // adivinar sería peor.
  const ds = app.get(DataSource)
  // El motor se fija antes de la primera consulta: de él dependen el traductor de SQL y quién pone la llave en un
  // INSERT. Con DB_TIPO en oracle (lo de hoy) no se envuelve nada y el SQL viaja tal cual.
  const motor = fijarMotor(configService.get<string>('DB_TIPO'))
  if (motor === 'postgres') envolverParaPostgres(ds)

  // Los documentos pueden leerse del volumen de archivos en vez de como BLOB. Apagado por defecto, y si un archivo
  // no está, la lectura vuelve al BLOB: encenderlo nunca deja a nadie sin su documento.
  const raizDocumentos = fijarDocumentosEnDisco(
    configService.get<string>('DOCUMENTOS_EN_DISCO'),
    configService.get<string>('DOCUMENTOS_RUTA'),
  )
  if (raizDocumentos) console.log(`📁 Documentos desde disco: ${raizDocumentos}`)

  const triggers = await triggersDeId(ds)
  const perfiles = await resolverPerfiles(ds, configService.get<string>('PERFIL_GESTOR_EVALUADORES'))
  console.log(
    `🧭 Triggers de id: ${triggers.size} tablas · perfil gestor de evaluadores: ${perfiles.gestorEvaluadores} (${perfiles.origen})`,
  )

  // Swagger se monta como middleware de Express, así que el guard global de
  // migración NO lo cubre: durante la pausa quedaba sirviendo 200 con el mapa
  // completo de la API. No deja escribir, pero "no accesible" es no accesible.
  if (!enMigracion(configService)) {
    const config = new DocumentBuilder()
      .setTitle('SEP Local API')
      .setDescription('API del Sistema Especializado de Proyectos — GGPC SENA')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))
  }
  const port = configService.get<number>('BACKEND_PORT', 4000)

  // deben superar el keepalive de nginx (60s) o nginx reusa conexiones que Node ya cerró
  const server = app.getHttpServer()
  server.keepAliveTimeout = 75_000
  server.headersTimeout = 80_000

  await app.listen(port)
  console.log(`🚀 SEP API corriendo en puerto ${port}`)
  if (enMigracion(configService)) {
    console.log('⏸  EN MIGRACIÓN: solo responde /estado. Se quita con MODO_MIGRACION.')
  } else {
    console.log(`📚 Swagger: http://localhost:${port}/docs`)
  }
}
bootstrap()
