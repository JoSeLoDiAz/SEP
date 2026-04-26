# Setup del Servidor para Equipo Multi-Dev — SEP

> **Para:** Josse (líder técnico — solo tú haces estos pasos)
> **Última actualización:** 26 abril 2026

Esta guía complementa `10-setup-desarrolladores.md`. Aquí están los pasos **del lado del servidor** que TÚ tienes que hacer una vez para que tus 5 devs puedan trabajar en paralelo desde sus PCs.

---

## Resumen de lo que vas a configurar

1. ✅ Crear usuario `SEP_LECTOR` en Oracle (script SQL ya creado)
2. ✅ Exponer Oracle al equipo vía Cloudflare Tunnel TCP (`sepdb.ggpcsena.com`)
3. ✅ Generar `cert.pem` para repartir a cada dev
4. ✅ Setear protección de ramas en GitHub
5. ✅ Cambiar la rama default a `produccion`
6. ✅ Pasarle a cada dev: usuario SSH (no aplica ya), contraseñas, cert.pem

---

## 1. Crear el usuario lector en Oracle

En la VM del server (Hyper-V, Ubuntu):

```bash
# Copia el script al container de Oracle
docker cp /opt/sep/SEPLocal/docs/migraciones/v9_usuario_lector_devs.sql oracle-xe:/tmp/

# Ejecuta el script como SEPLOCAL (reemplaza <CLAVE_SEPLOCAL> por la real)
docker exec -it oracle-xe sqlplus SEPLOCAL/<CLAVE_SEPLOCAL>@localhost:1521/XEPDB1 @/tmp/v9_usuario_lector_devs.sql
```

> **Antes de ejecutar:** edita el script y reemplaza el placeholder `<CLAVE_INICIAL>` por la contraseña que usarás para `SEP_LECTOR`. **No commitees el script con la contraseña real.**

Al terminar te muestra los privilegios concedidos y el resultado esperado. Cuando estés en producción real, rota la contraseña con:

```sql
ALTER USER SEP_LECTOR IDENTIFIED BY "<NuevaClaveMasFuerte>";
```

### Verificación rápida

```bash
docker exec -it oracle-xe sqlplus SEP_LECTOR/<CLAVE_LECTOR>@localhost:1521/XEPDB1
```
```sql
-- Esto debe funcionar
SELECT COUNT(*) FROM USUARIO;

-- Esto debe FALLAR con ORA-01031
DELETE FROM USUARIO WHERE USUARIOID = 1;

EXIT;
```

---

## 2. Exponer Oracle vía Cloudflare Tunnel TCP

Ya tienes `cloudflared` corriendo en la VM (lo usas para `sep.ggpcsena.com` y `ssh.ggpcsena.com`). Solo agregamos una ruta TCP nueva.

### 2.1 Editar la config de cloudflared

```bash
sudo nano /etc/cloudflared/config.yml
```

Tu archivo se ve algo así:

```yaml
tunnel: <tu-tunnel-id>
credentials-file: /etc/cloudflared/<tu-tunnel-id>.json

ingress:
  - hostname: sep.ggpcsena.com
    service: http://localhost:8080
  - hostname: ssh.ggpcsena.com
    service: ssh://localhost:22
  - service: http_status:404
```

**Agrega la entrada de Oracle** ANTES del `service: http_status:404` (el orden importa):

```yaml
ingress:
  - hostname: sep.ggpcsena.com
    service: http://localhost:8080
  - hostname: ssh.ggpcsena.com
    service: ssh://localhost:22
  - hostname: sepdb.ggpcsena.com         # ← NUEVO
    service: tcp://localhost:1521        # ← NUEVO
  - service: http_status:404
```

Guarda con `Ctrl + O`, `Enter`, `Ctrl + X`.

### 2.2 Crear el DNS record en Cloudflare

Opción A — automática (recomendada):
```bash
sudo cloudflared tunnel route dns <tu-tunnel-id> sepdb.ggpcsena.com
```

Opción B — manualmente en el dashboard de Cloudflare:
1. DNS → Records → Add record
2. Type: `CNAME`
3. Name: `sepdb`
4. Target: `<tu-tunnel-id>.cfargotunnel.com`
5. Proxy: ✅ activado

### 2.3 Reiniciar cloudflared

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

Debe mostrar `active (running)` y en los logs verás:
```
INF Registered tunnel connection ... hostnames=[..., sepdb.ggpcsena.com, ...]
```

### 2.4 Verificar desde tu propia PC

Antes de avisar a los devs:

```powershell
# Instala cloudflared en tu Windows si no lo tienes
# Descarga: https://github.com/cloudflare/cloudflared/releases

# Abre un túnel de prueba
cloudflared access tcp --hostname sepdb.ggpcsena.com --url localhost:1521
```

En otra terminal:
```powershell
# Si tienes SQL Developer, prueba conectar a localhost:1521 con SEP_LECTOR
# O usa telnet/Test-NetConnection:
Test-NetConnection -ComputerName localhost -Port 1521
# TcpTestSucceeded : True
```

✅ Si funciona, los devs podrán hacer lo mismo.

---

## 3. Sobre certificados (no aplica con `cloudflared access tcp`)

Como expusiste el TCP de Oracle como **public hostname** en el ingress del túnel, los devs **no necesitan `cert.pem`**. Solo necesitan:

1. Tener `cloudflared` instalado en su PC.
2. Ejecutar `cloudflared access tcp --hostname sepdb.ggpcsena.com --url localhost:1521`.

Internamente `cloudflared access` usa la conexión pública del tunnel sin requerir credenciales por dev. La seguridad la da:

- La contraseña de SEP_LECTOR (solo lectura)
- La contraseña de SEPLOCAL (escritura) que solo los devs autorizados conocen
- TLS end-to-end de Cloudflare

