import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { Empresa } from '../auth/entities/empresa.entity'
import { ConveniosController } from './convenios.controller'
import { ConveniosService } from './convenios.service'

@Module({
  imports: [TypeOrmModule.forFeature([Empresa]), AuthModule],
  controllers: [ConveniosController],
  providers: [ConveniosService],
})
export class ConveniosModule {}
