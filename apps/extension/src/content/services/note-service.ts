// ============================================================
// NoteService — Gestión de Notas de Contactos (Sprint v8.1.0)
// CRUD y resiliencia para notas privadas.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note } from '@wa-crm/types';

export class NoteService {
  /**
   * Carga todas las notas de un contacto ordenadas por fecha de creación descendente.
   */
  public static async getNotesForContact(
    supabase: SupabaseClient,
    contactId: string
  ): Promise<{ notes: Note[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[WA-CRM][NoteService] Error al cargar notas:', error.message);
        return { notes: [], error: error.message };
      }

      return { notes: (data || []) as Note[], error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar notas';
      console.error('[WA-CRM][NoteService] Error:', msg);
      return { notes: [], error: msg };
    }
  }

  /**
   * Crea una nueva nota privada para el contacto.
   */
  public static async createNote(
    supabase: SupabaseClient,
    workspaceId: string,
    contactId: string,
    content: string,
    createdBy: string
  ): Promise<{ note: Note | null; error: string | null }> {
    try {
      const newNote = {
        workspace_id: workspaceId,
        contact_id: contactId,
        content: content.trim(),
        created_by: createdBy,
      };

      const { data, error } = await supabase
        .from('notes')
        .insert(newNote)
        .select()
        .single();

      if (error) {
        console.warn('[WA-CRM][NoteService] Error al insertar nota:', error.message);
        return { note: null, error: error.message };
      }

      return { note: data as Note, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al crear nota';
      console.error('[WA-CRM][NoteService] Error:', msg);
      return { note: null, error: msg };
    }
  }

  /**
   * Elimina una nota por su ID.
   */
  public static async deleteNote(
    supabase: SupabaseClient,
    noteId: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) {
        console.warn('[WA-CRM][NoteService] Error al eliminar nota:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al eliminar nota';
      console.error('[WA-CRM][NoteService] Error:', msg);
      return { success: false, error: msg };
    }
  }
}