Si en el futuro quieres añadir una capa extra (ej. requerir login con email del dev antes de abrir el túnel), creas una política de **Cloudflare Access** apuntando a `sepdb.ggpcsena.com`. Eso es opcional y puede esperar.

---

## 4. Configurar el repo de GitHub

### 4.1 Push de las ramas

Ya estás listo (Claude lo hace en el siguiente paso del chat). El push incluye:
- `produccion` (renombrada desde `main`)
- `dev` (rama integradora nueva)

### 4.2 Cambiar la rama default a `produccion` en GitHub

**Manualmente** en GitHub.com:
1. Ve a https://github.com/JoSeLoDiAz/SEP/settings
2. En la sección "Default branch" → ícono de flechas
3. Cambia de `main` a `produccion`
4. Guarda.
5. (Opcional) En la sección "Branches" → puedes borrar `main` después.

### 4.3 Proteger las ramas

Settings → Branches → Add rule:

**Para `produccion`:**
- Pattern: `produccion`
- ✅ Require pull request before merging
- ✅ Require approvals → 1
- ✅ Restrict who can push → solo tú

**Para `dev`:**
- Pattern: `dev`
- ✅ Require pull request before merging
- ✅ Require approvals → 1
- ✅ Restrict who can push → solo tú

### 4.4 Invitar a los devs como colaboradores

Settings → Collaborators and teams → Add people → invita por correo:
- Rosa
- Jhonatan
- Javier
- Julio
- Juliana

Rol recomendado: **Write** (pueden hacer push a sus ramas y abrir PRs, pero no mergear gracias a la protección).

---

## 5. Lista para entregar a cada dev

Pásale a cada uno (Bitwarden / pendrive — NO Slack ni email):

1. ✅ La guía: link a `docs/informes/10-setup-desarrolladores.md`
2. ✅ La contraseña de `SEPLOCAL` (para su `.env` del backend)
3. ✅ La contraseña de `SEP_LECTOR` (para SQL Developer)
4. ✅ Credenciales SMTP si las van a necesitar (las que tengas en `backend/.env`)

> Las contraseñas se entregan **solo por canal seguro** (Bitwarden, pendrive, llamada). Nunca por Slack, email ni en commits del repo.

**No requieres entregar `cert.pem` ni configuración especial** — con cloudflared instalado en la PC del dev y los pasos de la guía, queda funcional.

---

## 6. Tu workflow de despliegue a producción

Cuando `dev` esté estable y quieras ponerlo en `sep.ggpcsena.com`:

```bash
# En tu PC local
git checkout produccion
git pull
git merge dev
git push origin produccion

# En el servidor (VM Hyper-V)
ssh sepadmin@ssh.ggpcsena.com
cd /opt/sep/SEPLocal
git checkout produccion
git pull
docker compose up -d --build
bash reload-nginx.sh
```

---

## 7. Mantenimiento periódico

### 7.1 Backup diario de la DB

```bash
sudo crontab -e
```
Agrega:
```
0 2 * * * docker exec oracle-xe sh -c 'expdp SEPLOCAL/$SEPLOCAL_PASS@XEPDB1 schemas=SEPLOCAL directory=DATA_PUMP_DIR dumpfile=sep_$(date +\%Y\%m\%d).dmp logfile=sep_backup.log' 2>> /var/log/oracle-backup.log
```

### 7.2 Cambiar contraseñas cada 90 días

```sql
ALTER USER SEPLOCAL IDENTIFIED BY "<nueva>";
ALTER USER SEP_LECTOR IDENTIFIED BY "<nueva>";
```

Avisa a los devs por canal seguro y que actualicen su `.env`.

### 7.3 Revocar acceso a un dev que sale

1. GitHub → Settings → Collaborators → Remove
2. SI usabas SSH (no aplica ahora), eliminar su cuenta `userdel devN -r`
3. Si compartían `cert.pem`, regenera uno nuevo y pásalo a los demás
4. Cambia la contraseña de `SEPLOCAL`

---

## 8. Costos y escalabilidad

| Recurso | Tope actual | Cuando preocuparse |
|---|---|---|
| Cloudflare Tunnel | ilimitado free | nunca para 6 devs |
| Oracle XE | 12 GB datos | si superas 8 GB, considera Standard Edition |
| Conexiones DB simultáneas | 100 procesos | si los 6 devs + producción te dan timeouts, sube `processes` en Oracle |
| Ancho de banda VM | depende | si los devs son lentos consultando DB, mira `htop` en la VM |

---

## Anexo — Diagrama final del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  SERVIDOR (Hyper-V VM Ubuntu)                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Oracle XE :1521          (DB centralizada)              │   │
│  │ • cloudflared              (expone HTTP+SSH+TCP)          │   │
│  │ • Docker stack PROD        (sep.ggpcsena.com)             │   │
│  │ • Apache/Nginx :8080       (reverse proxy)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
       ▲                    ▲                       ▲
       │                    │                       │
sep.ggpcsena.com    ssh.ggpcsena.com      sepdb.ggpcsena.com
(usuarios finales)  (Josse solo)          (5 devs + Josse para
                                           desarrollo local)
       │                    │                       │
       │                    │                       ├─ Rosa PC
       │                    │                       ├─ Jhonatan PC
       │                    │                       ├─ Javier PC
       │                    │                       ├─ Julio PC
       │                    │                       ├─ Juliana PC
       │                    │                       └─ Josse PC
       │                    │
   Cualquiera         Solo Josse
```

---

**Lectura complementaria:**
- `docs/informes/00-B-servidor-ubuntu.md` — setup del servidor base
- `docs/informes/07-control-versiones-git.md` — convenciones de Git
- `docs/informes/10-setup-desarrolladores.md` — guía para los devs
