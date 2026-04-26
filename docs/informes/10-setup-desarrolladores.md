# Setup para Desarrolladores — SEP

> **Para:** Rosa, Jhonatan, Javier, Julio, Juliana
> **Líder técnico:** José (`josediazd40z@gmail.com`)
> **Última actualización:** 26 abril 2026

Esta guía te lleva desde **cero hasta tener el proyecto SEP corriendo en tu PC con hot-reload** en menos de 1 hora. Síguela en orden.

---

## 0. Visión general del flujo

```
Tu PC (local)                                 Servidor centralizado
─────────────────                              ──────────────────────
[VSCode]                                       Oracle XE (DB)
   ↓                                                ↑
[pnpm dev → frontend localhost:3000]            cloudflared expone
[pnpm dev → backend localhost:4000]   ◀────────  sepdb.ggpcsena.com
   ↑                                            como TCP a la DB
[cloudflared] (servicio que abre túnel
 transparente a la DB del server)
```

- **Tú trabajas en tu máquina** con `pnpm dev`. Cualquier cambio en código se ve al instante en el navegador (HMR ~200 ms).
- **No tocas Docker.** Eso solo lo hace el líder cuando va a producción.
- **La DB está centralizada** en el servidor. Tú la lees con `SQL Developer` (solo SELECT) y tu backend la usa con permisos completos.

---

## 1. Pre-requisitos — instalar 1 vez

### 1.1 Software

| Herramienta | Versión | Link |
|---|---|---|
| **Node.js** | 22 LTS o superior | https://nodejs.org/ |
| **pnpm** | última | después de Node: `npm install -g pnpm` |
| **Git** | reciente | https://git-scm.com/download/win |
| **VS Code** | última | https://code.visualstudio.com/ |
| **Java JDK** | 17+ | https://adoptium.net/ |
| **SQL Developer** | última | https://www.oracle.com/database/sqldeveloper/ |
| **cloudflared** | última | https://github.com/cloudflare/cloudflared/releases (descarga el `.msi` para Windows) |

### 1.2 Extensiones recomendadas en VS Code

Abre VS Code → `Ctrl + Shift + X` y busca:

- **ESLint** (Microsoft)
- **Tailwind CSS IntelliSense**
- **Prettier - Code formatter**
- **GitLens**

### 1.3 Verificar instalación

Abre PowerShell y corre:

```powershell
node -v       # debe decir v22.x.x
pnpm -v       # debe decir 9.x.x o superior
git --version
java -version # debe decir 17 o más
cloudflared --version
```

Si alguno falla, reinstala antes de seguir.

---

## 2. Configurar acceso a la base de datos del servidor

> **Por qué cloudflared:** la DB del servidor no está expuesta directamente a internet por seguridad. `cloudflared` abre un túnel cifrado al servidor y mapea `sepdb.ggpcsena.com` a un puerto local de tu PC. Una vez configurado como tarea programada, arranca solo cuando enciendes Windows y queda corriendo en background — no haces nada al iniciar el día.

### 2.1 Verifica el puerto local 1521

Antes de nada, comprueba que el puerto 1521 esté libre en tu PC:

```powershell
netstat -ano | findstr :1521
```

- Si **no devuelve nada** → puerto libre, perfecto.
- Si **devuelve una línea** con un PID al final → algo ya usa ese puerto. Mátalo:
  ```powershell
  Stop-Process -Id <PID> -Force
  ```
  O usa el puerto alterno **`11521`** en los siguientes pasos (reemplaza `1521` por `11521` en TODO lo que sigue, incluido el `.env`).

### 2.2 Probar el túnel manualmente

Abre PowerShell (no necesita admin):

```powershell
cloudflared access tcp --hostname sepdb.ggpcsena.com --url localhost:1521
```

Te debe mostrar:
```
INF Start Websocket listener host=localhost:1521
```

Deja esa terminal abierta y abre OTRA PowerShell:
```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 1521
```

Si dice `TcpTestSucceeded : True` → el túnel funciona. Cierra la primera terminal con `Ctrl+C`.

### 2.3 Auto-arranque al encender Windows (recomendado)

PowerShell **como administrador**:

```powershell
mkdir C:\cloudflared -Force

# Script que abre el túnel
@"
@echo off
cloudflared access tcp --hostname sepdb.ggpcsena.com --url localhost:1521
"@ | Out-File C:\cloudflared\sep-tunnel.bat -Encoding ascii

# Tarea programada al iniciar sesión Windows
schtasks /Create /TN "SEP DB Tunnel" /TR "C:\cloudflared\sep-tunnel.bat" /SC ONLOGON /RU "$env:USERNAME" /RL HIGHEST /F
```

Pruébalo (sin reiniciar):
```powershell
schtasks /Run /TN "SEP DB Tunnel"
Start-Sleep 3
Test-NetConnection -ComputerName 127.0.0.1 -Port 1521
```

