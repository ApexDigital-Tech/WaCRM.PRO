// ============================================================
// WorkflowService — Gestión de Automatizaciones & Flujos (Sprint v8.3.0)
// CRUD y consultas de base de datos para workflows y steps.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workflow, WorkflowStep } from '@wa-crm/types';

export class WorkflowService {
  /**
   * Carga todos los workflows de un workspace, junto con sus pasos ordenados.
   */
  public static async getWorkspacesWorkflows(
    supabase: SupabaseClient,
    workspaceId: string
  ): Promise<{ workflows: (Workflow & { steps: WorkflowStep[] })[]; error: string | null }> {
    try {
      // 1. Cargar cabeceras de workflows
      const { data: flows, error: flowsErr } = await supabase
        .from('workflows')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (flowsErr) {
        console.warn('[WA-CRM][WorkflowService] Error al cargar workflows:', flowsErr.message);
        return { workflows: [], error: flowsErr.message };
      }

      if (!flows || flows.length === 0) {
        return { workflows: [], error: null };
      }

      const flowIds = flows.map((f) => f.id);

      // 2. Cargar todos los pasos asociados en lote
      const { data: steps, error: stepsErr } = await supabase
        .from('workflow_steps')
        .select('*')
        .in('workflow_id', flowIds)
        .order('step_order', { ascending: true });

      if (stepsErr) {
        console.warn('[WA-CRM][WorkflowService] Error al cargar pasos de workflows:', stepsErr.message);
        return {
          workflows: flows.map((f) => ({ ...f, steps: [] })) as any,
          error: stepsErr.message,
        };
      }

      // 3. Agrupar pasos en sus respectivos workflows
      const grouped = flows.map((flow) => {
        const flowSteps = (steps || []).filter((s) => s.workflow_id === flow.id);
        return {
          ...flow,
          steps: flowSteps as WorkflowStep[],
        };
      });

      return { workflows: grouped as (Workflow & { steps: WorkflowStep[] })[], error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar automatizaciones';
      console.error('[WA-CRM][WorkflowService] Error:', msg);
      return { workflows: [], error: msg };
    }
  }

  /**
   * Cambia el estado de activación de un flujo (Activo/Inactivo).
   */
  public static async toggleWorkflowActive(
    supabase: SupabaseClient,
    workflowId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: isActive })
        .eq('id', workflowId);

      if (error) {
        console.warn('[WA-CRM][WorkflowService] Error al cambiar estado del flujo:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al actualizar estado del flujo';
      console.error('[WA-CRM][WorkflowService] Error:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Crea un nuevo flujo de trabajo (workflow).
   */
  public static async createWorkflow(
    supabase: SupabaseClient,
    workspaceId: string,
    name: string,
    triggerType: 'keyword' | 'welcome',
    keywords: string[]
  ): Promise<{ workflow: Workflow | null; error: string | null }> {
    try {
      const newFlow = {
        workspace_id: workspaceId,
        name: name.trim(),
        trigger_type: triggerType,
        keywords: triggerType === 'keyword' ? keywords.map((k) => k.trim().toLowerCase()) : [],
        is_active: false,
      };

      const { data, error } = await supabase
        .from('workflows')
        .insert(newFlow)
        .select()
        .single();

      if (error) {
        console.warn('[WA-CRM][WorkflowService] Error al insertar workflow:', error.message);
        return { workflow: null, error: error.message };
      }

      return { workflow: data as Workflow, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al crear workflow';
      console.error('[WA-CRM][WorkflowService] Error:', msg);
      return { workflow: null, error: msg };
    }
  }

  /**
   * Crea un paso secuencial para un flujo de trabajo.
   */
  public static async createWorkflowStep(
    supabase: SupabaseClient,
    workflowId: string,
    step: Omit<WorkflowStep, 'id' | 'workflow_id' | 'created_at'>
  ): Promise<{ step: WorkflowStep | null; error: string | null }> {
    try {
      const newStep = {
        workflow_id: workflowId,
        step_order: step.step_order,
        type: step.type,
        delay_seconds: step.delay_seconds,
        message_content: step.message_content?.trim() || null,
        tag_id: step.tag_id || null,
      };

      const { data, error } = await supabase
        .from('workflow_steps')
        .insert(newStep)
        .select()
        .single();

      if (error) {
        console.warn('[WA-CRM][WorkflowService] Error al insertar paso de flujo:', error.message);
        return { step: null, error: error.message };
      }

      return { step: data as WorkflowStep, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al crear paso de flujo';
      console.error('[WA-CRM][WorkflowService] Error:', msg);
      return { step: null, error: msg };
    }
  }
}
