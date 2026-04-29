// Forzar UTC en el proceso Node ANTES de cualquier import que toque fechas
// (oracledb, TypeORM). Si Node corre en una TZ distinta a la BD, el driver
// Oracle aplica una conversión incorrecta y las fechas llegan desplazadas.
// Al fijar TZ=UTC, oracledb interpreta los DATE de la BD (que están en UTC)
// como UTC, y la serialización JSON queda con `Z` correcto.
process.env.TZ = 'UTC'

import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import type { NestExpressApplication } from '@nestjs/platform-express'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Aumentar límite para campos NCLOB grandes (análisis, eslabones, etc.)
  app.useBodyParser('json', { limit: '20mb' })
  app.useBodyParser('urlencoded', { extended: true, limit: '20mb' })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8081',
    ],
    credentials: true,
    exposedHeaders: ['X-New-Token'],
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

  await app.listen(port)
  console.log(`🚀 SEP API corriendo en puerto ${port}`)
  console.log(`📚 Swagger: http://localhost:${port}/docs`)
}
bootstrap()
