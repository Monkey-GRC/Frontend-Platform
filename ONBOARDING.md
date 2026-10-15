# Onboarding de una empresa nueva — guía para Frontend-Platform

Este documento describe lo que ve un cliente de Monkey **desde que recibe su clave de acceso hasta que termina de configurar su empresa**. La fuente de verdad es el cerebro del producto (`Monkey-Brain-IA`): los contratos viven en `contracts/modules/` y, si algo de aquí los contradice, gana el contrato.

## Panorama

1. Un `admin_monkey` registra la empresa en **Monkey Admin** y genera su **clave de acceso** (`MNK-XXXX-XXXX-XXXX`). Se la entrega al cliente por fuera de la aplicación.
2. El cliente **canjea la clave** en Platform y crea la cuenta de `admin_empresa` (`/register`).
3. Platform lo lleva por los **tres componentes** del onboarding, en orden:
   1. **Contexto Organizacional** — quién es la empresa.
   2. **Contexto del Servicio** — qué servicio se evalúa (repetible por servicio).
   3. **Control Técnico** — cómo se conectan los sistemas que se medirán.

No existen `onboarding_code`, `POST /onboarding/complete` ni los headers `mnk-client-identifier` / `mnk-client-key`: ese flujo se retiró. La empresa se aísla por `tenant_id` (RLS) y la identidad viaja en la **sesión por cookie**.

## Sesión

- La sesión vive en cookies `httpOnly` (`mnk_access`, `mnk_refresh`); el frontend nunca toca el token. Las peticiones llevan `withCredentials`.
- El access token dura 15 min y se renueva con `POST /v1/auth/refresh`. La sesión se cierra a los 30 min sin actividad y a las 8 h en total.
- Al arrancar, `AuthService.validate()` llama a `GET /v1/auth/me` (y a `refresh` si da 401). `authGuard` protege las rutas internas y `guestGuard` manda adentro a quien ya tiene sesión.
- Platform rechaza a `admin_monkey`: el equipo Monkey trabaja en Monkey Admin (D24).
- Contrato: `contracts/modules/auth.md`.

## Paso 0 — Activación de la cuenta (`/register`)

Dos pasos, en `RegisterForm` (D51):

1. **Solo el código.** `POST /v1/auth/redeem/lookup` comprueba la clave **sin gastarla** y devuelve la razón social y el correo administrativo que fijó Monkey.
2. **Datos fijos + contraseña.** Razón social y correo se muestran bloqueados; solo se pide la contraseña y su confirmación (12+ caracteres con mayúscula, minúscula, número y símbolo). Se llama a `POST /v1/auth/redeem` con `{ code, email, password }`.

El `201` abre la sesión y trae `user`, `company` y `onboarding.next_step`. Si `next_step` es `organizational_context`, se navega a `/onboarding`; si no, al inicio.

Errores a mostrar con un mensaje claro: `ACCESS_KEY_INVALID` (404), `ACCESS_KEY_ALREADY_USED` y `ACCESS_KEY_EXPIRED` (409), `ACCESS_KEY_EMAIL_MISMATCH` y `VALIDATION_FAILED` (422, por campo) y `ACCESS_KEY_RATE_LIMITED` (429: 10 fallos por 15 min por dirección).

## Dónde va el usuario: `onboarding.next_step`

`GET /v1/auth/me` (y el login y el canje) devuelven `onboarding` con `next_step` (el primer paso sin hacer, o `null` si terminó) y `completed_steps`. Los valores son `organizational_context`, `service_context` y `technical_control`. El frontend **no adivina** el paso: lo lee de ahí.

## Componente 1 — Contexto Organizacional (`/onboarding`)

- Vista: `features/onboarding/.../organizational-context`. Servicios: `OnboardingService` y `OnboardingDraftService` (borrador local mientras se escribe).
- `GET /v1/onboarding/organizational-context` trae lo guardado; sin nada guardado devuelve solo la razón social (precargada y **bloqueada**, viene de `companies`).
- `PUT /v1/onboarding/organizational-context` crea o actualiza (mismo endpoint). 9 campos obligatorios + 1 opcional.
- Las opciones de cada lista salen de `GET /v1/catalogs/{name}` (`size`, `industry`, `business_model`, `years_in_operation`, `incorporation_country`, `client_country`, `compliance_maturity`, `regulations`); **nunca se hardcodean** (`contracts/enums.md`).
- Contrato: `contracts/modules/onboarding-organizational-context.md`.

