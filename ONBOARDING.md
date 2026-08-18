# Onboarding de un tenant nuevo — guía para frontend-platform

Este documento describe el flujo que ve un cliente de Monkey **después**
de que un `MONKEY_ADMIN` le crea su tenant desde `/clients` (en la app
`frontend`, panel de Monkey Admin) y le entrega un **código de
onboarding**. `frontend-platform` es la aplicación que usará el cliente
final para activar su cuenta, elegir su framework de cumplimiento y
configurar su tenant.

## Contexto rápido

- Cuando `MONKEY_ADMIN` crea un cliente (`POST /clients`), Monkey **NO**
  aprovisiona todavía ninguna base de datos física — solo guarda los datos
  de la empresa y genera un **`onboarding_code`** de un solo uso, que
  expira **a los 7 días**. No se crea ningún usuario ni credencial de acceso
  en ese momento. **Este es el único código que se le muestra a un humano
  directamente** — a `MONKEY_ADMIN`, una sola vez, en `frontend` — para que
  se lo entregue al cliente por el canal que sea (correo, WhatsApp, etc.).
- La base de datos física del tenant, el usuario `CLIENT_ADMIN` y las
  credenciales de acceso a la API (`mnk-client-identifier` /
  `mnk-client-key`) se crean **todas juntas, al final**, en un solo paso
  atómico: `POST /onboarding/complete`. Si algo falla en ese paso (crear el
  usuario, clonar el template elegido, etc.), todo se revierte — la base de
  datos aprovisionada se elimina y el `onboarding_code` sigue siendo válido
  para reintentar.
- **`mnk-client-identifier` / `mnk-client-key` NUNCA se le muestran al
  cliente.** No son una credencial que la persona deba copiar, guardar ni
  recordar — son un dato interno de enrutamiento, equivalente a un
  access-key/secret-key de infraestructura. El frontend los recibe una
  única vez en la respuesta de `POST /onboarding/complete`, los guarda de
  inmediato en `localStorage` **sin mostrarlos en pantalla**, y de ahí en
  adelante un interceptor HTTP los agrega automáticamente como headers en
  **todas** las peticiones — el cliente nunca se entera de que existen.
  Con lo único que el cliente inicia sesión es su **usuario y contraseña**
  (elegidos por él mismo en el último paso del onboarding).
- Tanto el `onboarding_code` (hasheado) como `client_key` (hasheado) viven
  en la base de datos **central** (`mnk_clients`), asociados al tenant.
  Cada request que llega con los headers `mnk-client-identifier` /
  `mnk-client-key` se resuelve contra esa tabla para saber a qué base de
  datos física de tenant dirigir la petición (`ClientCredentialsGuard`).
- Todo lo que el cliente crea (usuarios, templates, riesgos, causas,
  controles) vive **únicamente en la base de datos física de su propio
  tenant** — aislado de todos los demás.

## Flujo de UI (todo antes de tener sesión, un único POST final)

```
0. Bienvenida + código   →  el cliente pega el onboarding_code que le
                              compartió MONKEY_ADMIN (pantalla /register)

1. Caracterización       →  tipo de empresa (business_type) y número de
                              activos/servidores (server_count) — se
                              guardan en memoria, todavía no hay tenant ni
                              sesión, no se llama a ningún endpoint

2. Elegir framework       →  GET /onboarding/master-templates?onboarding_code=...
   (opcional)                (ver la biblioteca y escoger un template_id,
                              o saltar este paso con "crear mi propio
                              template más adelante" — template_id es
                              opcional en el paso final)

3. Crear cuenta            →  POST /onboarding/complete
   (usuario y contraseña)     (onboarding_code + lo acumulado en los pasos
                               1-2 + email/username/password que el cliente
                               elige — aquí es donde se crea TODO: DB,
                               usuario admin, keys de acceso, y opcionalmente
                               el template clonado)
                             → devuelve sesión ya logueada (cookies) +
                               mnk-client-identifier + mnk-client-key
                               (estos dos NUNCA se muestran — se guardan
                               en localStorage en silencio)

4. Redirección              →  directo al dashboard del tenant, ya
                                autenticado con usuario/contraseña
```

