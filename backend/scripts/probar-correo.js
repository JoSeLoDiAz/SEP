// Comprueba el correo saliente del SEP con la MISMA configuracion que mail.service.ts.
//
//   node scripts/probar-correo.js destino@sena.edu.co
//
// Las credenciales salen del entorno o del .env de al lado; este fichero no las contiene
// y no las imprime. Hace dos cosas por separado, para saber cual de las dos falla:
//   1. verify()  -> hay ruta al relay y la autenticacion es correcta
//   2. sendMail() -> el relay acepta el mensaje para ese destinatario
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

// carga el .env sin depender de dotenv, por si se corre fuera de Nest
for (const f of ['.env', '../.env']) {
  const p = path.join(__dirname, '..', f)
  if (!fs.existsSync(p)) continue
  for (const linea of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const l = linea.trim()
    if (!l || l.startsWith('#') || !l.includes('=')) continue
    const i = l.indexOf('=')
    const k = l.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = l.slice(i + 1).trim()
  }
  break
}

const destino = process.argv[2]
if (!destino) {
  console.error('Falta el destinatario: node scripts/probar-correo.js alguien@sena.edu.co')
  process.exit(1)
}

const host = process.env.SMTP_HOST || 'relay.sena.edu.co'
const port = Number(process.env.SMTP_PORT || 587)
const user = process.env.SMTP_USER || 'sep@sena.edu.co'
const pass = process.env.SMTP_PASS || ''

console.log(`relay:   ${host}:${port}`)
console.log(`usuario: ${user}`)
console.log(`clave:   ${pass ? pass.length + ' caracteres' : 'SIN DEFINIR'}`)
if (!pass) {
  console.error('\nSMTP_PASS no esta definida: sin ella el relay rechaza la autenticacion.')
  process.exit(1)
}

const t = nodemailer.createTransport({
  host, port, secure: false,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
})

;(async () => {
  try {
    await t.verify()
    console.log('\n1. conexion y autenticacion: CORRECTAS')
  } catch (e) {
    console.error('\n1. FALLO antes de enviar:', e.message)
    console.error('   Si dice "Invalid login", la clave o el usuario no son los que espera el relay.')
    console.error('   Si dice "ETIMEDOUT" o "ENOTFOUND", no hay ruta hasta el relay desde esta maquina.')
    process.exit(2)
  }
  try {
    const r = await t.sendMail({
      from: `"SEP — Sistema Especializado de Proyectos" <${user}>`,
      to: destino,
      subject: 'SEP — prueba de correo saliente',
      text: 'Prueba del relay institucional desde el SEP. Si lees esto, el envio de correo funciona.',
    })
    console.log('2. enviado')
    console.log('   aceptados: ' + (r.accepted || []).length + '   rechazados: ' + (r.rejected || []).length)
    console.log('   respuesta del relay: ' + r.response)
  } catch (e) {
    console.error('2. FALLO al enviar:', e.message)
    process.exit(3)
  }
})()
