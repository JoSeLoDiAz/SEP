import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContactosController } from './contactos.controller'
import { ContactosService } from './contactos.service'
import { Empresa } from '../auth/entities/empresa.entity'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [TypeOrmModule.forFeature([Empresa]), AuthModule],
  controllers: [ContactosController],
  providers: [ContactosService],
})
export class ContactosModule {}
