import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { DataSource } from 'typeorm';

const PDFDocument: new (
  opts?: Record<string, unknown>,
) => any = require('pdfkit');

// Mapeo abreviatura → substring del nombre en TIPODOCUMENTOIDENTIDAD
const TIPO_DOC_MAP: Record<string, string> = {
  CC: 'Ciudadan',
  CE: 'Extranjer',
  TI: 'Tarjeta de Identidad',
  PA: 'Pasaporte',
  NIT: 'NIT',
  RC: 'Registro',
};

const MESES = [
  '',
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

const DIAS_LETRAS = [
  '',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiún',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
  'treinta',
  'treinta y un',
];

function anoEnLetras(a: number): string {
  const UNI = [
    '',
    'un',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciséis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiuno',
    'veintidós',
    'veintitrés',
    'veinticuatro',
    'veinticinco',
    'veintiséis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
  ];
  const DEC = [
    '',
    '',
    'veinte',
    'treinta',
    'cuarenta',
    'cincuenta',
    'sesenta',
    'setenta',
    'ochenta',
    'noventa',
  ];
  const miles = Math.floor(a / 1000);
  const resto = a % 1000;
  const sub = resto % 100;
  let result = miles === 1 ? 'mil' : `${UNI[miles]} mil`;
  if (sub > 0 && sub < 30) {
    result += ` ${UNI[sub]}`;
  } else if (sub >= 30) {
    const d = Math.floor(sub / 10);
    const u = sub % 10;
    result += ` ${DEC[d]}`;
    if (u > 0) result += ` y ${UNI[u]}`;
  }
  return result.trim();
}

// Fila de la tabla pública: campos genéricos porque el evaluador no tiene empresa ni AF
export interface CertificadoPublico {
  consecutivo: number;
  tipo: 'BENEFICIARIO' | 'EVALUADOR';
  tipoNombre: string;
  entidad: string;
  concepto: string;
  detalle: string;
  fecha: string;
  /** Epoch en ms, solo para ordenar. No se pinta. */
  fechaOrden: number;
  codigo: string;
  urlPdf: string;
  personaId: number;
}

const ENTIDAD_EVALUADOR =
  'SENA — Grupo de Gestión para la Productividad y la Competitividad';

@Injectable()
export class CertificadosService {
  constructor(private readonly dataSource: DataSource) {}

  private async findPersonaId(
    tipoDocAbrev: string,
    identificacion: string,
  ): Promise<number | null> {
    const substring = TIPO_DOC_MAP[tipoDocAbrev.toUpperCase()] ?? tipoDocAbrev;
    const rows = await this.dataSource.query(
      `SELECT P.PERSONAID FROM PERSONA P
       JOIN TIPODOCUMENTOIDENTIDAD T ON T.TIPODOCUMENTOIDENTIDADID = P.TIPODOCUMENTOIDENTIDADID
       WHERE UPPER(TO_CHAR(T.TIPODOCUMENTOIDENTIDADNOMBRE)) LIKE UPPER(:param_0)
         AND TO_CHAR(P.PERSONAIDENTIFICACION) LIKE :param_1`,
      [`%${substring}%`, `%${identificacion}%`],
    );
    return rows.length ? (rows[0]['PERSONAID'] as number) : null;
  }

  // Beneficiario y evaluador van juntos: es la misma persona buscando con su cédula
  async buscarPorPersona(tipoDocumento: string, numero: string) {
    const personaId = await this.findPersonaId(tipoDocumento, numero);
    if (!personaId) return [];
    return this.unir(
      await this.listarCertificados(personaId, null),
      await this.listarCertificadosEvaluador(personaId, null),
    );
  }

  // El código puede ser EVIDENCIAVALIDACION o CODIGOVERIFICACION: se consultan ambos
  async buscarPorCodigo(codigo: string) {
    const limpio = codigo.trim();
    if (!limpio) return [];

    const rows = await this.dataSource.query(
      `SELECT P.PERSONAID FROM AFGRUPOBENEFICIARIO AFGB
       JOIN PERSONA P ON P.PERSONAID = AFGB.PERSONAID
       WHERE TO_CHAR(AFGB.EVIDENCIAVALIDACION) LIKE :param_0`,
      [`%${limpio}%`],
    );
    const beneficiario = rows.length
      ? await this.listarCertificados(rows[0]['PERSONAID'] as number, limpio)
      : [];

    // Igualdad y no LIKE: con un prefijo corto se pescarían certificados ajenos
    const evalRows = await this.dataSource.query(
      `SELECT E.PERSONAID FROM EVALUADORCERTIFICADO C
       JOIN EVALUADORPARTICIPACION PA ON PA.PARTICIPACIONID = C.PARTICIPACIONID
       JOIN EVALUADOR E ON E.EVALUADORID = PA.EVALUADORID
       WHERE UPPER(TRIM(C.CODIGOVERIFICACION)) = UPPER(:param_0)`,
      [limpio],
    );
    const evaluador = evalRows.length
      ? await this.listarCertificadosEvaluador(
          evalRows[0]['PERSONAID'] as number,
          limpio,
        )
      : [];

    return this.unir(beneficiario, evaluador);
  }

  private unir(
    beneficiario: CertificadoPublico[],
    evaluador: CertificadoPublico[],
  ): CertificadoPublico[] {
    return [...beneficiario, ...evaluador]
      .sort((a, b) => b.fechaOrden - a.fechaOrden)
      .map((c, i) => ({ ...c, consecutivo: i + 1 }));
  }

  private async listarCertificados(
    personaId: number,
    soloEvidencia: string | null,
  ): Promise<CertificadoPublico[]> {
    let sql = `
      SELECT
        AFGB.AFGRUPOBENEFICIARIOID,
        AFGB.FECHAVALIDACIONINTERVENTOR,
        AFGB.EVIDENCIAVALIDACION,
        AFGB.AFGRUPOBENEFICIARIOIDFIRMA,
        AFGB.AFGRUPOBENEFICIARIOIDLOGO,
        AF.ACCIONFORMACIONNOMBRE,
        E.EMPRESARAZONSOCIAL,
        PR.PROYECTOID,
        AFGB.PERSONAID
      FROM AFGRUPOBENEFICIARIO AFGB
      JOIN AFGRUPO AFG ON AFG.AFGRUPOID = AFGB.AFGRUPOID
      JOIN ACCIONFORMACION AF ON AF.ACCIONFORMACIONID = AFG.ACCIONFORMACIONID
      JOIN PROYECTO PR ON PR.PROYECTOID = AF.PROYECTOID
      JOIN EMPRESA E ON E.EMPRESAID = PR.EMPRESAID
      WHERE AFGB.PERSONAID = :param_0
        AND TRIM(TO_CHAR(AFGB.CERTIFICA)) = 'SI'
        AND TRIM(TO_CHAR(AFGB.VALIDACIONINTERVENTOR)) = 'VERIFICADO'`;

    const params: unknown[] = [personaId];
    if (soloEvidencia) {
      sql += ` AND TO_CHAR(AFGB.EVIDENCIAVALIDACION) LIKE :param_1`;
      params.push(`%${soloEvidencia}%`);
    }
    sql += ` ORDER BY AFGB.FECHAVALIDACIONINTERVENTOR DESC`;

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      sql,
      params,
    );

    const str = (v: unknown) => String(v ?? '').trim();

    return rows.map((r, i) => {
      const id = Number(r['AFGRUPOBENEFICIARIOID']);
      const personaIdFila = Number(r['PERSONAID']);
      const fecha = r['FECHAVALIDACIONINTERVENTOR'] as Date;
      return {
        consecutivo: i + 1,
        tipo: 'BENEFICIARIO' as const,
        tipoNombre: 'Beneficiario',
        entidad: str(r['EMPRESARAZONSOCIAL']),
        concepto: str(r['ACCIONFORMACIONNOMBRE'])
          .toUpperCase()
          .replace('TRANSFERENCIA:', '')
          .trim(),
        detalle: 'Acción de formación',
        fecha: this.formatFecha(fecha),
        fechaOrden: fecha ? new Date(fecha).getTime() : 0,
        codigo: str(r['EVIDENCIAVALIDACION']),
        urlPdf: `/certificados/${id}/pdf?personaId=${personaIdFila}`,
        personaId: personaIdFila,
      };
    });
  }

  // Solo los no anulados: uno anulado no se puede descargar
  private async listarCertificadosEvaluador(
    personaId: number,
    soloCodigo: string | null,
  ): Promise<CertificadoPublico[]> {
    const params: unknown[] = [personaId];
    let filtroCodigo = '';
    if (soloCodigo) {
      filtroCodigo = ` AND UPPER(TRIM(C.CODIGOVERIFICACION)) = UPPER(:param_1)`;
      params.push(soloCodigo);
    }

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT C.CERTIFICADOID, C.ANIO, C.CONSECUTIVO, C.CODIGOVERIFICACION,
              C.FECHAEMISION, C.DATOSSNAPSHOT, E.PERSONAID
         FROM EVALUADORCERTIFICADO C
         JOIN EVALUADORPARTICIPACION PA ON PA.PARTICIPACIONID = C.PARTICIPACIONID
         JOIN EVALUADOR E ON E.EVALUADORID = PA.EVALUADORID
        WHERE E.PERSONAID = :param_0
          AND C.ANULADO = 0${filtroCodigo}
        ORDER BY C.ANIO DESC, C.CONSECUTIVO DESC`,
      params,
    );

    const str = (v: unknown) => String(v ?? '').trim();

    return rows.map((r, i) => {
      // El snapshot guarda rol y convocatoria como estaban al emitir el certificado
      let s: Record<string, unknown> = {};
      try {
        s = JSON.parse(str(r['DATOSSNAPSHOT'])) as Record<string, unknown>;
      } catch {
        /* snapshot ilegible: se muestra el certificado igual */
      }
      const id = Number(r['CERTIFICADOID']);
      const personaIdFila = Number(r['PERSONAID']);
      const fecha = r['FECHAEMISION'] as Date;
      const numero = `${r['ANIO']}-${String(Number(r['CONSECUTIVO'])).padStart(4, '0')}`;
      const rol = str(s['rol']) || 'Evaluador';
      const contexto = str(s['convocatoria']) || str(s['proceso']);

      return {
        consecutivo: i + 1,
        tipo: 'EVALUADOR' as const,
        tipoNombre: 'Evaluador',
        entidad: ENTIDAD_EVALUADOR,
        concepto: [rol.toUpperCase(), contexto.toUpperCase()]
          .filter(Boolean)
          .join(' · '),
        detalle: `Banco de Evaluadores · Certificado N° ${numero}`,
        fecha: this.formatFecha(fecha),
        fechaOrden: fecha ? new Date(fecha).getTime() : 0,
        codigo: str(r['CODIGOVERIFICACION']),
        urlPdf: `/certificados/evaluador/${id}/pdf?personaId=${personaIdFila}`,
        personaId: personaIdFila,
      };
    });
  }

  // Pide personaId además del id: el id es secuencial y solo bastaría para bajar cualquiera
  async pdfEvaluador(
    certificadoId: number,
    personaId: number,
  ): Promise<{ certificadoId: number }> {
    const rows = await this.dataSource.query(
      `SELECT C.CERTIFICADOID, C.ANULADO
         FROM EVALUADORCERTIFICADO C
         JOIN EVALUADORPARTICIPACION PA ON PA.PARTICIPACIONID = C.PARTICIPACIONID
         JOIN EVALUADOR E ON E.EVALUADORID = PA.EVALUADORID
        WHERE C.CERTIFICADOID = :param_0 AND E.PERSONAID = :param_1`,
      [certificadoId, personaId],
    );
    if (!rows.length) throw new NotFoundException('Certificado no encontrado');
    if (Number(rows[0]['ANULADO']) === 1) {
      throw new NotFoundException('Este certificado fue anulado');
    }
    return { certificadoId };
  }

  async generarPdf(
    afGrupoBeneficiarioId: number,
    personaId: number,
  ): Promise<Buffer> {
    const [afgb] = await this.dataSource.query(
      `SELECT AFGB.AFGRUPOBENEFICIARIOID, AFGB.AFGRUPOID, AFGB.EVIDENCIAVALIDACION,
              AFGB.FECHAVALIDACIONINTERVENTOR, AFGB.AFGRUPOBENEFICIARIOIDFIRMA,
              AFGB.AFGRUPOBENEFICIARIOIDLOGO,
              P.PERSONANOMBRES, P.PERSONAPRIMERAPELLIDO, P.PERSONASEGUNDOAPELLIDO,
              P.PERSONAIDENTIFICACION,
              TD.TIPODOCUMENTOIDENTIDADNOMBRE
       FROM AFGRUPOBENEFICIARIO AFGB
       JOIN PERSONA P ON P.PERSONAID = AFGB.PERSONAID
       JOIN TIPODOCUMENTOIDENTIDAD TD ON TD.TIPODOCUMENTOIDENTIDADID = P.TIPODOCUMENTOIDENTIDADID
       WHERE AFGB.AFGRUPOBENEFICIARIOID = :param_0 AND AFGB.PERSONAID = :param_1`,
      [afGrupoBeneficiarioId, personaId],
    );
    if (!afgb) throw new NotFoundException('Certificado no encontrado');

    const [af] = await this.dataSource.query(
      `SELECT AF.ACCIONFORMACIONNOMBRE, AF.PROYECTOID, AF.ACCIONFORMACIONID,
              AF.MODALIDADFORMACIONID, AF.TIPOEVENTOID
       FROM AFGRUPO AFG
       JOIN ACCIONFORMACION AF ON AF.ACCIONFORMACIONID = AFG.ACCIONFORMACIONID
       WHERE AFG.AFGRUPOID = :param_0`,
      [afgb['AFGRUPOID']],
    );

    const [proy] = await this.dataSource.query(
      `SELECT PR.PROYECTOID, PR.PROYECTONOMBRE, PR.EMPRESAID, PR.CONVOCATORIAID,
              C.CONVENIOSNUMERO, C.CONVENIOSID,
              CV.CONVOCATORIANOMBRE
       FROM PROYECTO PR
       LEFT JOIN CONVENIOS C ON C.PROYECTOID = PR.PROYECTOID
       LEFT JOIN CONVOCATORIA CV ON CV.CONVOCATORIAID = PR.CONVOCATORIAID
       WHERE PR.PROYECTOID = :param_0`,
      [af['PROYECTOID']],
    );

    const [empresa] = await this.dataSource.query(
      `SELECT E.EMPRESARAZONSOCIAL, CI.CIUDADNOMBRE
       FROM EMPRESA E
       LEFT JOIN CIUDAD CI ON CI.CIUDADID = E.CIUDADEMPRESAID
       WHERE E.EMPRESAID = :param_0`,
      [proy['EMPRESAID']],
    );

    let programaNombre = '';
    const convocatoriaId = proy?.['CONVOCATORIAID'];
    if (convocatoriaId) {
      const [prog] = await this.dataSource.query(
        `SELECT PG.PROGRAMANOMBRE FROM CONVOCATORIA CV
         JOIN PROGRAMA PG ON PG.PROGRAMAID = CV.PROGRAMAID
         WHERE CV.CONVOCATORIAID = :param_0`,
        [convocatoriaId],
      );
      programaNombre = prog?.['PROGRAMANOMBRE'] ?? '';
    }

    const [tipoEvento] = await this.dataSource.query(
      `SELECT TIPOEVENTONOMBRE FROM TIPOEVENTO WHERE TIPOEVENTOID = :param_0`,
      [af['TIPOEVENTOID']],
    );

    // Las modalidades 5 y 6 del GeneXus suman dos columnas de horas, el resto una
    const [horas] = await this.dataSource.query(
      `SELECT
         SUM(NVL(UNIDADTEMATICAHORASPP,0)   + NVL(UNIDADTEMATICAHORASTP,0))   AS HORAS_PP,
         SUM(NVL(UNIDADTEMATICAHORASPPAT,0) + NVL(UNIDADTEMATICAHORASTPAT,0)) AS HORAS_PAT,
         SUM(NVL(UNIDADTEMATICAHORASPHIB,0) + NVL(UNIDADTEMATICAHORASTHIB,0)) AS HORAS_HIB,
         SUM(NVL(UNIDADTEMATICAHORASPV,0)   + NVL(UNIDADTEMATICAHORASTV,0))   AS HORAS_VIR
       FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :param_0`,
      [af['ACCIONFORMACIONID']],
    );
    const modalidad = Number(af['MODALIDADFORMACIONID'] ?? 1);
    let sumaHoras: number;
    if (modalidad === 5) {
      sumaHoras =
        Number(horas?.['HORAS_PP'] ?? 0) + Number(horas?.['HORAS_VIR'] ?? 0);
    } else if (modalidad === 6) {
      sumaHoras =
        Number(horas?.['HORAS_PAT'] ?? 0) + Number(horas?.['HORAS_VIR'] ?? 0);
    } else {
      const colMap: Record<number, string> = {
        1: 'HORAS_PP',
        2: 'HORAS_PAT',
        3: 'HORAS_HIB',
        4: 'HORAS_VIR',
      };
      sumaHoras = Number(horas?.[colMap[modalidad] ?? 'HORAS_PP'] ?? 0);
    }

    const firmaCertId = afgb['AFGRUPOBENEFICIARIOIDFIRMA'];
    let firma: Record<string, unknown> = {};
    if (firmaCertId) {
      const [f] = await this.dataSource.query(
        `SELECT FIRMACERTIFICADOSNOMBRE, FIRMACERTIFICADOSCARGO, FIRMACERTIFICADOSFIRMA
         FROM FIRMACERTIFICADOS WHERE FIRMACERTIFICADOSID = :param_0`,
        [firmaCertId],
      );
      firma = f ?? {};
    }

    const [proyLogo] = await this.dataSource.query(
      `SELECT PROYECTOLOGOEMPRESA FROM PROYECTO WHERE PROYECTOID = :param_0`,
      [af['PROYECTOID']],
    );

    const logoCapId = afgb['AFGRUPOBENEFICIARIOIDLOGO'];
    let logoCap: Record<string, unknown> = {};
    if (logoCapId) {
      const [lc] = await this.dataSource.query(
        `SELECT LOGOCAPACITADORESLOGO FROM LOGOCAPACITADORES WHERE LOGOCAPACITADORESID = :param_0`,
        [logoCapId],
      );
      logoCap = lc ?? {};
    }

    const [proyLogoBuffer, capacitadorLogoBuffer, firmaImgBuffer] =
      await Promise.all([
        this.readLob(proyLogo?.['PROYECTOLOGOEMPRESA']),
        this.readLob(logoCap?.['LOGOCAPACITADORESLOGO']),
        this.readLob(firma['FIRMACERTIFICADOSFIRMA']),
      ]);

    const str = (v: unknown) => String(v ?? '').trim();
    // NCHAR de Oracle trae espacios internos: normalizar con str() antes de unir
    const nombreCompleto = [
      afgb['PERSONANOMBRES'],
      afgb['PERSONAPRIMERAPELLIDO'],
      afgb['PERSONASEGUNDOAPELLIDO'],
    ]
      .map(str)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    const datosPersona = `con ${str(afgb['TIPODOCUMENTOIDENTIDADNOMBRE'])} No. ${str(afgb['PERSONAIDENTIFICACION'])}`;

    const accionNombre = (af['ACCIONFORMACIONNOMBRE'] as string)
      .toUpperCase()
      .replace('TRANSFERENCIA:', '')
      .trim();

    const empresaNombre = str(empresa?.['EMPRESARAZONSOCIAL']);
    const tipoEventoNombre =
      str(tipoEvento?.['TIPOEVENTONOMBRE']) || 'Conferencia';
    const eventoFinal = tipoEventoNombre.startsWith('Conferencia')
      ? `Asistió a la ${tipoEventoNombre}`
      : `Asistió al ${tipoEventoNombre}`;

    const fechaVal = new Date(afgb['FECHAVALIDACIONINTERVENTOR'] as string);
    const mes = MESES[fechaVal.getMonth() + 1];
    const mesNum = fechaVal.getMonth() + 1;
    const ano = fechaVal.getFullYear();
    const dia = fechaVal.getDate();
    const ciudad = str(empresa?.['CIUDADNOMBRE']) || 'BOGOTÁ';

    const convenioNum = str(proy?.['CONVENIOSNUMERO']);
    const horasTexto =
      sumaHoras === 1
        ? `con una duración de ${sumaHoras} hora`
        : `con una duración de ${sumaHoras} horas`;

    const convocatoriaNombre = str(proy?.['CONVOCATORIANOMBRE']);
    const evidencia = str(afgb['EVIDENCIAVALIDACION']);

    return this.buildPdf({
      nombreCompleto,
      datosPersona,
      empresaNombre,
      eventoFinal,
      accionNombre,
      programaNombre: programaNombre.toUpperCase(),
      convenioNum,
      horasTexto,
      ciudad: ciudad.trim(),
      mes,
      mesNum,
      ano,
      dia,
      convocatoriaNombre,
      firmaNombre: str(firma['FIRMACERTIFICADOSNOMBRE']),
      firmaCargo: str(firma['FIRMACERTIFICADOSCARGO']),
      evidencia,
      proyectoLogoBuf: proyLogoBuffer,
      capacitadorLogoBuf: capacitadorLogoBuffer,
      firmaImgBuf: firmaImgBuffer,
    });
  }

  private buildPdf(d: {
    nombreCompleto: string;
    datosPersona: string;
    empresaNombre: string;
    eventoFinal: string;
    accionNombre: string;
    programaNombre: string;
    convenioNum: string;
    horasTexto: string;
    ciudad: string;
    mes: string;
    mesNum: number;
    ano: number;
    dia: number;
    convocatoriaNombre: string;
    firmaNombre: string;
    firmaCargo: string;
    evidencia: string;
    proyectoLogoBuf: Buffer | null;
    capacitadorLogoBuf: Buffer | null;
    firmaImgBuf: Buffer | null;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // A4 landscape: 841.89 x 595.28 pt  →  1650 x 1150 px @ ~141 DPI
      const mTop = 48,
        mBottom = 48,
        mLeft = 60,
        mRight = 60;
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: mTop, bottom: mBottom, left: mLeft, right: mRight },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const contentW = pageW - mLeft - mRight;
      const cx = { align: 'center' as const, width: contentW };
      const x = mLeft;

      // Formato2 es el fondo con watermark; Formato1 el alternativo
      const fondoPath = join(__dirname, 'assets', 'Formato2.png');
      const fondoAlt = join(__dirname, 'assets', 'Formato1.png');
      const fondo = existsSync(fondoPath)
        ? fondoPath
        : existsSync(fondoAlt)
          ? fondoAlt
          : null;
      if (fondo) {
        doc.image(fondo, 0, 0, { width: pageW, height: pageH });
      }

      const ln = (n = 1) => {
        doc.moveDown(n);
      };
      const bold = (sz: number) => doc.font('Helvetica-Bold').fontSize(sz);
      const regular = (sz: number) => doc.font('Helvetica').fontSize(sz);
      const italic = (sz: number) => doc.font('Helvetica-Oblique').fontSize(sz);
      const write = (text: string, opts = cx) => doc.text(text, x, doc.y, opts);

      // Logos del encabezado, encima del fondo
      const logoH = 75,
        logoY = 20,
        logoMaxW = 120;
      const gap = 15;
      const logos: Buffer[] = [d.proyectoLogoBuf, d.capacitadorLogoBuf].filter(
        Boolean,
      ) as Buffer[];
      if (logos.length > 0) {
        const totalW = logos.length * logoMaxW + (logos.length - 1) * gap;
        // Con dos logos hay que correrlos a la derecha para no tapar el SENA del fondo
        const offset = logos.length > 1 ? 60 : 0;
        let logoX = (pageW - totalW) / 2 + offset;
        for (const logo of logos) {
          try {
            doc.image(logo, logoX, logoY, { fit: [logoMaxW, logoH] });
          } catch {
            /* imagen inválida, omitir */
          }
          logoX += logoMaxW + gap;
        }
      }

      // Texto empieza DEBAJO de los logos
      doc.y = 95;

      bold(16);
      write('El Servicio Nacional de Aprendizaje - SENA');
      if (d.empresaNombre) {
        regular(13);
        write(`y ${d.empresaNombre}`);
      }

      ln(0.9);
      italic(12);
      write('Hacen Constar que');

      ln(0.7);
      bold(20);
      write(d.nombreCompleto);
      ln(0.3);
      regular(12);
      write(d.datosPersona);

      ln(0.7);
      italic(12);
      write(d.eventoFinal);
      ln(0.4);
      bold(13);
      write(d.accionNombre);

      ln(0.9);
      bold(15);
      write(d.programaNombre);

      ln(0.6);
      if (d.convenioNum) {
        regular(11);
        write(
          `Este certificado se expide en el marco del convenio N° ${d.convenioNum} celebrado con el SENA,`,
        );
      }
      italic(11);
      write(d.horasTexto);
      italic(11);
      const diaLetra = DIAS_LETRAS[d.dia] ?? String(d.dia);
      const anoLetra = anoEnLetras(d.ano);
      write(
        `En testimonio de lo anterior, se firma el presente en ${d.ciudad.toUpperCase()}, a los ${diaLetra} (${d.dia}) días del mes de ${d.mes} (${d.mesNum}) de ${anoLetra} (${d.ano})`,
      );

      ln(1);
      italic(11);
      write('Firmado digitalmente por');

      const firmaImgY = doc.y + 4;
      if (d.firmaImgBuf) {
        try {
          doc.image(d.firmaImgBuf, x + contentW / 2 - 200, firmaImgY, {
            fit: [400, 117],
          });
        } catch {
          /* omitir */
        }
        doc.y = firmaImgY + 82;
      } else {
        doc.y += 82;
      }

      if (d.firmaNombre) {
        bold(12);
        write(d.firmaNombre.toUpperCase());
        bold(11);
        write(d.firmaCargo.toUpperCase());
        ln(0.5);
      } else {
        ln(0.4);
      }

      if (d.convocatoriaNombre) {
        italic(9.5);
        write(
          `Las acciones de formación ejecutadas en el marco de la convocatoria ${d.convocatoriaNombre}`,
        );
        italic(9.5);
        write('son gratuitas para los beneficiarios');
        ln(0.5);
      }

      // Bloque de autenticidad anclado al pie de la página
      const left = { align: 'left' as const, width: contentW };
      const autenticidadH = 25;
      doc.y = pageH - mBottom - autenticidadH;
      regular(9.2);
      doc.text(
        'La autenticidad de este documento puede ser verificada en el registro electrónico que se encuentra en la página web https://sep.sena.edu.co/Certificados.aspx bajo el número',
        x,
        doc.y,
        left,
      );
      regular(9.2);
      doc.text(d.evidencia, x, doc.y, left);

      doc.end();
    });
  }

  // El driver de Oracle devuelve el LOB como stream o ya como Buffer

  private readLob(lob: any): Promise<Buffer | null> {
    if (!lob) return Promise.resolve(null);
    if (Buffer.isBuffer(lob)) return Promise.resolve(lob.length ? lob : null);
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      lob.on('data', (c: Buffer) => chunks.push(c));
      lob.on('end', () => {
        lob.close?.(() => {});
        resolve(chunks.length ? Buffer.concat(chunks) : null);
      });
      lob.on('error', () => {
        lob.close?.(() => {});
        resolve(null);
      });
    });
  }

  private formatFecha(d: Date | string): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return `${dt.toLocaleDateString('es-CO')} ${dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  }

  async streamPdf(
    afGrupoBeneficiarioId: number,
    personaId: number,
  ): Promise<Readable> {
    const buf = await this.generarPdf(afGrupoBeneficiarioId, personaId);
    return Readable.from(buf);
  }
}
