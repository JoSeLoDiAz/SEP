import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AuditoriaService } from './auditoria.service'
import { CatalogosEvaluadorService } from './catalogos.service'
import { CertificadoService } from './certificado.service'
import { CicloService } from './ciclo.service'
import { ConvocatoriasController } from './convocatorias.controller'
import { ConvocatoriasService } from './convocatorias.service'
import { EvaluadoresController } from './evaluadores.controller'
import { EvaluadoresService } from './evaluadores.service'
import { FichaPdfService } from './ficha-pdf.service'
import { ReportesEvaluadorService } from './reportes.service'
import { VerificacionController } from './verificacion.controller'
import { TrayectoriaService } from './trayectoria.service'

@Module({
  imports: [AuthModule],
  // ⚠️ El orden importa. `EvaluadoresController` tiene `@Get(':id')` bajo
  // `/evaluadores`, que con Express 5 captura también `/evaluadores/convocatorias`
  // y hace reventar el ParseIntPipe con 400. Registrando primero el controller
  // más específico, sus rutas ganan. (Express 5 usa path-to-regexp v8, que ya
  // no admite restringir el parámetro con regex inline tipo `:id(\\d+)`.)
  controllers: [ConvocatoriasController, EvaluadoresController, VerificacionController],
  providers: [
    EvaluadoresService,
    CatalogosEvaluadorService,
    ConvocatoriasService,
    TrayectoriaService,
    AuditoriaService,
    CicloService,
    CertificadoService,
    ReportesEvaluadorService,
    FichaPdfService,
  ],
  // `AuditoriaService`: el módulo de retroalimentación (fase D) también escribe
  // en el log. `CertificadoService`: la página pública de certificados sirve el
  // PDF del evaluador reusando este generador, para que no existan dos
  // versiones del mismo documento oficial.
  exports: [AuditoriaService, CertificadoService],
})
export class EvaluadoresModule {}