`TcpTestSucceeded : True` → ya quedó automatizado para siempre. Cuando enciendas el PC, el túnel arrancará solo en background.

### 2.2 Configurar la conexión en SQL Developer

1. Abre **SQL Developer**.
2. Click en el `+` verde para crear una nueva conexión.
3. Llena:
   - **Name:** `SEP Producción (lectura)`
   - **Username:** `SEP_LECTOR`
   - **Password:** `S3p2026__` (te la pasa el líder, después se cambia)
   - **Hostname:** `localhost`
   - **Port:** `1521`
   - **Service name:** `XEPDB1`
4. Click **Test** → debe decir `Status: Success`.
5. Click **Connect**.

✅ Ahora puedes hacer `SELECT` en cualquier tabla. **No puedes INSERT/UPDATE/DELETE/CREATE/ALTER/DROP** — Oracle te dará error `ORA-01031: insufficient privileges` si lo intentas. Eso es intencional.

---

## 3. Clonar el proyecto

### 3.1 Configurar Git con tu identidad

```powershell
git config --global user.name "Tu Nombre Completo"
git config --global user.email "tu_correo@ejemplo.com"
```

### 3.2 Clonar el repo

```powershell
cd C:\Users\<tu_usuario>\Documents\
git clone https://github.com/JoSeLoDiAz/SEP.git
cd SEP
```

### 3.3 Cambiarte a la rama `dev`

```powershell
git checkout dev
git pull
```

`dev` es la rama integradora del equipo. **Nunca trabajes directamente en `dev` ni en `produccion`.**

### 3.4 Instalar dependencias

```powershell
pnpm install
```

Esto baja las dependencias para backend Y frontend en una sola pasada (es un monorepo con `pnpm workspaces`). Dura 2-5 minutos la primera vez.

---

## 4. Configurar variables de entorno

### 4.1 Crea `backend/.env`

Copia `.env.example` a `backend/.env`:

```powershell
Copy-Item .env.example backend/.env
```

Abre `backend/.env` en VS Code y reemplaza los `⚠️` con los valores que te dé el líder. Quedará algo así:

```env
BACKEND_PORT=4000
NODE_ENV=development

ORACLE_USER=SEPLOCAL
ORACLE_PASSWORD=<la_que_te_pase_jose>
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1

JWT_SECRET=DEV_LOCAL_NO_USAR_EN_PROD_ed25519_minimo_64_caracteres_super_random
JWT_EXPIRES_IN=8h

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<correo_que_te_pase>
SMTP_PASS=<password_app>

APP_URL=http://localhost:3000
```

### 4.2 ⚠️ Diferencia clave de credenciales

| Quien las usa | Usuario | Contraseña | Permisos |
|---|---|---|---|
| **Tu backend (`pnpm dev`)** | `SEPLOCAL` | (la del líder) | TODO (INSERT/UPDATE/DELETE/SELECT) — para que tu app funcione |
| **Tú en SQL Developer** | `SEP_LECTOR` | `S3p2026__` | Solo `SELECT` — para consultar datos |

**No uses SEPLOCAL en SQL Developer.** Si lo haces, podrías borrar datos de producción sin querer. Usa `SEP_LECTOR`.

---

## 5. Levantar el proyecto en modo dev

Vas a abrir **2 terminales** (en VS Code: `Ctrl + Shift + ñ` para abrir terminales adicionales):

### Terminal 1 — Backend (NestJS)

```powershell
pnpm --filter backend run start:dev
```

Espera unos 10-15 segundos hasta ver:
```
[Nest] LOG [NestApplication] Nest application successfully started
```

✅ Backend en `http://localhost:4000`. Cualquier cambio en archivos `.ts` del backend → recompila solo y reinicia (~2 segundos).

### Terminal 2 — Frontend (Next.js)

```powershell
pnpm --filter frontend dev
```

Espera unos 5 segundos hasta ver:
```
▲ Next.js 15.x.x
- Local: http://localhost:3000
✓ Ready in 4s
```

✅ Frontend en `http://localhost:3000`. Cualquier cambio en archivos `.tsx`, `.ts`, `.css` → se actualiza el navegador en ~200 ms (Hot Module Replacement).

### Terminal 3 (opcional) — Túnel a la DB si NO automatizaste

Solo aplica si no creaste la tarea programada de la sección 2.3:

```powershell
cloudflared access tcp --hostname sepdb.ggpcsena.com --url localhost:1521
```

Deja esa terminal abierta mientras programes.

---

## 6. Tu primer cambio

Para verificar que todo funciona:

