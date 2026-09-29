// v66 — reclasifica los 20 soportes de experiencia a donde pertenecen.
// Cada destino sale de leer el PDF, no del anio que traia el registro.
// Uso: node v66.js            -> ensayo, no escribe nada
//      node v66.js --aplicar  -> escribe y hace commit
const fs = require('fs'), path = require('path')
const RAIZ = 'c:/Users/josed/Desktop/SEP/SEP_APP'
const oracledb = require(path.join(RAIZ, 'backend/node_modules/oracledb'))
const APLICAR = process.argv.includes('--aplicar')
const env = {}
for (const l of fs.readFileSync(path.join(RAIZ, 'backend/.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

// Correcciones que pidio el auditor tras releer el PDF:
//  - 484: el titulo real es ESTRUCTURACION (la S de mas era artefacto de extraccion)
//  - 411: el emisor es la Universidad del Rosario; lo demas del encabezado son
//         dos unidades distintas unidas por una "y", no parte del nombre
const CORRECCIONES = {
  484: { titulo: 'ESTRUCTURACIÓN DE PROYECTOS FORMATIVOS' },
  411: { institucion: 'UNIVERSIDAD DEL ROSARIO' },
  // mismo emisor y mismo encabezado que el 411: lo que sigue a la "y" son otras
  // dos unidades de la universidad, no parte de su nombre
  315: { institucion: 'UNIVERSIDAD DEL ROSARIO' },
}

const clas = JSON.parse(fs.readFileSync(path.join(__dirname, 'clasificacion.json'), 'utf8'))
  .map(f => ({ ...f, ...(CORRECCIONES[f.documentoId] ?? {}) }))

const fechaSolo = v => {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const recorta = (v, n) => v == null ? null : String(v).trim().slice(0, n)

;(async () => {
  const c = await oracledb.getConnection({ user: env.ORACLE_USER, password: env.ORACLE_PASSWORD, connectString: env.ORACLE_CONNECT_STRING })
  const q = async (s, b = []) => (await c.execute(s, b, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows

  const tipoCertif = (await q(
    `SELECT TIPODOCUMENTOEVALID AS "id" FROM TIPODOCUMENTOEVAL WHERE CODIGO = 'CERTIFICADO_PARTICIPACION'`))[0].id

  // respaldo completo (sin el BLOB, que no se toca en los que solo cambian de tipo)
  const respaldo = await q(
    `SELECT DOCUMENTOID AS "documentoId", EVALUADORID AS "evaluadorId",
            TIPODOCUMENTOEVALID AS "tipoDocumentoEvalId", DOCUMENTODESCRIPCION AS "descripcion",
            ANIOREFERENCIA AS "anioReferencia", PARTICIPACIONID AS "participacionId",
            ARCHIVONOMBRE AS "archivoNombre", ARCHIVOMIME AS "mime",
            DBMS_LOB.GETLENGTH(ARCHIVOPDF) AS "bytes"
       FROM EVALUADORDOCUMENTO WHERE TIPODOCUMENTOEVALID IN (4, 5) ORDER BY DOCUMENTOID`)
  fs.writeFileSync(path.join(RAIZ, 'docs/migraciones/respaldo-v66.json'),
    JSON.stringify({ documentos: respaldo, clasificacion: clas }, null, 2))
  console.log(`respaldo de ${respaldo.length} documentos guardado`)
  const bytesPorDoc = new Map(respaldo.map(r => [Number(r.documentoId), Number(r.bytes || 0)]))

  console.log(`\n=== ${APLICAR ? 'APLICANDO' : 'ENSAYO (no escribe)'} ===\n`)
  const hecho = { EXPERIENCIA: 0, ESTUDIO: 0, CERTIFICADO_PARTICIPACION: 0 }

  for (const f of clas) {
    const orig = (await q(
      `SELECT EVALUADORID AS "ev", ARCHIVOPDF AS "pdf", ARCHIVOMIME AS "mime", ARCHIVONOMBRE AS "arch"
         FROM EVALUADORDOCUMENTO WHERE DOCUMENTOID = :1`, [f.documentoId]))[0]
    if (!orig) { console.log(`  doc ${f.documentoId}: ya no esta, se salta`); continue }
    const buf = orig.pdf ? await orig.pdf.getData() : null
    const ev = Number(orig.ev)

    if (f.destino === 'EXPERIENCIA') {
      console.log(`  doc ${f.documentoId} ev=${ev} -> EXPERIENCIA  "${recorta(f.cargo, 60)}" @ ${recorta(f.entidad, 45)}  ${f.fechaInicio ?? 'sin fecha'} -> ${f.fechaFin ?? 'sin fecha'}`)
      if (APLICAR) {
        const id = Number((await q(`SELECT EVALUADOREXPERIENCIA_SEQ.NEXTVAL AS "n" FROM dual`))[0].n)
        await c.execute(
          `INSERT INTO EVALUADOREXPERIENCIA
             (EXPERIENCIAID, EVALUADORID, CARGOEXP, ENTIDADEXP, FECHAINICIO, FECHAFIN,
              ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE, USUARIOCREACION, FECHACARGUE)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, SYSDATE)`,
          [id, ev, recorta(f.cargo, 200), recorta(f.entidad, 200),
           fechaSolo(f.fechaInicio), fechaSolo(f.fechaFin),
           buf, orig.mime, recorta(orig.arch, 200), 'migracion v66'])
        await c.execute(`DELETE FROM EVALUADORDOCUMENTO WHERE DOCUMENTOID = :1`, [f.documentoId])
      }
      hecho.EXPERIENCIA++

    } else if (f.destino === 'ESTUDIO') {
      console.log(`  doc ${f.documentoId} ev=${ev} -> ESTUDIO tipo ${f.tipoEstudioId}  "${recorta(f.titulo, 60)}" @ ${recorta(f.institucion, 45)}  grado ${f.fechaGrado ?? 'sin fecha'}`)
      if (APLICAR) {
        const id = Number((await q(`SELECT EVALUADORESTUDIO_SEQ.NEXTVAL AS "n" FROM dual`))[0].n)
        await c.execute(
          `INSERT INTO EVALUADORESTUDIO
             (ESTUDIOID, EVALUADORID, TIPOESTUDIOID, ESTUDIOTITULO, INSTITUCION, FECHAGRADO,
              ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE, USUARIOCREACION, FECHACARGUE)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, SYSDATE)`,
          [id, ev, Number(f.tipoEstudioId ?? 5), recorta(f.titulo, 200), recorta(f.institucion, 200),
           fechaSolo(f.fechaGrado), buf, orig.mime, recorta(orig.arch, 200), 'migracion v66'])
        await c.execute(`DELETE FROM EVALUADORDOCUMENTO WHERE DOCUMENTOID = :1`, [f.documentoId])
      }
      hecho.ESTUDIO++

    } else if (f.destino === 'CERTIFICADO_PARTICIPACION') {
      console.log(`  doc ${f.documentoId} ev=${ev} -> CERTIFICADO_PARTICIPACION  anio ${f.anioReferencia ?? 'sin anio'}  (se queda como documento, cambia de tipo)`)
      if (APLICAR) {
        await c.execute(
          `UPDATE EVALUADORDOCUMENTO SET TIPODOCUMENTOEVALID = :1, ANIOREFERENCIA = :2
            WHERE DOCUMENTOID = :3`,
          [tipoCertif, f.anioReferencia ?? null, f.documentoId])
      }
      hecho.CERTIFICADO_PARTICIPACION++
    }
  }

  console.log(`\n  experiencia: ${hecho.EXPERIENCIA}  estudios: ${hecho.ESTUDIO}  certificados: ${hecho.CERTIFICADO_PARTICIPACION}`)

  if (APLICAR) {
    // ya no queda nada de tipo 5: se archiva, como se hizo con el 4 en la v48
    await c.execute(`UPDATE TIPODOCUMENTOEVAL SET ACTIVO = 0 WHERE CODIGO = 'EXPERIENCIA_PROYECTOS'`)
    await c.commit()
    console.log('\n  EXPERIENCIA_PROYECTOS archivado (ACTIVO = 0)')

    console.log('\n=== comprobacion ===')
    const q1 = await q(`SELECT COUNT(*) AS "n" FROM EVALUADORDOCUMENTO WHERE TIPODOCUMENTOEVALID IN (4, 5)`)
    console.log(`  documentos que quedan en tipo 4/5: ${q1[0].n}`)
    const q2 = await q(`SELECT USUARIOCREACION AS "u", COUNT(*) AS "n" FROM EVALUADOREXPERIENCIA WHERE USUARIOCREACION = 'migracion v66' GROUP BY USUARIOCREACION`)
    console.log(`  filas nuevas en EVALUADOREXPERIENCIA: ${q2[0]?.n ?? 0}`)
    const q3 = await q(`SELECT COUNT(*) AS "n" FROM EVALUADORESTUDIO WHERE USUARIOCREACION = 'migracion v66'`)
    console.log(`  filas nuevas en EVALUADORESTUDIO: ${q3[0].n}`)
    const q4 = await q(`SELECT COUNT(*) AS "n" FROM EVALUADOREXPERIENCIA WHERE EVALUADORID = 110`)
    console.log(`  experiencia de Ana Fatiniza (ev 110), que tenia cero: ${q4[0].n}`)
    // ningun archivo se puede haber perdido por el camino
    const q5 = await q(
      `SELECT SUM(DBMS_LOB.GETLENGTH(ARCHIVOPDF)) AS "b" FROM EVALUADOREXPERIENCIA WHERE USUARIOCREACION = 'migracion v66'`)
    const q6 = await q(
      `SELECT SUM(DBMS_LOB.GETLENGTH(ARCHIVOPDF)) AS "b" FROM EVALUADORESTUDIO WHERE USUARIOCREACION = 'migracion v66'`)
    const movidos = clas.filter(f => f.destino !== 'CERTIFICADO_PARTICIPACION')
    const esperado = movidos.reduce((t, f) => t + (bytesPorDoc.get(f.documentoId) ?? 0), 0)
    const real = Number(q5[0].b || 0) + Number(q6[0].b || 0)
    console.log(`  bytes de archivo: esperados ${esperado}, movidos ${real} ${esperado === real ? '(coinciden)' : '<-- NO COINCIDEN'}`)
    const q7 = await q(`SELECT ACTIVO AS "a" FROM TIPODOCUMENTOEVAL WHERE CODIGO = 'EXPERIENCIA_PROYECTOS'`)
    console.log(`  EXPERIENCIA_PROYECTOS activo: ${q7[0].a}`)
  } else {
    console.log('\n  (ensayo: no se escribio nada. correr con --aplicar)')
  }

  await c.close()
})().catch(e => console.log('ERR', e.message))
