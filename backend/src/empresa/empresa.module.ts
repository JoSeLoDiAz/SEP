import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EmpresaController } from './empresa.controller'
import { EmpresaService } from './empresa.service'
import { Empresa } from '../auth/entities/empresa.entity'
import { Usuario } from '../auth/entities/usuario.entity'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Empresa, Usuario]),
    AuthModule,
  ],
  controllers: [EmpresaController],
  providers: [EmpresaService],
})
export class EmpresaModule {}
