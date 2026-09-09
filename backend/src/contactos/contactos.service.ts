import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Empresa } from '../auth/entities/empresa.entity'

const PROYECTO_SIN_ASIGNAR = 1

export interface ContactoDto {
  nombre: string
  cargo: string
  correo: string
  telefono?: string
  documento?: string
  tipoIdentificacionId?: number | null
  proyectoId?: number | null
}

@Injectable()
export class ContactosService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepo: Repository<Empresa>,
    private readonly dataSource: DataSource,
  ) {}

  private async getEmpresaId(email: string): Promise<number> {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    return empresa.empresaId
  }

  async getProyectos(email: string) {
    const empresaId = await this.getEmpresaId(email)
    try {
      const rows = await this.dataSource.query(
        `SELECT PROYECTOID      AS "proyectoId",
                PROYECTONOMBRE  AS "proyectoNombre"
           FROM PROYECTO
          WHERE EMPRESAID = :1
          ORDER BY PROYECTOID ASC`,
        [empresaId],
      )
      return rows
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async getTiposDoc() {
    try {
      const rows = await this.dataSource.query(
        `SELECT TIPODOCUMENTOIDENTIDADID     AS "id",
                TRIM(TIPODOCUMENTOIDENTIDADNOMBRE) AS "nombre"
           FROM TIPODOCUMENTOIDENTIDAD
          WHERE TIPODOCUMENTOIDENTIDADPERSONA = 1
          ORDER BY TIPODOCUMENTOIDENTIDADNOMBRE ASC`,
      )
      return rows
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async listar(email: string) {
    const empresaId = await this.getEmpresaId(email)
    try {
      const rows = await this.dataSource.query(
        `SELECT c.CONTACTOEMPRESAID           AS "contactoId",
                c.CONTACTOEMPRESANOMBRE       AS "nombre",
                c.CONTACTOEMPRESACARGO        AS "cargo",
                c.CONTACTOEMPRESACORREO       AS "correo",
                c.CONTACTOEMPRESATELEFONO     AS "telefono",
                c.CONTACTOEMPRESADOCUMENTO    AS "documento",
                c.TIPOIDENTIFICACIONCONTACTOP AS "tipoIdentificacionId",
                c.PROYECTOIDCONTACTOS         AS "proyectoId",
                CASE WHEN c.PROYECTOIDCONTACTOS = ${PROYECTO_SIN_ASIGNAR} OR c.PROYECTOIDCONTACTOS IS NULL
                     THEN NULL
                     ELSE p.PROYECTONOMBRE
                END                           AS "proyectoNombre"
           FROM CONTACTOEMPRESA c
           LEFT JOIN PROYECTO p ON p.PROYECTOID = c.PROYECTOIDCONTACTOS
          WHERE c.EMPRESAIDCONTACTO = :1
          ORDER BY c.CONTACTOEMPRESAID ASC`,
        [empresaId],
      )
      return rows
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async registrar(email: string, dto: ContactoDto) {
    const empresaId = await this.getEmpresaId(email)
    const proyectoId = dto.proyectoId ?? PROYECTO_SIN_ASIGNAR
    try {
      await this.dataSource.query(
        `INSERT INTO CONTACTOEMPRESA
           (EMPRESAIDCONTACTO, CONTACTOEMPRESANOMBRE, CONTACTOEMPRESACARGO,
            CONTACTOEMPRESACORREO, CONTACTOEMPRESATELEFONO, CONTACTOEMPRESADOCUMENTO,
            TIPOIDENTIFICACIONCONTACTOP, PROYECTOIDCONTACTOS)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8)`,
        [empresaId, dto.nombre, dto.cargo, dto.correo,
         dto.telefono ?? null, dto.documento ?? null,
         dto.tipoIdentificacionId ?? null, proyectoId],
      )
      return { message: 'Contacto registrado correctamente' }
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async actualizar(email: string, contactoId: number, dto: ContactoDto) {
    const empresaId = await this.getEmpresaId(email)
    const proyectoId = dto.proyectoId ?? PROYECTO_SIN_ASIGNAR
    try {
      await this.dataSource.query(
        `UPDATE CONTACTOEMPRESA
            SET CONTACTOEMPRESANOMBRE       = :1,
                CONTACTOEMPRESACARGO        = :2,
                CONTACTOEMPRESACORREO       = :3,
                CONTACTOEMPRESATELEFONO     = :4,
                CONTACTOEMPRESADOCUMENTO    = :5,
                TIPOIDENTIFICACIONCONTACTOP = :6,
                PROYECTOIDCONTACTOS         = :7
          WHERE CONTACTOEMPRESAID = :8
            AND EMPRESAIDCONTACTO = :9`,
        [dto.nombre, dto.cargo, dto.correo,
         dto.telefono ?? null, dto.documento ?? null,
         dto.tipoIdentificacionId ?? null, proyectoId,
         contactoId, empresaId],
      )
      return { message: 'Contacto actualizado correctamente' }
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async eliminar(email: string, contactoId: number) {
    const empresaId = await this.getEmpresaId(email)
    try {
      await this.dataSource.query(
        `DELETE FROM CONTACTOEMPRESA
          WHERE CONTACTOEMPRESAID = :1
            AND EMPRESAIDCONTACTO = :2`,
        [contactoId, empresaId],
      )
      return { message: 'Contacto eliminado correctamente' }
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }
}
