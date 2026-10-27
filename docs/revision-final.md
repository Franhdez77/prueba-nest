# Revisión final de requisitos

Fecha: 27 de octubre de 2026.

Resultado: los criterios funcionales revisados pasan las comprobaciones descritas
abajo. La entrega sigue pendiente por SQL, evidencias y actualización del repositorio publicado. Esta matriz no sustituye las capturas
de Swagger o la colección de Postman solicitadas como entregable.

Estados: **Cumple** = comprobado en código y/o ejecución; **Pendiente** = no
entregado; **Opcional** = no es condición para la funcionalidad obligatoria.

## Comprobaciones ejecutadas

- `npm run typecheck`: correcto.
- `npm run build`: correcto, también dentro de la imagen Docker.
- `npm run test:cov`: 101 pruebas unitarias correctas, 11 suites.
- `npm run test:e2e`: 39 pruebas HTTP correctas, 6 suites, sobre PostgreSQL temporal.
- Instalación desde una base vacía: cinco migraciones aplicadas correctamente.
- Seeder ejecutado dos veces: cantidades y relaciones de prueba correctas, sin duplicados.
- Configuración Compose válida y arranque de producción comprobado. En esta revisión
  se usó temporalmente PORT=3001 porque el puerto 3000 estaba ocupado.
- Repositorio GitHub público: `https://github.com/Franhdez77/prueba-nest`.
- El remoto consultado apunta a `0e59989`; faltan los commits locales posteriores.

Cobertura unitaria, sin sumar la suite HTTP ni cambiar el alcance de medición:

| Sentencias | Ramas | Funciones | Líneas |
| --- | --- | --- | --- |
| 61,33 % | 43,01 % | 55,08 % | 66,95 % |

## Autenticación y autorización — páginas 2 a 4

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Registro con roles ADMIN y TECHNICIAN | Cumple | Registro público de técnicos y `POST /auth/users` exclusivo de ADMIN para ambos roles |
| Inicio de sesión por correo y contraseña | Cumple | `POST /auth/login`; pruebas de credenciales correctas, incorrectas y usuario inexistente |
| Hashing seguro de contraseñas | Cumple | Hash nativo con sal aleatoria; pruebas de verificación y ausencia de contraseña/hash en respuestas |
| JWT después de autenticar | Cumple | Firma, sujeto, rol y expiración comprobados en Jest |
| Guards para rutas privadas | Cumple | JWT global; rutas privadas probadas con token ausente, inválido y expirado |
| Decorador de roles y RolesGuard | Cumple | `@Roles()` y guard global; acceso administrativo devuelve 403 al técnico |
| Al menos tres decoradores de autenticación/autorización | Cumple | `@Roles()`, `@CurrentUser()`, `@Public()` y `@ApiKeyAuth()` |
| Al menos un endpoint externo con x-api-key | Cumple | `GET /integrations/status` |
| API Key por entorno y guard específico | Cumple | Variable `API_KEY` y `ApiKeyGuard` |
| Rechazo sin token, con token inválido/expirado, rol incorrecto o API Key incorrecta | Cumple | Pruebas unitarias y HTTP, con respuestas 401 o 403 según corresponda |

## Funcionalidad general — página 4

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Registro y login operativos | Cumple | Pruebas HTTP, incluidos registro administrativo y login de ambos roles |
| Administrador gestiona vehículos, mecánicos, talleres y mantenimientos | Cumple | Rutas de escritura protegidas con ADMIN |
| Administrador consulta historiales y auditorías | Cumple | Historial por vehículo y auditoría por mantenimiento |
| Técnico consulta sus mantenimientos y la información del taller | Cumple | `/maintenances/mine`; respuestas con vehículo, mecánico y taller |
| Técnico actualiza únicamente sus asignaciones | Cumple | Recursos ajenos devuelven 403; intentos fallidos no cambian vehículo ni auditoría |
| Operaciones autorizadas según rol | Cumple | Guards globales más comprobación de asignación en el servicio |
| Códigos HTTP apropiados | Cumple | 200, 201, 400, 401, 403, 404 y 409 comprobados |
| Endpoints REST para las funcionalidades principales | Cumple | Controladores de auth, vehicles, mechanics, workshops y maintenances |
| Arranque mediante variables de entorno | Cumple | Validación de configuración y arranque Docker |

## Vehículos — páginas 4 y 5

| N.º | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Listado protegido | Cumple | `GET /vehicles` |
| 2 | Registro por administrador | Cumple | `POST /vehicles`; técnico recibe 403 |
| 3 | Placa, marca, modelo, año, kilometraje y estado | Cumple | Entidad y DTO de vehículos |
| 4 | Placa única | Cumple | Restricción PostgreSQL y respuesta 409 por duplicado |
| 5 | Consulta por ID o placa | Cumple | `/vehicles/:id` y `/vehicles/plate/:plate` |
| 6 | Actualización por administrador | Cumple | `PATCH /vehicles/:id` |
| 7 | Inactivación sin eliminar historial | Cumple | DELETE cambia a INACTIVE; UUID y relaciones se conservan |
| 8 | AVAILABLE, IN_MAINTENANCE e INACTIVE | Cumple | Enum y migración |
| 9 | No asignar vehículo inactivo a un mantenimiento nuevo | Cumple | Creación rechazada con 409 |

