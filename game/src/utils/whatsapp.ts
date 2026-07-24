/**
 * Build a WhatsApp deep link from the business phone stored by the super admin.
 * Ten-digit Mexican numbers receive the country code used elsewhere in the game.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/gu, '');
  const destinationPhone = digits.length === 10 ? `52${digits}` : digits;

  return `https://wa.me/${destinationPhone}?text=${encodeURIComponent(message)}`;
}
