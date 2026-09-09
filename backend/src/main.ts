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
import { AppModule } from './app.module'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { UploadErrorFilter } from './common/filters/upload-error.filter'
import { OracleErrorFilter } from './common/filters/oracle-error.filter'

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

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8081',
    ],
    credentials: true,
    // sin exponer Content-Disposition el navegador lo oculta cross-origin y la descarga pierde el nombre
    exposedHeaders: ['X-New-Token', 'Content-Disposition'],
  })

  const config = new DocumentBuilder()
    .setTitle('SEP Local API')
    .setDescription('API del Sistema Especializado de Proyectos — GGPC SENA')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))

  const configService = app.get(ConfigService)
  const port = configService.get<number>('BACKEND_PORT', 4000)

  // deben superar el keepalive de nginx (60s) o nginx reusa conexiones que Node ya cerró
  const server = app.getHttpServer()
  server.keepAliveTimeout = 75_000
  server.headersTimeout = 80_000

  await app.listen(port)
  console.log(`🚀 SEP API corriendo en puerto ${port}`)
  console.log(`📚 Swagger: http://localhost:${port}/docs`)
}
bootstrap()