Los pasos 1 y 2 solo acumulan datos en memoria (ver
`RegistrationSessionService`) — la única llamada al backend que crea algo
es el `POST /onboarding/complete` del paso 3, exactamente igual que antes:
la base de datos del tenant no existe hasta ese momento, así que no hay
forma de guardar nada server-side antes de ese llamado.

---

## Paso 1 — Caracterización (business_type + server_count)

Sin llamada al backend. Pantalla previa al framework: pregunta el tipo de
negocio (mismas opciones del enum `BusinessType`: `E_COMMERCE`, `FINTECH`,
`SAAS`, `HEALTHTECH`, `OTHER`) y el número de activos/servidores a evaluar.
Ambos se guardan en `RegistrationSessionService` y viajan dentro del body
de `POST /onboarding/complete` al final (`business_type`, `server_count`
— siguen siendo opcionales a nivel de API, pero la UI los pide como parte
del flujo natural de alta).

## Paso 2 — Elegir framework (catálogo de plantillas maestras)

**`GET /onboarding/master-templates?onboarding_code=...`** — sin
`AuthGuard`, protegido con el propio `onboarding_code` como query param (no
hay sesión ni tenant todavía). Valida que el código exista, no esté
expirado y no se haya usado ya — mismos errores que el paso 3 (ver abajo).

