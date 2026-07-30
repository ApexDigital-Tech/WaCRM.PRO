// ============================================================
// WorkflowEngine — Motor de Automatizaciones & Flujos (Sprint v8.3.0)
// Orquesta y ejecuta secuencias de flujos al recibir mensajes.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workflow, WorkflowStep } from '@wa-crm/types';
import { WorkflowService } from './workflow-service';
import { WhatsAppDomService } from '../dom-service';

export class WorkflowEngine {
  private static instance: WorkflowEngine | null = null;
  
  private supabase: SupabaseClient | null = null;
  private workspaceId: string | null = null;
  private activeWorkflows: (Workflow & { steps: WorkflowStep[] })[] = [];
  
  // Rastrear ejecuciones en curso para evitar bucles o ejecuciones concurrentes por JID
  private runningFlows = new Set<string>(); // Formato: "jid:workflowId"

  private constructor() {}

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Inicializa el motor con el cliente Supabase y el workspace activo.
   */
  public async init(supabase: SupabaseClient, workspaceId: string): Promise<void> {
    this.supabase = supabase;
    this.workspaceId = workspaceId;
    await this.reloadWorkflows();
    console.info('[WA-CRM][WorkflowEngine] Inicializado con %d flujos cargados.', this.activeWorkflows.length);
  }

  /**
   * Recarga las automatizaciones configuradas desde Supabase.
   */
  public async reloadWorkflows(): Promise<void> {
    if (!this.supabase || !this.workspaceId) return;
    const { workflows, error } = await WorkflowService.getWorkspacesWorkflows(this.supabase, this.workspaceId);
    if (!error) {
      // Filtrar y guardar solo los flujos marcados como activos
      this.activeWorkflows = workflows.filter((w) => w.is_active);
    }
  }

  /**
   * Evalúa un mensaje entrante recibido en WhatsApp Web.
   */
  public async processIncomingMessage(senderJid: string, textContent: string): Promise<void> {
    if (!this.supabase || !this.workspaceId || this.activeWorkflows.length === 0) return;

    const cleanText = textContent.trim().toLowerCase();
    const cleanJid = senderJid.trim();

    // 1. Evaluar cada flujo activo cargado en memoria
    for (const flow of this.activeWorkflows) {
      if (flow.trigger_type !== 'keyword') continue;

      // Comprobar coincidencia de palabra clave
      const hasMatch = flow.keywords.some((keyword) => {
        const kw = keyword.trim().toLowerCase();
        // Coincidencia exacta o contención inteligente
        return cleanText === kw || cleanText.includes(kw);
      });

      if (!hasMatch) continue;

      const runKey = `${cleanJid}:${flow.id}`;
      if (this.runningFlows.has(runKey)) {
        console.info('[WA-CRM][WorkflowEngine] Flujo %s ya está corriendo para %s, omitiendo.', flow.name, cleanJid);
        continue;
      }

      // Iniciar ejecución asíncrona del flujo
      this.runningFlows.add(runKey);
      console.info('[WA-CRM][WorkflowEngine] Gatillando flujo "%s" para %s por palabra clave.', flow.name, cleanJid);
      
      void this.executeWorkflowSteps(flow, cleanJid).then(() => {
        this.runningFlows.delete(runKey);
      });
    }
  }

  /**
   * Ejecuta secuencialmente los pasos de un flujo de trabajo.
   */
  private async executeWorkflowSteps(flow: Workflow & { steps: WorkflowStep[] }, jid: string): Promise<void> {
    if (!this.supabase || !this.workspaceId) return;

    for (const step of flow.steps) {
      console.info('[WA-CRM][WorkflowEngine] Ejecutando paso %d (%s) de flujo %s para %s', step.step_order, step.type, flow.name, jid);

      try {
        if (step.type === 'message' && step.message_content) {
          // Inyectar y enviar el mensaje automáticamente
          WhatsAppDomService.getInstance().sendMessageAutomatically(step.message_content);
        } 
        else if (step.type === 'delay' && step.delay_seconds > 0) {
          // Pausa asíncrona
          await new Promise((resolve) => setTimeout(resolve, step.delay_seconds * 1000));
        } 
        else if (step.type === 'tag_add' && step.tag_id) {
          // Asociar etiqueta al contacto en la base de datos
          const cleanPhone = jid.split('@')[0];
          
          // Buscar ID del contacto por teléfono
          const { data: contact, error: contactErr } = await this.supabase
            .from('contacts')
            .select('id')
            .eq('workspace_id', this.workspaceId)
            .eq('phone_number', cleanPhone)
            .maybeSingle();

          if (contactErr) {
            console.warn('[WA-CRM][WorkflowEngine] Error al buscar contacto para etiquetar:', contactErr.message);
          } else if (contact) {
            // Insertar asociación de etiqueta
            const { error: tagErr } = await this.supabase
              .from('contact_tags')
              .insert({
                contact_id: contact.id,
                tag_id: step.tag_id,
              })
              .select();

            if (tagErr) {
              console.warn('[WA-CRM][WorkflowEngine] Error al etiquetar contacto en base de datos:', tagErr.message);
            } else {
              console.info('[WA-CRM][WorkflowEngine] Etiqueta añadida exitosamente al contacto %s', cleanPhone);
            }
          } else {
            console.warn('[WA-CRM][WorkflowEngine] Contacto %s no encontrado para etiquetar.', cleanPhone);
          }
        }
      } catch (err) {
        console.error('[WA-CRM][WorkflowEngine] Error ejecutando paso del flujo:', err);
      }
    }
  }
}
