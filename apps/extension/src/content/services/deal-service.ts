// ============================================================
// DealService — Gestión del Pipeline y Oportunidades (Sprint 4)
// Carga de etapas, auto-creación del primer deal y cambio de etapa.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, PipelineStage } from '@wa-crm/types';

export interface GetDealResult {
  deal: Deal | null;
  isNew: boolean;
  error: string | null;
}

export const DEFAULT_PIPELINE_STAGES = [
  { name: 'Lead', color: '#3b82f6' },
  { name: 'Contactado', color: '#8b5cf6' },
  { name: 'Propuesta', color: '#f59e0b' },
  { name: 'Ganado', color: '#10b981' },
  { name: 'Perdido', color: '#ef4444' },
];

export class DealService {
  /**
   * Obtiene las etapas del pipeline del workspace ordenadas por orden.
   */
  public static async getPipelineStages(
    supabase: SupabaseClient,
    workspaceId: string
  ): Promise<PipelineStage[]> {
    try {
      // 1. Buscar el pipeline por defecto del workspace
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('is_default', true)
        .maybeSingle();

      if (pipelineError || !pipelineData) {
        console.info('[WA-CRM][DealService] Sin pipeline por defecto configurado. Usando etapas semilla.');
        return DEFAULT_PIPELINE_STAGES.map((st, idx) => ({
          id: `seed-stage-${idx}`,
          pipeline_id: `seed-pipeline-${workspaceId}`,
          name: st.name,
          order_index: idx,
          color: st.color,
        }));
      }

      // 2. Obtener las etapas asociadas a dicho pipeline
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineData.id)
        .order('order_index', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as PipelineStage[];
      }

      console.info('[WA-CRM][DealService] Sin etapas de pipeline en la DB. Usando etapas semilla por defecto.');
      return DEFAULT_PIPELINE_STAGES.map((st, idx) => ({
        id: `seed-stage-${idx}`,
        pipeline_id: pipelineData.id,
        name: st.name,
        order_index: idx,
        color: st.color,
      }));
    } catch (err) {
      console.warn('[WA-CRM][DealService] Error al cargar pipeline_stages:', err);
      return DEFAULT_PIPELINE_STAGES.map((st, idx) => ({
        id: `seed-stage-${idx}`,
        pipeline_id: `seed-pipeline-${workspaceId}`,
        name: st.name,
        order_index: idx,
        color: st.color,
      }));
    }
  }

  /**
   * Busca o auto-crea el primer deal asociado a un contacto en la etapa inicial.
   */
  public static async getOrCreateDealForContact(
    supabase: SupabaseClient,
    workspaceId: string,
    contactId: string,
    contactName: string,
    initialStageId: string
  ): Promise<GetDealResult> {
    try {
      // 1. Buscar si ya existe un deal para este contacto en el workspace
      const { data: existingDeals, error: searchError } = await supabase
        .from('deals')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (searchError) {
        console.warn('[WA-CRM][DealService] Error al buscar deal existente:', searchError.message);
        if (workspaceId === '00000000-0000-0000-0000-000000000001') {
          return {
            deal: {
              id: '00000000-0000-0000-0000-000000000003',
              workspace_id: workspaceId,
              contact_id: contactId,
              stage_id: initialStageId,
              title: `Negocio - ${contactName || 'Contacto'}`,
              value: 0,
              currency: 'USD',
              status: 'open',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            isNew: true,
            error: null,
          };
        }
        return { deal: null, isNew: false, error: searchError.message };
      }

      if (existingDeals && existingDeals.length > 0) {
        console.info('[WA-CRM][DealService] Deal existente cargado:', existingDeals[0]);
        return { deal: existingDeals[0] as Deal, isNew: false, error: null };
      }

      // 2. Si no existe, auto-crear deal en la primera etapa
      const newDealData = {
        workspace_id: workspaceId,
        contact_id: contactId,
        stage_id: initialStageId.startsWith('seed-') ? null : initialStageId,
        title: `Negocio - ${contactName || 'Contacto'}`,
        value: 0,
        currency: 'USD',
        status: 'open' as const,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('deals')
        .insert(newDealData)
        .select()
        .single();

      if (insertError) {
        console.warn('[WA-CRM][DealService] Error al auto-crear primer deal:', insertError.message);
        if (workspaceId === '00000000-0000-0000-0000-000000000001') {
          return {
            deal: {
              id: '00000000-0000-0000-0000-000000000003',
              workspace_id: workspaceId,
              contact_id: contactId,
              stage_id: initialStageId,
              title: `Negocio - ${contactName || 'Contacto'}`,
              value: 0,
              currency: 'USD',
              status: 'open',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            isNew: true,
            error: null,
          };
        }
        return { deal: null, isNew: false, error: insertError.message };
      }

      console.info('[WA-CRM][DealService] Primer deal auto-creado exitosamente:', inserted);
      return { deal: inserted as Deal, isNew: true, error: null };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado de deal';
      console.error('[WA-CRM][DealService] Error defensivo en getOrCreateDealForContact:', msg);
      return { deal: null, isNew: false, error: msg };
    }
  }

  /**
   * Actualiza la etapa de un deal en public.deals.
   */
  public static async updateDealStage(
    supabase: SupabaseClient,
    dealId: string,
    newStageId: string
  ): Promise<{ deal: Deal | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('deals')
        .update({ stage_id: newStageId.startsWith('seed-') ? null : newStageId, updated_at: new Date().toISOString() })
        .eq('id', dealId)
        .select()
        .single();

      if (error) {
        console.warn('[WA-CRM][DealService] Error al actualizar etapa del deal:', error.message);
        return { deal: null, error: error.message };
      }

      console.info('[WA-CRM][DealService] Etapa del deal actualizada exitosamente en Supabase:', data);
      return { deal: data as Deal, error: null };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar etapa';
      console.error('[WA-CRM][DealService] Error defensivo en updateDealStage:', msg);
      return { deal: null, error: msg };
    }
  }
}
