// ============================================================
// QuickReplyService — Gestión de Respuestas Rápidas (Sprint v8.2.0)
// CRUD y lógica de base de datos para plantillas de mensajes.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuickReply } from '@wa-crm/types';

export class QuickReplyService {
  /**
   * Carga todas las plantillas de respuestas rápidas de un workspace ordenadas por título.
   */
  public static async getQuickReplies(
    supabase: SupabaseClient,
    workspaceId: string
  ): Promise<{ replies: QuickReply[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('title', { ascending: true });

      if (error) {
        console.warn('[WA-CRM][QuickReplyService] Error al cargar plantillas:', error.message);
        return { replies: [], error: error.message };
      }

      return { replies: (data || []) as QuickReply[], error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar respuestas rápidas';
      console.error('[WA-CRM][QuickReplyService] Error:', msg);
      return { replies: [], error: msg };
    }
  }

  /**
   * Crea una nueva respuesta rápida en el workspace.
   */
  public static async createQuickReply(
    supabase: SupabaseClient,
    workspaceId: string,
    shortcut: string,
    title: string,
    content: string,
    createdBy: string | null
  ): Promise<{ reply: QuickReply | null; error: string | null }> {
    try {
      const newReply = {
        workspace_id: workspaceId,
        shortcut: shortcut.trim().startsWith('/') ? shortcut.trim() : `/${shortcut.trim()}`,
        title: title.trim(),
        content: content.trim(),
        created_by: createdBy,
      };

      const { data, error } = await supabase
        .from('quick_replies')
        .insert(newReply)
        .select()
        .single();

      if (error) {
        console.warn('[WA-CRM][QuickReplyService] Error al insertar respuesta rápida:', error.message);
        return { reply: null, error: error.message };
      }

      return { reply: data as QuickReply, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al crear respuesta rápida';
      console.error('[WA-CRM][QuickReplyService] Error:', msg);
      return { reply: null, error: msg };
    }
  }

  /**
   * Modifica una respuesta rápida existente.
   */
  public static async updateQuickReply(
    supabase: SupabaseClient,
    replyId: string,
    updates: Partial<Omit<QuickReply, 'id' | 'workspace_id' | 'created_at'>>
  ): Promise<{ reply: QuickReply | null; error: string | null }> {
    try {
      const formattedUpdates: any = { ...updates };
      if (updates.shortcut) {
        const sh = updates.shortcut.trim();
        formattedUpdates.shortcut = sh.startsWith('/') ? sh : `/${sh}`;
      }
      if (updates.title) formattedUpdates.title = updates.title.trim();
      if (updates.content) formattedUpdates.content = updates.content.trim();

      const { data, error } = await supabase
        .from('quick_replies')
        .update(formattedUpdates)
        .select()
        .single();

      if (error) {
        console.warn('[WA-CRM][QuickReplyService] Error al actualizar respuesta rápida:', error.message);
        return { reply: null, error: error.message };
      }

      return { reply: data as QuickReply, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al actualizar respuesta rápida';
      console.error('[WA-CRM][QuickReplyService] Error:', msg);
      return { reply: null, error: msg };
    }
  }

  /**
   * Elimina una respuesta rápida.
   */
  public static async deleteQuickReply(
    supabase: SupabaseClient,
    replyId: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('quick_replies')
        .delete()
        .eq('id', replyId);

      if (error) {
        console.warn('[WA-CRM][QuickReplyService] Error al eliminar respuesta rápida:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al eliminar respuesta rápida';
      console.error('[WA-CRM][QuickReplyService] Error:', msg);
      return { success: false, error: msg };
    }
  }
}