## Mecánicos — página 5

| N.º | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Registro por administrador | Cumple | `POST /mechanics` |
| 2 | Nombre, correo, especialidad y estado | Cumple | Entidad y DTO |
| 3 | Consultar todos | Cumple | `GET /mechanics` |
| 4 | Consultar uno | Cumple | `GET /mechanics/:id` |
| 5 | Actualizar información | Cumple | `PATCH /mechanics/:id` |
| 6 | Activar e inactivar | Cumple | PATCH con ACTIVE y DELETE para INACTIVE |
| 7 | No asignar inactivos a nuevos mantenimientos | Cumple | Rechazo 409 al crear |
| 8 | Inactivación conserva el historial | Cumple | No se elimina el registro; relaciones con borrado restringido |
| 9 | Sin taller permanente | Cumple | El taller pertenece al mantenimiento, no al mecánico |
| 10 | No cruzar horarios activos en ningún taller | Cumple | Consultas por mecánico e intervalos, bloqueo transaccional y pruebas simultáneas |
| 10.a–c | Rechazar coincidencia y solapamiento parcial o total | Cumple | Casos de mismo taller, distinto taller y solicitudes concurrentes |
| 10.d | Permitir que uno empiece al terminar otro | Cumple | Intervalos consecutivos 07:30–09:00 y 09:00–10:00 probados |

## Talleres — páginas 5 y 6

| N.º | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Registro por administrador | Cumple | `POST /workshops` |
| 2 | Nombre, dirección y estado | Cumple | Entidad y DTO |
| 3 | Listado protegido de activos | Cumple | `GET /workshops` excluye inactivos |
| 4 | Consulta individual | Cumple | `GET /workshops/:id` |
| 5 | Activar e inactivar por administrador | Cumple | `PATCH /workshops/:id/status` |
| 6 | No asignar inexistentes o inactivos | Cumple | Respuestas 404/409 al crear; revalidación al iniciar |

## Mantenimientos — páginas 6 y 7

| N.º | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Creación protegida | Cumple | `POST /maintenances`, ADMIN |
| 2 | Relación con vehículo, mecánico y taller | Cumple | Tres relaciones TypeORM y claves foráneas |
| 3 | Tipo, descripción, kilometraje, programación, estado y relaciones | Cumple | DTO y entidad; inicio y fin con zona horaria |
| 4 | PREVENTIVE y CORRECTIVE | Cumple | Enum, validación y datos de ejemplo de ambos tipos |
| 5 | Estado inicial SCHEDULED | Cumple | Se asigna en el servicio y la base |
| 6 | Cuatro estados requeridos | Cumple | SCHEDULED, IN_PROGRESS, COMPLETED y CANCELLED |
| 7 | Endpoint de cambio de estado | Cumple | `PATCH /maintenances/:id/status` |
| 8.a | Consultar todos | Cumple | Listado global para ADMIN |
| 8.b | Consultar activos | Cumple | `?active=true` |
| 8.c | Consultar por vehículo | Cumple | `?vehicleId=...` |
| 8.d | Consultar por mecánico | Cumple | `?mechanicId=...` o `/maintenances/mechanic/:id` |
| 8.e | Historial del vehículo | Cumple | `/maintenances/vehicle/:id/history` |
| 9 | Trabajo, costo, finalización y kilometraje final obligatorios | Cumple | Validaciones y pruebas de cierre incompleto o inválido |

## Reglas de negocio — página 7

| Regla | Estado | Evidencia |
| --- | --- | --- |
| Vehículo existente | Cumple | 404 cuando no existe |
| Mecánico existente y activo | Cumple | 404/409; verificación al crear e iniciar |
| Taller existente y activo | Cumple | 404/409; verificación al crear e iniciar |
| Solo un mantenimiento activo por vehículo | Cumple | Verificación transaccional, índice único parcial y prueba simultánea |
| Solo una intervención en ejecución por técnico | Cumple | Bloqueo por mecánico, índice único parcial y prueba de inicios simultáneos |
| Kilometraje de mantenimiento no inferior al vehículo | Cumple | Creación rechazada con 409; cierre compara ambos kilometrajes |
| Inicio cambia vehículo a IN_MAINTENANCE | Cumple | Prueba de transición y persistencia |
| Cierre cambia vehículo a AVAILABLE | Cumple | Misma transacción; kilometraje final actualizado |
| COMPLETED no regresa a estados anteriores | Cumple | Estado final; pruebas unitarias y HTTP |
| CANCELLED no se reabre | Cumple | Estado final; pruebas unitarias y HTTP |
| Cierre exige información obligatoria | Cumple | Faltantes producen 400 y valores incompatibles 409 |
| Transición inválida devuelve error descriptivo | Cumple | 409 con estados de origen y destino |

