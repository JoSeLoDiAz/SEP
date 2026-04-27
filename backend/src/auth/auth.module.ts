import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { MailService } from './mail.service'
import { RefreshTokenInterceptor } from './interceptors/refresh-token.interceptor'
import { Usuario } from './entities/usuario.entity'
import { Empresa } from './entities/empresa.entity'
import { Persona } from './entities/persona.entity'
import { TipoDocumentoIdentidad } from './entities/tipo-documento.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Empresa, Persona, TipoDocumentoIdentidad]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'sep_jwt_secret_2024'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '30m') as '30m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    MailService,
    { provide: APP_INTERCEPTOR, useClass: RefreshTokenInterceptor },
  ],
  exports: [JwtModule, PassportModule, JwtStrategy],
})
export class AuthModule {}
