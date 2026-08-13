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
import { MiExpedienteController } from './mi-expediente.controller'
import { MiExpedienteGuard } from './mi-expediente.guard'
import { MiExpedienteService } from './mi-expediente.service'
import { ReportesEvaluadorService } from './reportes.service'
import { VerificacionController } from './verificacion.controller'
import { TrayectoriaService } from './trayectoria.service'

@Module({
  imports: [AuthModule],
  // el orden importa: en Express 5 el `@Get(':id')` de EvaluadoresController captura /evaluadores/convocatorias
  controllers: [
    MiExpedienteController, ConvocatoriasController, EvaluadoresController,
    VerificacionController,
  ],
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
    MiExpedienteService,
    MiExpedienteGuard,
  ],
  // los usa retroalimentación (fase D) y la página pública de certificados
  exports: [AuditoriaService, CertificadoService],
})
export class EvaluadoresModule {}