Respuesta (200):
```json
{
  "message": "Catálogo de plantillas obtenido exitosamente.",
  "statusCode": 200,
  "data": [
    {
      "id": "8143c5be-...",
      "name": "ISO 27001 Demo",
      "code": "TPL-112648",
      "description": "...",
      "objective": null,
      "scope": null,
      "slug": "iso-27001-demo",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

Muestra este catálogo como una lista de tarjetas/opciones para que el
cliente elija una — el `id` elegido es el `template_id` que va en el paso
3. **Este paso es opcional**: si el cliente prefiere no adoptar ninguna
plantilla maestra, puede elegir "crear mi propio template más adelante" y
seguir sin `template_id` — podrá construir su propio template desde cero
después del onboarding (`/templates`, ver más abajo).

---

## Paso 3 — Completar onboarding (crea todo de una vez)

**`POST /onboarding/complete`** — sin `AuthGuard`, sin headers de tenant
(todavía no existen). El `onboarding_code` en el body es la única prueba de
que quien llama tiene derecho a activar ese tenant.

Request body:
```json
{
  "onboarding_code": "wT11qICzB-uCpgAMbjwEfRB87QeXKU_d",
  "template_id": "8143c5be-bd84-4541-a024-edb9421c4b55", // opcional
  "email": "admin@clienteejemplo.com",
  "username": "admin-cliente",
  "password": "MinimoOchoCaracteres",
  "name": "Nombre",                 // opcional
  "last_name": "Apellido",          // opcional
  "business_type": "SAAS",          // opcional — E_COMMERCE | FINTECH | SAAS | HEALTHTECH | OTHER
  "server_count": 5                 // opcional
}
```

`template_id` es **opcional**: si no se envía, el backend crea el tenant
sin ningún template inicial — el cliente arranca desde `/templates` vacío
y construye el suyo con `POST /templates` + `POST /risks` + `POST
/reasons` + `POST /controls` (ver "Uso normal después del onboarding").

Qué pasa internamente, en orden (útil para explicarle a soporte si algo
falla a mitad de camino):
1. Valida el `onboarding_code` (existe, no expiró, no se usó ya).
2. Si vino `template_id`, valida que exista en la biblioteca maestra (si
   no vino, se salta este paso y el paso 5 completo).
3. Aprovisiona la base de datos física del tenant (rol + DB + migraciones).
4. Crea el usuario `CLIENT_ADMIN` con el email/usuario/contraseña que envió
   el cliente, y el `CompanyProfile` si mandó `business_type`/`server_count`.
5. Si vino `template_id`, clona ese template (con sus riesgos, causas,
   controles y checks) dentro de la base recién creada — queda editable
   desde el minuto uno, sin afectar nunca al template maestro original.
6. Genera `mnk-client-identifier` y `mnk-client-key`, y los guarda
   (el segundo, hasheado) en la base central. **Estos dos valores no se le
   muestran al cliente en ningún momento** — el frontend los recibe en la
   respuesta y los persiste directo en `localStorage`.
7. Marca el tenant como `READY` y el onboarding como completado — el
   `onboarding_code` queda invalidado, no vuelve a funcionar.
8. Emite la sesión (mismas cookies httpOnly `access_token`/`refresh_token`
   que usa el login normal).

Si algo falla entre el paso 3 y el 6, se revierte todo automáticamente
(se elimina la base de datos recién creada) y el `onboarding_code` **sigue
siendo válido** — el cliente puede reintentar el mismo `POST
/onboarding/complete` sin pedir un código nuevo.

Respuesta (201) — y además setea las cookies de sesión:
```json
{
  "message": "Onboarding completado exitosamente.",
  "statusCode": 201,
  "data": {
    "user": {
      "id": "...",
      "email": "admin@clienteejemplo.com",
      "username": "admin-cliente",
      "name": "Nombre",
      "last_name": "Apellido",
      "role": "CLIENT_ADMIN",
      "client_id": "...",
      "is_active": true
    },
    "client_identifier": "i60AxzXZoGEXoV6YE4qjSg",
    "client_key": "UsGpVbjwn4IDCxtkN3yn0oT5mqmndL9_"
  }
}
```

`client_identifier`/`client_key` llegan en esta respuesta **una única
vez** — el frontend los guarda inmediatamente en `localStorage` (ej.
`mnk_client_identifier` / `mnk_client_key`) sin renderizarlos en ninguna
pantalla, y redirige derecho al dashboard. No hay "pantalla de revelar
credenciales" para esto — a diferencia del `onboarding_code`, que sí se le
muestra una vez a `MONKEY_ADMIN` en `/clients`, esto es una operación
transparente para el cliente final.

### Errores posibles

| Status | Cuándo | Qué mostrarle al cliente |
|---|---|---|
| 401 | `onboarding_code` no existe (o ya se usó — el hash se limpia al completar) | "Código de onboarding inválido" — mismo mensaje sea cual sea la causa real, no reveles cuál |
| 409 | El tenant ya completó su onboarding antes | "Este tenant ya fue activado, inicia sesión normalmente" |
| 410 | El código expiró (pasaron más de 7 días desde que `MONKEY_ADMIN` lo creó) | "El código expiró, pide a soporte que te genere uno nuevo" — `MONKEY_ADMIN` puede regenerarlo desde `/clients` |
| 404 | `template_id` inválido (no existe en la biblioteca maestra) | Solo aplica si se envió `template_id` — no debería pasar si el paso 2 se usó para poblar la lista, validar igual por si acaso |
| 500 | Falló el aprovisionamiento de la DB o la creación del usuario | "Ocurrió un error, intenta de nuevo" — es seguro reintentar, el código sigue siendo válido |

---

## Paso 4 — Usar las credenciales de tenant en cada request (transparente)

A partir de aquí, **cualquier llamada a un endpoint de tenant** (risks,
reasons, controls, templates, dashboard, login, etc.) debe llevar estos dos
headers:

```
mnk-client-identifier: i60AxzXZoGEXoV6YE4qjSg
mnk-client-key: UsGpVbjwn4IDCxtkN3yn0oT5mqmndL9_
```

Se guardan en `localStorage` justo después del paso 3 (silenciosamente,
sin pantalla intermedia) y un interceptor HTTP de Angular
(`tenantCredentialsInterceptor`) los agrega a **todas** las peticiones
salientes — sin ellos, cualquier endpoint tenant-scoped responde `401
Unauthorized` con "Se requieren los headers mnk-client-identifier y
mnk-client-key", aunque la cookie de sesión siga siendo válida. El usuario
nunca ve ni maneja estos valores directamente.

Esto también aplica al **login normal** de sesiones futuras
(`POST /auth/login`): el `identifier`/`password` van en el body igual que
siempre (con estos, y solo con estos, el usuario inicia sesión), pero los
dos headers de arriba son obligatorios para que el backend sepa a qué base
de datos de tenant dirigir la autenticación (ya no existe el campo
`api_key` en el body de login, quedó reemplazado por estos headers, que el
interceptor agrega solo).

Si el tenant se desactiva (`MONKEY_ADMIN` lo desactivó, por ejemplo por
falta de pago), estos headers empiezan a fallar con `401 Unauthorized`
("Credenciales de tenant inválidas") de inmediato, sin importar que la
sesión siga activa — trátalo como "cuenta suspendida" en la UI.

---

## Uso normal después del onboarding

Todo esto ya funciona **usando exactamente los mismos servicios Angular que
ya existen** en `src/app/features/templates/` (`TemplateService`,
`RiskService`, `ReasonService`, `ControlService`, `ChecklistService`) una
vez que el interceptor de headers está en su lugar — no hace falta
reinventar las llamadas HTTP, el backend enruta automáticamente a la base
de datos del tenant identificado por `mnk-client-identifier`.

- **Dashboard** (`/`): `DashboardService` (`GET /dashboard/summary`, `GET
  /dashboard/controls`, `GET /dashboard/controls/:id/checks`) — cumplimiento
  real del tenant según su template y los checks evaluados.
- **Templates** (`/templates`): si el onboarding se completó con
  `template_id`, el tenant ya tiene ese template clonado y editable desde
  el día uno. Si se completó sin `template_id` ("crear el mío después"),
  arranca vacío y el cliente construye el suyo con `TemplateService.create()`
  + `template-builder` (controles, riesgos, causas, y su vínculo).
- Opcionalmente, una pantalla de "editar datos de la empresa" (`GET`/`PATCH
  /onboarding/company-profile`, sin cambios respecto a antes — requieren
  sesión + los headers de tenant, que van solos gracias al interceptor).

## Dónde mirar como referencia

- `src/app/features/onboarding/` — todo el flujo de alta (pasos 0 a 3).
- `src/app/core/domain/services/tenant-credentials.service.ts` — guarda/lee
  `mnk-client-identifier`/`mnk-client-key` de `localStorage`, sin exponerlos
  en ninguna vista.
- `src/app/core/domain/interceptors/tenant-credentials.interceptor.ts` —
  los agrega como headers a cada request saliente.
- `src/app/features/templates/` — todo lo necesario para ver/crear
  templates, riesgos, causas y controles de un tenant ya activo.

## Reglas de negocio a respetar (no son solo detalles de implementación)

- El admin del tenant **elige su propio usuario/contraseña** en el
  onboarding — `MONKEY_ADMIN` nunca los define ni los conoce. Ese
  usuario/contraseña es la **única** forma de iniciar sesión.
- `mnk-client-identifier`/`mnk-client-key` **nunca se muestran ni se le
  piden al cliente** — son un dato de enrutamiento interno, no una
  credencial que la persona deba gestionar. Se guardan y se usan en
  silencio.
- El template elegido en el paso 2 se **clona**, no se referencia — el
  cliente puede editarlo libremente (quitar/agregar riesgos, causas,
  controles) sin que eso afecte jamás la plantilla maestra original.
  Elegir un template en el onboarding es **opcional** — el cliente puede
  posponer esa decisión y construir el suyo desde cero después.
- El `onboarding_code` solo sirve **una vez** y solo si no expiró — pero si
  el `POST /onboarding/complete` falla a mitad de camino (aprovisionamiento,
  clonado del template, etc.), el código sigue siendo válido para
  reintentar, no hace falta pedir uno nuevo salvo que el error sea
  específicamente 410 (expiración).
