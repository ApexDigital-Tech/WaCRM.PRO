// ============================================================
// ContactService — Auto-sincronización defensiva de contactos (Sprint 4)
// Maneja la normalización de teléfono y la prevalencia del nombre.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact } from '@wa-crm/types';

export interface SyncContactResult {
  contact: Contact | null;
  isNew: boolean;
  error: string | null;
}

/**
 * Normaliza un número de teléfono a un formato numérico estándar (ej. +59171408123).
 * Elimina espacios, guiones, paréntesis y caracteres invisibles.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';

  // Si viene en formato JID de WhatsApp (ej. 59171408123@c.us), tomar la parte numérica
  const baseNum = rawPhone.split('@')[0];

  // Limpiar caracteres no numéricos excepto un eventual signo '+' inicial
  const hasPlus = baseNum.trim().startsWith('+');
  const digitsOnly = baseNum.replace(/\D/g, '');

  if (!digitsOnly) return '';

  return hasPlus ? `+${digitsOnly}` : `+${digitsOnly}`;
}

export class ContactService {
  /**
   * Sincroniza un contacto en public.contacts preservando el nombre del CRM si ya existe.
   */
  public static async syncContact(
    supabase: SupabaseClient,
    workspaceId: string,
    rawPhone: string,
    whatsappName: string | null
  ): Promise<SyncContactResult> {
    try {
      const normalizedPhone = normalizePhoneNumber(rawPhone);

      if (!normalizedPhone || normalizedPhone.length < 7) {
        return {
          contact: null,
          isNew: false,
          error: 'Número de teléfono inválido o insuficiente para sincronizar.',
        };
      }

      // 1. Buscar si el contacto ya existe en este workspace
      const { data: existingContacts, error: searchError } = await supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('phone_number', normalizedPhone);

      if (searchError) {
        console.warn('[WA-CRM][ContactService] Error al buscar contacto existente:', searchError.message);
        if (workspaceId === '00000000-0000-0000-0000-000000000001') {
          console.info('[WA-CRM][ContactService] Usando contacto simulado de prueba Dev.');
          return {
            contact: {
              id: '00000000-0000-0000-0000-000000000002',
              workspace_id: workspaceId,
              phone_number: normalizedPhone,
              name: whatsappName || normalizedPhone,
              assigned_to: null,
              created_at: new Date().toISOString(),
            },
            isNew: true,
            error: null,
          };
        }
        return { contact: null, isNew: false, error: searchError.message };
      }

      // 2. Si ya existe, evaluar regla de prevalencia del nombre
      if (existingContacts && existingContacts.length > 0) {
        const existingContact = existingContacts[0] as Contact;

        // Si el nombre en el CRM está vacío y WhatsApp proporciona un nombre, actualizarlo
        if ((!existingContact.name || existingContact.name.trim() === '') && whatsappName && whatsappName.trim() !== '') {
          const { data: updated, error: updateError } = await supabase
            .from('contacts')
            .update({ name: whatsappName.trim() })
            .eq('id', existingContact.id)
            .select()
            .single();

          if (!updateError && updated) {
            console.info('[WA-CRM][ContactService] Nombre del contacto actualizado en CRM:', whatsappName);
            return { contact: updated as Contact, isNew: false, error: null };
          }
        }

        console.info('[WA-CRM][ContactService] Contacto existente encontrado. Prevalece nombre del CRM:', existingContact.name);
        return { contact: existingContact, isNew: false, error: null };
      }

      // 3. Si NO existe, crear nuevo contacto
      const newContactData = {
        workspace_id: workspaceId,
        phone_number: normalizedPhone,
        name: whatsappName && whatsappName.trim() !== '' ? whatsappName.trim() : normalizedPhone,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('contacts')
        .insert(newContactData)
        .select()
        .single();

      if (insertError) {
        console.warn('[WA-CRM][ContactService] Error al insertar nuevo contacto:', insertError.message);
        if (workspaceId === '00000000-0000-0000-0000-000000000001') {
          console.info('[WA-CRM][ContactService] Usando contacto simulado de prueba Dev.');
          return {
            contact: {
              id: '00000000-0000-0000-0000-000000000002',
              workspace_id: workspaceId,
              phone_number: normalizedPhone,
              name: whatsappName || normalizedPhone,
              assigned_to: null,
              created_at: new Date().toISOString(),
            },
            isNew: true,
            error: null,
          };
        }
        return { contact: null, isNew: false, error: insertError.message };
      }

      console.info('[WA-CRM][ContactService] Nuevo contacto auto-creado en Supabase:', inserted);
      return { contact: inserted as Contact, isNew: true, error: null };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado de red/sincronización';
      console.error('[WA-CRM][ContactService] Error defensivo no capturado:', msg);
      return { contact: null, isNew: false, error: msg };
    }
  }
}