Criterios de flujo acordados para resolver las reglas de horarios y cancelación:
varios pendientes por mecánico sin cruces, solo uno en ejecución, cancelación
únicamente desde SCHEDULED y estados finales definitivos.

## Respuestas, errores y persistencia — páginas 8 y 9

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Interceptor uniforme en respuestas exitosas | Cumple | success, statusCode numérico, data, path y timestamp |
| Filtro personalizado con código, mensaje, ruta y fecha | Cumple | HttpExceptionFilter, aplicado globalmente |
| Consistencia entre endpoints | Cumple | Configuración compartida en API y pruebas HTTP |
| Validaciones y conflictos no se convierten en 500 | Cumple | Pruebas 400/401/403/404/409 y traducción de errores PostgreSQL |
| PostgreSQL como persistencia principal | Cumple | Instalación vacía y Docker comprobados |
| Integración mediante TypeORM | Cumple | Módulos, repositorios, entidades y migraciones |
| Relaciones correctamente definidas | Cumple | Mantenimiento y auditoría con claves foráneas; inactivación conserva los registros |

## Seeder y entorno — página 9

| Criterio | Estado | Cantidad verificada tras dos ejecuciones |
| --- | --- | --- |
| Un solo comando | Cumple | `npm run seed` o `npm run seed:prod` en contenedor |
| Un ADMIN y dos TECHNICIAN | Cumple | 3 usuarios |
| Dos mecánicos activos vinculados y uno inactivo | Cumple | 3 mecánicos |
| Un taller activo y uno inactivo | Cumple | 2 talleres |
| Dos vehículos disponibles, uno en proceso y uno inactivo | Cumple | 4 vehículos: 2 AVAILABLE, 1 IN_MAINTENANCE, 1 INACTIVE |
| Mantenimiento IN_PROGRESS asociado | Cumple | 1 |
| Al menos un COMPLETED para historial | Cumple | 1 |
| Repetición sin duplicados | Cumple | Totales conservados: 3 usuarios, 3 mecánicos, 2 talleres, 4 vehículos, 2 mantenimientos y 5 auditorías |
| .env.example con claves ficticias | Cumple | Archivo presente y compatible con validación de entorno |

## Organización, documentación y entrega — páginas 9 y 10

| Criterio | Estado | Observación |
| --- | --- | --- |
| Buenas prácticas y nombres claros | Revisado | Módulos separados, DTO de validación, servicios y reglas identificables; valoración final corresponde al evaluador |
| Archivos organizados en repositorio | Cumple localmente | Código en src y pruebas HTTP en test; publicación pendiente |
| Comentarios en guards, filtro, interceptor y transacciones | Cumple | Comentarios presentes en las secciones clave |
| Commits descriptivos por funcionalidad | Cumple localmente | Historial de auth, Swagger, vehículos, mecánicos, talleres, Docker, mantenimientos y pruebas |
| URL Swagger en README | Cumple | http://localhost:3000/docs |
| Protección de rutas según usuario/rol | Cumple | Excepciones públicas para autenticación y documentación; negocio protegido |
| Repositorio GitHub público | Parcial | Público confirmado; faltan los commits locales posteriores a 0e59989 |
| README con instalación, variables, seed, credenciales y Swagger | Cumple | Instrucciones locales y Docker disponibles |
| Nombre y clan del coder | Cumple | Francisco Hernandez, clan Node/Nest AN, incluidos en README |
| .env.example entregado | Cumple | Incluido en Git; .env excluido |
| Dump SQL con estructura y datos para Moodle | Pendiente | No se encontró archivo SQL de entrega |
| Swagger que permite probar la solución | Cumple | UI, cuerpos de entrada y esquemas JWT/API Key comprobados |
| Colección Postman o capturas Swagger | Pendiente | Las pruebas Jest y este informe no sustituyen esas evidencias |
| Fecha y hora de entrega | Sin definir | El enunciado no fija una fecha |

## Extras opcionales — página 10

| Extra | Estado | Evidencia |
| --- | --- | --- |
| Docker | Implementado | Dockerfile por etapas; Compose API y PostgreSQL, volumen y red interna |
| Jest con más del 40 % de cobertura | Implementado | 101 pruebas; cuatro métricas superiores al 40 %, umbral de 41 % |
| OAuth 2.0 | No implementado; opcional | No bloquea la funcionalidad obligatoria |

Los extras solo se califican cuando funcionan los requisitos obligatorios; este
informe no asigna puntajes de evaluación.