## Componente 2 — Contexto del Servicio (`/services`)

- Feature `features/services`: lista (`ServicesListView`), alta y edición (`ServiceFormView`, `/services/new` y `/services/:id/edit`) y detalle (`ServiceDetailView`, `/services/:id`).
- `POST /v1/services` declara un servicio (16 campos del Excel, 14 en el request) **y clona el catálogo del marco en la misma transacción**; el `201` ya trae `catalog.status = ready`. El servicio es repetible: una empresa puede declarar varios.
- `GET /v1/services` (paginado), `GET`, `PATCH` y `DELETE /v1/services/{id}`. Borrar con evaluaciones, evidencias o planes responde `409 SERVICE_HAS_EVALUATIONS`.
- **Descripción del Sistema**: enlace (`POST .../system-description`, `http`/`https`) o archivo (`POST .../system-description/file`, multipart, máx. 25 MB, PDF o `.docx`). Como el archivo necesita que el servicio exista, con archivo el flujo es crear el servicio y luego subir el archivo. La descarga (`GET .../system-description/file`) devuelve una URL temporal de 5 min.
- Los criterios de confianza contratados filtran los requisitos aplicables.
- Contrato: `contracts/modules/onboarding-service-context.md`.

## Componente 3 — Control Técnico (`/services/:id/connections/...`)

Feature `features/technical-control`. Se configura **por servicio**:

1. **Escenario de despliegue** — `PUT /v1/services/{id}/deployment-scenario`. Devuelve las conexiones que aplican (`409 CAPABILITY_NOT_APPLICABLE` si dejaría fuera un sistema ya registrado). `GET /v1/services/{id}/technical-control` trae escenario, conexiones aplicables y `is_complete` en una sola lectura.
2. **Conectar un sistema** (`new-connection` → `connect-platform`) — la plataforma y el canal salen de la base (`GET /v1/catalogs/automated-capabilities`, `connection_method`, `aws_region`); la pantalla no hardcodea listas. Hoy solo hay cuentas de nube (AWS) con rol de solo lectura (plantilla en `GET /v1/connection-templates/aws-readonly-role`) o con llaves. Servidores, bases y equipos con agente aún no se pueden registrar.
3. **Validar** (`POST /v1/assets/{id}/validate`), **elegir qué activos descubiertos son del servicio** (`GET /v1/assets/{id}/resources` y `PUT /v1/services/{id}/connections/{connectionId}/assets`), **activar** (`POST .../activate`) y **programar** (`PUT .../schedule`, frecuencia validada por conexión).
4. Detalle de una conexión: `ConnectionDetailView` (`/services/:id/connections/:assetId`), con sus ejecuciones (`GET/POST /v1/assets/{id}/executions`).

Reglas de producto:
- Al cliente **nunca** se le nombra el proveedor de la sonda: se dice «sonda» o «evaluación automática».
- «Automatizado» no es «Operativo»: activar con la sonda simulada deja el sistema en `warning`.
- Contrato: `contracts/modules/onboarding-technical-control.md`.

## Convenciones de la app

- Respuestas con sobre `SuccessResponse<T>`; errores con `error.code` (`@core/domain/utils/api-error`). Ver `contracts/conventions.md`.
- Todo texto visible va por i18n (`public/i18n/{es,en}/*.json`, `@ngx-translate`); i18n es obligatorio (`Monkey-Brain-IA/skills/frontend/architecture-guardian.md`).
- Arquitectura por capas (`domain` / `presentation`), componentes standalone y alias `@core`, `@features`, `@shared`, `@environments`.

## Dónde mirar como referencia

- `src/app/features/auth/` — login, activación y `AuthService`.
- `src/app/features/onboarding/` — Componente 1.
- `src/app/features/services/` — Componente 2.
- `src/app/features/technical-control/` — Componente 3.
- `src/app/core/domain/` — guards, interceptores, sesión y utilidades de error.