1. Abre `http://localhost:3000` en el navegador.
2. Haz login con tus credenciales SEP.
3. Edita un archivo simple como `frontend/src/app/page.tsx` — cambia un texto.
4. Guarda con `Ctrl + S`.
5. **Mira el navegador**: el cambio aparece automáticamente sin recargar.

🎉 Si lo ves, todo está listo.

---

## 7. Flujo de trabajo con Git

### 7.1 Estructura de ramas

```
produccion ◀── (solo José hace merge a aquí)
    ↑
   dev ◀── (rama integradora del equipo)
    ↑
feature/<tu-nombre>-<descripcion>  ◀── (tu rama personal por feature)
```

### 7.2 Empezar una nueva tarea

```powershell
# Asegúrate de estar en dev y actualizado
git checkout dev
git pull

# Crea tu rama personal con el patrón: feature/<tu-nombre>-<descripcion>
git checkout -b feature/rosa-validacion-rubros
```

**Convenciones de nombre de rama:**
- `feature/rosa-X` → nuevas funcionalidades
- `fix/jhonatan-Y` → arreglar bugs
- `docs/javier-Z` → documentación

### 7.3 Hacer commits durante el día

```powershell
git add <archivos_modificados>
git commit -m "feat: descripción corta del cambio"
```

**Convenciones de mensaje:**
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `refactor:` reestructurar código sin cambiar comportamiento
- `docs:` documentación
- `style:` formato/CSS
- `chore:` tareas (deps, configs)

### 7.4 Subir tu rama y abrir Pull Request

```powershell
git push -u origin feature/rosa-validacion-rubros
```

En GitHub:
1. Verás un botón "Compare & pull request" → clic.
2. **Base:** `dev` ← **Compare:** `feature/rosa-validacion-rubros`
3. Describe qué hiciste y por qué.
4. Asigna a **JoSeLoDiAz** como reviewer.
5. **Espera review.** José revisa y hace merge a `dev`.

### 7.5 Reglas de oro

- ❌ **NO** hagas push directo a `dev` ni a `produccion`.
- ❌ **NO** hagas merge tú a `dev` — solo José aprueba.
- ✅ **SÍ** abre PR para todo cambio.
- ✅ **SÍ** mantén tu rama actualizada con `dev`:
  ```powershell
  git checkout dev
  git pull
  git checkout feature/tu-rama
  git merge dev
  ```

---

## 8. Errores comunes y cómo solucionarlos

### 8.1 `ORA-12541: TNS:no listener` al conectar

→ El túnel `cloudflared` no está corriendo. Verifica:
```powershell
schtasks /Query /TN "SEP DB Tunnel"
Test-NetConnection -ComputerName 127.0.0.1 -Port 1521
```
Si el `Test-NetConnection` dice `False`, lanza la tarea manualmente:
```powershell
schtasks /Run /TN "SEP DB Tunnel"
```

### 8.2 `ORA-01017: invalid username/password`

→ Mal escrita la contraseña en el `.env`. Cuidado con caracteres especiales.

### 8.3 `pnpm install` falla con timeout

→ Red lenta. Reintenta con:
```powershell
pnpm install --network-timeout 600000
```

### 8.4 El frontend muestra error de CORS

→ Backend no levantado o `NEXT_PUBLIC_API_URL` mal configurado en `.env`.

### 8.5 "Port 3000 is already in use"

→ Otro proceso usa el puerto. Mata el proceso:
```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <PID>
```

### 8.6 Hot reload no funciona

→ Cierra todas las terminales, asegúrate de no tener varias instancias del backend o frontend corriendo, y vuelve a levantar.

---

## 9. Comunicación del equipo

| Canal | Para qué |
|---|---|
| **Grupo WhatsApp/Slack** | Dudas rápidas, avisos del día |
| **Issues de GitHub** | Reporte de bugs y features |
| **Pull Requests** | Revisión de código |
| **José directo** | Permisos, contraseñas, despliegues |

---

## 10. Antes de cerrar el día

- [ ] Hiciste commit de tu trabajo
- [ ] Pusheaste tu rama a GitHub
- [ ] Si terminaste algo, abriste PR a `dev`
- [ ] Cerraste las terminales de `pnpm dev` con `Ctrl + C`

---

## Anexo — Comandos de referencia rápida

```powershell
# Levantar el día
git checkout dev && git pull
pnpm --filter backend run start:dev    # Terminal 1
pnpm --filter frontend dev             # Terminal 2

# Hacer cambio
git checkout -b feature/<tu-nombre>-X
# ... editar código ...
git add .
git commit -m "feat: ..."
git push -u origin feature/<tu-nombre>-X
# Abrir PR en GitHub

# Actualizar tu rama con dev
git checkout dev && git pull
git checkout feature/<tu-nombre>-X
git merge dev
```

---

**¿Algo no te quedó claro?** Pregúntale a José antes de improvisar. Mejor 5 minutos preguntando que 5 horas debugging.
