# Juega con Membresía

## Planes

### Daddy Plus — $99 MXN al mes

- 10% de descuento en cada compra en Daddy Pollo.
- Vestimentas inmediatas: Comandante Neón y Rey del Sabor.
- Vestimentas por progreso: Guardián Omega en el Mundo 5 y Fénix Elemental en el Mundo 6.
- Tres armas exclusivas. El jugador elige una en el Arsenal y puede activarla durante 15 segundos.
- Avión Daddy de combate durante 10 segundos en cada mundo.

### Daddy Elite — $149 MXN al mes

- Todo lo incluido en Daddy Plus.
- Una orden de papas con pollo chico cada mes.
- Una Coca-Cola de 350 ml cada mes.
- Un poder exclusivo por mundo. El medidor empieza con carga base y aumenta peleando:
  - Rayos del cielo.
  - Fuego arrasador.
  - Terremoto Daddy.

## Reglas de juego

- Las armas VIP y el avión se pueden activar una vez por mundo.
- El poder Elite requiere 100% de carga y se puede usar una vez por mundo.
- El poder rota entre rayos, fuego y terremoto según el mundo.
- Las vestimentas de los mundos 5 y 6 permanecen desbloqueadas en el dispositivo después de alcanzar esos mundos.
- Si la membresía deja de estar activa, el juego conserva el progreso, pero bloquea el uso de beneficios.

## Integración de Stripe

El juego registra nombre, teléfono y avatar antes de enviar al usuario al Payment Link. El servidor guarda el plan pendiente y agrega el UUID interno del jugador como `client_reference_id`; el cliente nunca recibe llaves secretas ni datos de tarjeta.

| Plan | Cobro mensual | Producto |
| --- | --- | --- |
| Daddy Plus | `https://buy.stripe.com/00w14m8bz5bPb4n8Q64c80k` | `prod_Ux7hZ0O7sUc0hJ` |
| Daddy Elite | `https://buy.stripe.com/14A28qajH8o1b4n1nE4c80j` | `prod_Ux7iNXegfFKWbU` |

Variables para confirmar y mantener el estado de la suscripción:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PAYMENT_LINK_DADDY_PLUS=https://buy.stripe.com/00w14m8bz5bPb4n8Q64c80k
STRIPE_PAYMENT_LINK_DADDY_ELITE=https://buy.stripe.com/14A28qajH8o1b4n1nE4c80j
STRIPE_PRODUCT_DADDY_PLUS=prod_Ux7hZ0O7sUc0hJ
STRIPE_PRODUCT_DADDY_ELITE=prod_Ux7iNXegfFKWbU
```

En cada Payment Link se debe configurar **Después del pago → Redirigir al sitio web**:

```text
# Daddy Plus
https://TU-DOMINIO/?membership=success&plan=daddy-plus&session_id={CHECKOUT_SESSION_ID}

# Daddy Elite
https://TU-DOMINIO/?membership=success&plan=daddy-elite&session_id={CHECKOUT_SESSION_ID}
```

Ese regreso abre la bienvenida cinematográfica de Daddy Pollo con confeti. Los beneficios solamente pasan a estado activo después de que Stripe confirme el pago por la API o el webhook.

Stripe debe enviar estos eventos al endpoint `/api/memberships/webhook`:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Datos

La migración crea:

- `memberships`: plan, estado, cliente y suscripción de Stripe, vigencia y cancelación.
- `membership_monthly_benefits`: control mensual del beneficio de alimentos del plan Elite.
