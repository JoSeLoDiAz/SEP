import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UsuariosAdminController } from './usuarios-admin.controller'
import { UsuariosAdminService } from './usuarios-admin.service'

@Module({
  imports: [AuthModule],
  controllers: [UsuariosAdminController],
  providers: [UsuariosAdminService],
})
export class UsuariosAdminModule {}
