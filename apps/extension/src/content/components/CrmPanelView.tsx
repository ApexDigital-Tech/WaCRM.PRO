// ============================================================
// CrmPanelView — Vista principal del panel CRM (Sprint 5 — Quick Replies)
// Auto-sincronización de contactos, pipeline Kanban y respuestas rápidas.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import { RealtimeManager } from '../realtime-manager';
import { WhatsAppDomService } from '../dom-service';
import { ContactService } from '../services/contact-service';
import { DealService } from '../services/deal-service';
import { NoteService } from '../services/note-service';
import { QuickReplyService } from '../services/quick-reply-service';
import { WorkflowService } from '../services/workflow-service';
import { WorkflowEngine } from '../services/workflow-engine';
import { ActiveContactCard } from './ActiveContactCard';
import { PipelineSelector } from './PipelineSelector';
import type { ConnectionStatus, ActiveChatInfo, Contact, Deal, PipelineStage, Note, QuickReply, Workflow, WorkflowStep } from '@wa-crm/types';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

interface CrmPanelViewProps {
  accessToken: string;
  workspaceId: string;
  onConnectionChange: (status: ConnectionStatus, attempt: number) => void;
  onSignOut: () => void;
}

export function CrmPanelView({
  accessToken,
  workspaceId,
  onConnectionChange,
  onSignOut,
}: CrmPanelViewProps) {
  const realtimeRef = useRef<RealtimeManager | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Instancia de cliente Supabase Singleton
  if (!supabaseRef.current) {
    const supabase = getSupabaseClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: '' });
    supabaseRef.current = supabase;
  }

  // Estado del chat activo desde WhatsAppDomService
  const [chatInfo, setChatInfo] = useState<ActiveChatInfo>({
    jid: null,
    phoneNumber: null,
    name: null,
    avatarUrl: null,
    status: 'INITIALIZING',
    source: 'LOCAL_FALLBACK',
  });

  // Estados de CRM Core (Sprint 4)
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [currentDeal, setCurrentDeal] = useState<Deal | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isSyncingContact, setIsSyncingContact] = useState<boolean>(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Estados de Notas (Sprint v8.1.0)
  const [notes, setNotes] = useState<(Note & { saving?: boolean; deleting?: boolean })[]>([]);
  const [isSyncingNotes, setIsSyncingNotes] = useState<boolean>(false);
  const [newNoteContent, setNewNoteContent] = useState<string>('');

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'crm' | 'quick_replies' | 'workflows'>('crm');

  // Estados de Respuestas Rápidas (Sprint v8.2.0)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [isSyncingReplies, setIsSyncingReplies] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Formulario de respuestas rápidas
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [formShortcut, setFormShortcut] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');

  // Datos heredados v7
  const [legacyReplies, setLegacyReplies] = useState<any[]>([]);
  const [showLegacyImportAlert, setShowLegacyImportAlert] = useState<boolean>(false);
  const [isSyncingLegacy, setIsSyncingLegacy] = useState<boolean>(false);

  // Estados de Automatizaciones (Sprint v8.3.0)
  const [workflows, setWorkflows] = useState<(Workflow & { steps: WorkflowStep[] })[]>([]);
  const [isSyncingWorkflows, setIsSyncingWorkflows] = useState<boolean>(false);

  // Formulario de workflows
  const [isFlowFormOpen, setIsFlowFormOpen] = useState<boolean>(false);
  const [flowName, setFlowName] = useState<string>('');
  const [flowTriggerType, setFlowTriggerType] = useState<'keyword' | 'welcome'>('keyword');
  const [flowKeywordsStr, setFlowKeywordsStr] = useState<string>('');
  const [flowFirstMessage, setFlowFirstMessage] = useState<string>('');

  // ────────────────────────────────────────────────────────────
  // 1. INICIALIZACIÓN DE SERVICIOS Y SINCRO REALTIME
  // ────────────────────────────────────────────────────────────

  useEffect(() => {
    // a. Iniciar RealtimeManager
    const manager = new RealtimeManager(__SUPABASE_URL__, accessToken, workspaceId, __SUPABASE_ANON_KEY__);

    const unsubRealtime = manager.on((event) => {
      if (event.type === 'STATUS_CHANGE') {
        onConnectionChange(event.status, event.attempt);
        console.info('[WA-CRM][Realtime] Status: %s (intento %d)', event.status, event.attempt);
      } else if (event.type === 'POSTGRES_CHANGE') {
        const { table, record } = event.payload;
        console.info('[WA-CRM][Realtime] Postgres Change recibido en tabla %s:', table, record);

        // Escuchar cambios multi-agente en la tabla deals
        if (table === 'deals' && record) {
          const updatedDeal = record as Deal;
          // Actualizar estado local si el deal corresponde al contacto activo
          setCurrentDeal((prev) => {
            if (prev && (prev.id === updatedDeal.id || prev.contact_id === updatedDeal.contact_id)) {
              console.info('[WA-CRM][Realtime] Deal actualizado al instante por otro agente:', updatedDeal);
              return { ...prev, ...updatedDeal };
            }
            return prev;
          });
        }
      }
    });

    manager.start();
    realtimeRef.current = manager;

    // b. Iniciar y Suscribirse a WhatsAppDomService
    const domService = WhatsAppDomService.getInstance();
    domService.init(__SUPABASE_URL__, __SUPABASE_ANON_KEY__);

    const unsubDom = domService.subscribe((info) => {
      setChatInfo(info);
    });

    // Escuchar reconexión manual desde el banner
    const handleManualReconnect = () => {
      console.info('[WA-CRM] Evento manual-reconnect recibido');
      handleRetry();
    };
    window.addEventListener('wa-crm:manual-reconnect', handleManualReconnect);

    return () => {
      unsubRealtime();
      unsubDom();
      manager.stop();
      realtimeRef.current = null;
      window.removeEventListener('wa-crm:manual-reconnect', handleManualReconnect);
    };
  }, [accessToken, workspaceId]);

  // Carga inicial y auto-detección de plantillas legacy (Sprint v8.2.0)
  useEffect(() => {
    loadQuickReplies();

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['respostasRapidas'], (res) => {
          if (res && res.respostasRapidas && Array.isArray(res.respostasRapidas) && res.respostasRapidas.length > 0) {
            console.info('[WA-CRM] Detección de %d respuestas rápidas legacy v7', res.respostasRapidas.length);
            setLegacyReplies(res.respostasRapidas);
            setShowLegacyImportAlert(true);
          }
        });
      }
    } catch (e) {
      console.warn('[WA-CRM] Error al verificar storage de Chrome para plantillas legacy:', e);
    }
  }, [workspaceId]);

  // Carga inicial e inicialización del Motor de Automatizaciones (Sprint v8.3.0)
  useEffect(() => {
    loadWorkflows();

    if (supabaseRef.current) {
      // Inicializar / Sincronizar el engine en background
      WorkflowEngine.getInstance().init(supabaseRef.current, workspaceId)
        .catch((err) => console.error('[WA-CRM] Error al inicializar WorkflowEngine:', err));
    }
  }, [workspaceId, activeTab]);

  // ────────────────────────────────────────────────────────────
  // 2. AUTO-SINCRONIZACIÓN DE CONTACTOS Y DEALS AL CAMBIAR DE CHAT
  // ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (chatInfo.status !== 'ACTIVE' || (!chatInfo.phoneNumber && !chatInfo.jid)) {
      setCurrentContact(null);
      setCurrentDeal(null);
      setNotes([]);
      setSyncError(null);
      return;
    }

    let isMounted = true;
    async function syncActiveChatData() {
      setIsSyncingContact(true);
      setSyncError(null);

      const supabase = supabaseRef.current;
      if (!supabase) return;

      const rawPhone = chatInfo.phoneNumber || chatInfo.jid || '';
      console.info('[WA-CRM] Sincronizando contacto para:', rawPhone, chatInfo.name);

      // a. Auto-sincronizar contacto en public.contacts
      const contactResult = await ContactService.syncContact(supabase, workspaceId, rawPhone, chatInfo.name);

      if (!isMounted) return;

      if (contactResult.error) {
        setSyncError(contactResult.error);
        setIsSyncingContact(false);
        return;
      }

      if (contactResult.contact) {
        setCurrentContact(contactResult.contact);

        // Cargar notas asociadas
        setIsSyncingNotes(true);
        const notesResult = await NoteService.getNotesForContact(supabase, contactResult.contact.id);
        if (isMounted) {
          setNotes(notesResult.notes);
          setIsSyncingNotes(false);
        }

        // b. Cargar etapas de pipeline del workspace
        const loadedStages = await DealService.getPipelineStages(supabase, workspaceId);
        if (isMounted) setStages(loadedStages);

        const initialStageId = loadedStages[0]?.id || '';

        // c. Buscar o auto-crear el primer deal asociado
        const dealResult = await DealService.getOrCreateDealForContact(
          supabase,
          workspaceId,
          contactResult.contact.id,
          contactResult.contact.name || chatInfo.name || 'Contacto',
          initialStageId
        );

        if (isMounted) {
          if (dealResult.error) {
            console.warn('[WA-CRM] Error al cargar/crear deal:', dealResult.error);
          } else {
            setCurrentDeal(dealResult.deal);
          }
          setIsSyncingContact(false);
        }
      }
    }

    syncActiveChatData();

    return () => {
      isMounted = false;
    };
  }, [chatInfo.jid, chatInfo.phoneNumber, chatInfo.status, workspaceId]);

  // ────────────────────────────────────────────────────────────
  // 3. CAMBIO INTERACTIVO DE ETAPA EN EL KANBAN
  // ────────────────────────────────────────────────────────────

  async function handleStageChange(newStageId: string) {
    if (!currentDeal || !supabaseRef.current || isUpdatingStage) return;

    setIsUpdatingStage(true);
    console.info('[WA-CRM] Cambiando etapa del deal %s a:', currentDeal.id, newStageId);

    // Optimistic UI Update
    const previousStageId = currentDeal.stage_id;
    setCurrentDeal((prev) => (prev ? { ...prev, stage_id: newStageId } : null));

    const { deal: updated, error } = await DealService.updateDealStage(
      supabaseRef.current,
      currentDeal.id,
      newStageId
    );

    setIsUpdatingStage(false);

    if (error) {
      console.error('[WA-CRM] Fallo al actualizar etapa. Revirtiendo UI:', error);
      setCurrentDeal((prev) => (prev ? { ...prev, stage_id: previousStageId } : null));
    } else if (updated) {
      setCurrentDeal(updated);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 4. CRUD DE NOTAS PRIVADAS CON OPTIMISTIC UI
  // ────────────────────────────────────────────────────────────

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    const content = newNoteContent.trim();
    if (!content || !currentContact || !supabaseRef.current) return;

    const tempId = `temp-note-${Date.now()}`;
    const authorId = '00000000-0000-0000-0000-000000000001';

    // 1. Agregar nota optimistamente al estado local (al principio)
    const tempNote: Note & { saving: boolean } = {
      id: tempId,
      workspace_id: workspaceId,
      contact_id: currentContact.id,
      content,
      created_by: authorId,
      created_at: new Date().toISOString(),
      saving: true,
    };

    setNotes((prev) => [tempNote, ...prev]);
    setNewNoteContent('');

    // 2. Ejecutar inserción en Supabase en background
    const { note: savedNote, error } = await NoteService.createNote(
      supabaseRef.current,
      workspaceId,
      currentContact.id,
      content,
      authorId
    );

    if (error) {
      console.error('[WA-CRM] Error al guardar nota. Revirtiendo UI:', error);
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setSyncError('No se pudo guardar la nota en Supabase. Inténtalo de nuevo.');
    } else if (savedNote) {
      // Reemplazar la nota temporal por la nota guardada
      setNotes((prev) => prev.map((n) => (n.id === tempId ? savedNote : n)));
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!supabaseRef.current) return;

    const noteToDelete = notes.find((n) => n.id === noteId);
    if (!noteToDelete || noteToDelete.saving) return;

    // 1. Eliminar optimistamente de la UI
    setNotes((prev) => prev.filter((n) => n.id !== noteId));

    // 2. Ejecutar eliminación en Supabase en background
    const { success, error } = await NoteService.deleteNote(supabaseRef.current, noteId);

    if (error || !success) {
      console.error('[WA-CRM] Error al eliminar nota. Revirtiendo UI:', error);
      if (noteToDelete) {
        setNotes((prev) => {
          const restored = [...prev, noteToDelete];
          return restored.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
      }
      setSyncError('No se pudo eliminar la nota en Supabase.');
    }
  }

  // ────────────────────────────────────────────────────────────
  // 5. CRUD DE RESPUESTAS RÁPIDAS (Sprint v8.2.0)
  // ────────────────────────────────────────────────────────────

  async function loadQuickReplies() {
    if (!supabaseRef.current) return;
    setIsSyncingReplies(true);
    const { replies, error } = await QuickReplyService.getQuickReplies(supabaseRef.current, workspaceId);
    if (!error) {
      setQuickReplies(replies);
    }
    setIsSyncingReplies(false);
  }

  async function handleSaveQuickReply(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseRef.current) return;

    const sh = formShortcut.trim();
    const shortcut = sh.startsWith('/') ? sh : `/${sh}`;
    const title = formTitle.trim();
    const content = formContent.trim();

    if (!shortcut || !title || !content) return;

    const authorId = '00000000-0000-0000-0000-000000000001';

    if (editingReply) {
      const previousReplies = [...quickReplies];
      const updatedReply = { ...editingReply, shortcut, title, content };
      setQuickReplies((prev) => prev.map((r) => r.id === editingReply.id ? updatedReply : r));
      setIsFormOpen(false);

      const { reply, error } = await QuickReplyService.updateQuickReply(supabaseRef.current, editingReply.id, {
        shortcut,
        title,
        content
      });

      if (error) {
        console.error('[WA-CRM] Error al actualizar plantilla. Revirtiendo UI:', error);
        setQuickReplies(previousReplies);
        setSyncError(`Error al actualizar plantilla: ${error}`);
      } else if (reply) {
        setQuickReplies((prev) => prev.map((r) => r.id === editingReply.id ? reply : r));
      }
    } else {
      const tempId = `temp-reply-${Date.now()}`;
      const tempReply: QuickReply = {
        id: tempId,
        workspace_id: workspaceId,
        shortcut,
        title,
        content,
        created_by: authorId,
        created_at: new Date().toISOString()
      };
      setQuickReplies((prev) => [...prev, tempReply].sort((a, b) => a.title.localeCompare(b.title)));
      setIsFormOpen(false);

      const { reply, error } = await QuickReplyService.createQuickReply(
        supabaseRef.current,
        workspaceId,
        shortcut,
        title,
        content,
        authorId
      );

      if (error) {
        console.error('[WA-CRM] Error al guardar plantilla. Revirtiendo UI:', error);
        setQuickReplies((prev) => prev.filter((r) => r.id !== tempId));
        setSyncError(`Error al guardar plantilla: ${error}`);
      } else if (reply) {
        setQuickReplies((prev) => prev.map((r) => r.id === tempId ? reply : r).sort((a, b) => a.title.localeCompare(b.title)));
      }
    }
  }

  async function handleDeleteQuickReply(replyId: string) {
    if (!supabaseRef.current) return;
    const replyToDelete = quickReplies.find((r) => r.id === replyId);
    if (!replyToDelete) return;

    setQuickReplies((prev) => prev.filter((r) => r.id !== replyId));

    const { success, error } = await QuickReplyService.deleteQuickReply(supabaseRef.current, replyId);

    if (error || !success) {
      console.error('[WA-CRM] Error al eliminar plantilla. Revirtiendo UI:', error);
      setQuickReplies((prev) => [...prev, replyToDelete].sort((a, b) => a.title.localeCompare(b.title)));
      setSyncError(`Error al eliminar plantilla: ${error}`);
    }
  }

  async function handleImportLegacyReplies() {
    if (!supabaseRef.current || legacyReplies.length === 0 || isSyncingLegacy) return;
    setIsSyncingLegacy(true);
    setSyncError(null);
    let successCount = 0;
    const authorId = '00000000-0000-0000-0000-000000000001';

    for (const legacy of legacyReplies) {
      const shortcut = legacy.atalho || legacy.shortcut || 'importado';
      const title = legacy.titulo || legacy.title || `Plantilla ${shortcut}`;
      const content = legacy.mensagem || legacy.content || '';
      if (!content) continue;

      const { error } = await QuickReplyService.createQuickReply(
        supabaseRef.current,
        workspaceId,
        shortcut,
        title,
        content,
        authorId
      );
      if (!error) successCount++;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['respostasRapidas'], () => {
        setLegacyReplies([]);
        setShowLegacyImportAlert(false);
        setIsSyncingLegacy(false);
        loadQuickReplies();
      });
    } else {
      setLegacyReplies([]);
      setShowLegacyImportAlert(false);
      setIsSyncingLegacy(false);
      loadQuickReplies();
    }
  }

  function handleUseQuickReply(content: string) {
    WhatsAppDomService.getInstance().insertTextIntoChatInput(content);
  }

  // ────────────────────────────────────────────────────────────
  // 6. MANEJO DE AUTOMATIZACIONES (Sprint v8.3.0)
  // ────────────────────────────────────────────────────────────

  async function loadWorkflows() {
    if (!supabaseRef.current) return;
    setIsSyncingWorkflows(true);
    const { workflows: data, error } = await WorkflowService.getWorkspacesWorkflows(supabaseRef.current, workspaceId);
    if (!error) {
      setWorkflows(data);
    }
    setIsSyncingWorkflows(false);
  }

  async function handleToggleWorkflow(flowId: string, currentStatus: boolean) {
    if (!supabaseRef.current) return;
    const targetFlow = workflows.find((w) => w.id === flowId);
    if (!targetFlow) return;

    const newStatus = !currentStatus;

    // 1. Modificación optimista
    setWorkflows((prev) =>
      prev.map((w) => (w.id === flowId ? { ...w, is_active: newStatus } : w))
    );

    // 2. Ejecutar en Supabase
    const { success, error } = await WorkflowService.toggleWorkflowActive(
      supabaseRef.current,
      flowId,
      newStatus
    );

    if (error || !success) {
      console.error('[WA-CRM] Error al cambiar estado de flujo. Revirtiendo:', error);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === flowId ? { ...w, is_active: currentStatus } : w))
      );
      setSyncError(`Error al conmutar flujo: ${error}`);
    } else {
      // Recargar engine
      WorkflowEngine.getInstance().reloadWorkflows();
    }
  }

  async function handleSaveWorkflow(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseRef.current) return;

    const name = flowName.trim();
    const type = flowTriggerType;
    const kwStr = flowKeywordsStr.trim();
    const message = flowFirstMessage.trim();

    if (!name || (type === 'keyword' && !kwStr) || !message) return;

    const keywords = type === 'keyword' ? kwStr.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean) : [];

    // 1. Inserción optimista
    const tempId = `temp-flow-${Date.now()}`;
    const tempFlow: Workflow & { steps: WorkflowStep[] } = {
      id: tempId,
      workspace_id: workspaceId,
      name,
      trigger_type: type,
      keywords,
      is_active: false,
      created_at: new Date().toISOString(),
      steps: [
        {
          id: `temp-step-${Date.now()}`,
          workflow_id: tempId,
          step_order: 1,
          type: 'message',
          delay_seconds: 0,
          message_content: message,
          created_at: new Date().toISOString(),
        },
      ],
    };

    setWorkflows((prev) => [tempFlow, ...prev]);
    setIsFlowFormOpen(false);

    // 2. Ejecución real
    const { workflow: createdFlow, error: flowErr } = await WorkflowService.createWorkflow(
      supabaseRef.current,
      workspaceId,
      name,
      type,
      keywords
    );

    if (flowErr || !createdFlow) {
      console.error('[WA-CRM] Error creando cabecera del flujo:', flowErr);
      setWorkflows((prev) => prev.filter((w) => w.id !== tempId));
      setSyncError(`Error creando flujo: ${flowErr}`);
      return;
    }

    const { step: createdStep, error: stepErr } = await WorkflowService.createWorkflowStep(
      supabaseRef.current,
      createdFlow.id,
      {
        step_order: 1,
        type: 'message',
        delay_seconds: 0,
        message_content: message,
      }
    );

    if (stepErr || !createdStep) {
      console.error('[WA-CRM] Error al crear paso del flujo:', stepErr);
      setSyncError(`Error creando paso del flujo: ${stepErr}`);
      loadWorkflows();
    } else {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === tempId ? { ...createdFlow, steps: [createdStep] } : w
        )
      );
      WorkflowEngine.getInstance().reloadWorkflows();
    }
  }

  function handleRetry() {
    const manager = realtimeRef.current;
    if (!manager) return;
    manager.stop();

    const newManager = new RealtimeManager(__SUPABASE_URL__, accessToken, workspaceId, __SUPABASE_ANON_KEY__);
    const unsub = newManager.on((event) => {
      if (event.type === 'STATUS_CHANGE') {
        onConnectionChange(event.status, event.attempt);
      }
    });
    newManager.start();
    realtimeRef.current = newManager;
    console.info('[WA-CRM][Realtime] Reconexión manual iniciada.');
    void unsub;
  }

  function handleSimulateBrokenSelector() {
    console.warn('[WA-CRM][TEST] Simulando selector roto (DoD Checkpoint 4)...');
    WhatsAppDomService.getInstance().simulateBrokenSelector('chat_title');
  }

  function handleSimulateUpsertError() {
    console.warn('[WA-CRM][TEST] Simulando error de upsert/sincronización (DoD Checkpoint 6)...');
    setSyncError('Simulación de error de red/RLS en upsert de contacto (DoD Checkpoint 6).');
  }

  function handleSimulateIncomingMessage() {
    console.warn('[WA-CRM][TEST] Simulando llegada de mensaje "precio" (Sprint v8.3.0)...');
    const mainEl = document.getElementById('main') || document.querySelector<HTMLElement>('div[role="region"]') || document.querySelector<HTMLElement>('[role="main"]');
    if (!mainEl) {
      alert('Por favor abre primero un chat activo para poder simular un mensaje.');
      return;
    }
    
    const msgContainer = document.createElement('div');
    msgContainer.className = 'message-in';
    const uniqueId = `true_test_${Date.now()}`;
    msgContainer.setAttribute('data-id', uniqueId);
    
    const innerSpan = document.createElement('span');
    innerSpan.className = 'selectable-text';
    innerSpan.textContent = 'precio';
    
    msgContainer.appendChild(innerSpan);
    mainEl.appendChild(msgContainer);
    console.info('[WA-CRM][TEST] Globo de mensaje inyectado en el DOM con ID:', uniqueId);
  }

  return (
    <div className="wacrm-content">
      {/* ── Contacto Activo (Fijo arriba) ── */}
      <div className="wacrm-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <p className="wacrm-section__title" style={{ margin: 0 }}>Contacto Activo</p>
          <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
            {isSyncingContact ? '🔄 Sincronizando...' : syncError ? '⚠️ Error Sincro' : chatInfo.degradedReason === 'Los grupos no son contactos individuales de CRM.' ? '👥 Grupo' : currentContact ? '🟢 Sincronizado CRM' : '⚪ Esperando'}
          </span>
        </div>

        <ActiveContactCard
          chatInfo={chatInfo}
          onRetryDetection={() => {
            WhatsAppDomService.getInstance().resetSelectors();
          }}
        />

        {/* Mensaje de Error Controlado en Sincronización */}
        {syncError && (
          <div
            style={{
              marginTop: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '11px',
            }}
          >
            ⚠️ {syncError}
          </div>
        )}

        {/* Botones Dev para pruebas DoD */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={handleSimulateBrokenSelector}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px dashed rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '4px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            🧪 Selector Roto (DoD 4)
          </button>

          <button
            type="button"
            onClick={handleSimulateIncomingMessage}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px dashed rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              padding: '4px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            🤖 Simular 'precio'
          </button>

          <button
            type="button"
            onClick={handleSimulateUpsertError}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px dashed rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              padding: '4px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            ⚠️ Error Upsert (DoD 6)
          </button>
        </div>
      </div>

      {/* ── Barra de Pestañas (Tabs) ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('crm')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'crm' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'crm' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          📋 CRM
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quick_replies')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'quick_replies' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'quick_replies' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          ⚡ Plantillas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('workflows')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'workflows' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === 'workflows' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          🤖 Flujos
        </button>
      </div>

      {/* ── Vista CRM (Pipeline Kanban & Notas) ── */}
      {activeTab === 'crm' && (
        <>
          {/* Pipeline Kanban */}
          <div className="wacrm-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <p className="wacrm-section__title" style={{ margin: 0 }}>Pipeline Kanban</p>
              {currentDeal && (
                <span style={{ fontSize: '10px', color: '#8b5cf6', fontFamily: 'monospace' }}>
                  Trato ID: #{currentDeal.id.slice(0, 6)}
                </span>
              )}
            </div>

            <div className="wacrm-card">
              {chatInfo.status !== 'ACTIVE' || (!chatInfo.phoneNumber && !chatInfo.jid) ? (
                <div className="wacrm-placeholder">
                  <span className="wacrm-placeholder__icon">📊</span>
                  <span>Abre o detecta un chat individual para gestionar las etapas del trato.</span>
                </div>
              ) : (
                <PipelineSelector
                  stages={stages}
                  currentStageId={currentDeal?.stage_id || null}
                  onSelectStage={handleStageChange}
                  isUpdating={isUpdatingStage}
                />
              )}
            </div>
          </div>

          {/* Notas Recientes */}
          <div className="wacrm-section">
            <p className="wacrm-section__title">Notas Recientes</p>
            <div className="wacrm-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chatInfo.status === 'ACTIVE' && currentContact && (
                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="Escribe una nota privada..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '6px 10px',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!newNoteContent.trim()}
                    style={{
                      background: 'var(--color-accent)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: newNoteContent.trim() ? 1 : 0.5,
                    }}
                  >
                    Añadir
                  </button>
                </form>
              )}

              {isSyncingNotes ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
                  <div className="wacrm-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                </div>
              ) : notes.length === 0 ? (
                <div className="wacrm-placeholder" style={{ padding: '12px', fontSize: '12px' }}>
                  <span>Sin notas guardadas para este contacto.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        opacity: note.saving ? 0.6 : 1,
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '8px' }}>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-primary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {note.content}
                        </p>
                        <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px', display: 'block' }}>
                          {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(note.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                          {note.saving && ' (guardando...)'}
                        </span>
                      </div>
                      {!note.saving && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '0 2px',
                            opacity: 0.6,
                          }}
                          title="Eliminar nota"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Vista Respuestas Rápidas ── */}
      {activeTab === 'quick_replies' && (
        <div className="wacrm-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Alerta de Importación Legacy de la v7 */}
          {showLegacyImportAlert && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>📦</span>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#c084fc' }}>
                  Respuestas rápidas v7 detectadas
                </p>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#d4d4d8' }}>
                Hemos detectado {legacyReplies.length} respuestas rápidas de tu versión anterior. ¿Deseas importarlas al workspace actual?
              </p>
              <button
                type="button"
                disabled={isSyncingLegacy}
                onClick={handleImportLegacyReplies}
                style={{
                  background: 'var(--color-accent)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: isSyncingLegacy ? 0.6 : 1,
                }}
              >
                {isSyncingLegacy ? '🔄 Importando...' : '📥 Importar Respuestas Rápidas'}
              </button>
            </div>
          )}

          {/* Barra de Búsqueda y Botón Añadir */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Buscar por atajo o título..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: '#fff',
                padding: '6px 10px',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => {
                setEditingReply(null);
                setFormShortcut('');
                setFormTitle('');
                setFormContent('');
                setIsFormOpen(true);
              }}
              style={{
                background: 'rgba(108, 99, 255, 0.15)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                borderRadius: '6px',
                color: '#a78bfa',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ➕ Añadir
            </button>
          </div>

          {/* Formulario de Creación / Edición Inline */}
          {isFormOpen && (
            <form
              onSubmit={handleSaveQuickReply}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {editingReply ? '✏️ Editar Plantilla' : '➕ Nueva Plantilla'}
              </h4>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Atajo (ej: /hola)</label>
                  <input
                    type="text"
                    placeholder="/atajo"
                    value={formShortcut}
                    onChange={(e) => setFormShortcut(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '4px 8px',
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Título</label>
                  <input
                    type="text"
                    placeholder="Título de referencia"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '4px 8px',
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Mensaje</label>
                <textarea
                  placeholder="Escribe el mensaje de la plantilla..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '6px 8px',
                    fontSize: '11px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: 'var(--color-text-secondary)',
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'var(--color-accent)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Guardar
                </button>
              </div>
            </form>
          )}

          {/* Listado de respuestas rápidas */}
          <div className="wacrm-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
            {isSyncingReplies ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                <div className="wacrm-spinner" style={{ width: '20px', height: '20px' }} />
              </div>
            ) : quickReplies.length === 0 ? (
              <div className="wacrm-placeholder" style={{ padding: '24px' }}>
                <span>No hay respuestas rápidas guardadas en este workspace.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {quickReplies
                  .filter((reply) =>
                    reply.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    reply.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    reply.content.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((reply) => (
                    <div
                      key={reply.id}
                      onClick={() => handleUseQuickReply(reply.content)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s, border-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      title="Haga clic para insertar en el chat"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {reply.title}
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            background: 'rgba(108, 99, 255, 0.15)',
                            color: '#a78bfa',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                          }}
                        >
                          {reply.shortcut}
                        </span>
                      </div>
                      
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {reply.content}
                      </p>

                      <div 
                        style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReply(reply);
                            setFormShortcut(reply.shortcut);
                            setFormTitle(reply.title);
                            setFormContent(reply.content);
                            setIsFormOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '10px', padding: '2px' }}
                          title="Editar plantilla"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuickReply(reply.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '10px', padding: '2px' }}
                          title="Eliminar plantilla"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vista Automatizaciones & Flujos ── */}
      {activeTab === 'workflows' && (
        <div className="wacrm-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="wacrm-section__title" style={{ margin: 0 }}>Flujos de Automatización</p>
            <button
              type="button"
              onClick={() => {
                setFlowName('');
                setFlowTriggerType('keyword');
                setFlowKeywordsStr('');
                setFlowFirstMessage('');
                setIsFlowFormOpen(true);
              }}
              style={{
                background: 'rgba(108, 99, 255, 0.15)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                borderRadius: '6px',
                color: '#a78bfa',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ➕ Añadir Flujo
            </button>
          </div>

          {/* Formulario Inline de Nuevo Flujo */}
          {isFlowFormOpen && (
            <form
              onSubmit={handleSaveWorkflow}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                🤖 Crear Flujo Automatizado
              </h4>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Nombre del Flujo</label>
                <input
                  type="text"
                  placeholder="Ej: Auto-responder Precios"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '6px 8px',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Gatillo (Trigger)</label>
                  <select
                    value={flowTriggerType}
                    onChange={(e) => setFlowTriggerType(e.target.value as 'keyword' | 'welcome')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '5px 8px',
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  >
                    <option value="keyword">Palabras Clave</option>
                    <option value="welcome">Primer Contacto</option>
                  </select>
                </div>

                {flowTriggerType === 'keyword' && (
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Keywords (sep. por comas)</label>
                    <input
                      type="text"
                      placeholder="precio, cotizacion, costo"
                      value={flowKeywordsStr}
                      onChange={(e) => setFlowKeywordsStr(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '4px',
                        color: '#fff',
                        padding: '6px 8px',
                        fontSize: '11px',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Mensaje Inicial de Respuesta</label>
                <textarea
                  placeholder="Escribe la respuesta automática..."
                  value={flowFirstMessage}
                  onChange={(e) => setFlowFirstMessage(e.target.value)}
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '6px 8px',
                    fontSize: '11px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsFlowFormOpen(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: 'var(--color-text-secondary)',
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'var(--color-accent)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Crear Flujo
                </button>
              </div>
            </form>
          )}

          {/* Listado de flujos */}
          <div className="wacrm-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
            {isSyncingWorkflows ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                <div className="wacrm-spinner" style={{ width: '20px', height: '20px' }} />
              </div>
            ) : workflows.length === 0 ? (
              <div className="wacrm-placeholder" style={{ padding: '24px' }}>
                <span>No hay automatizaciones registradas en este workspace.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {workflows.map((flow) => (
                  <div
                    key={flow.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {/* Encabezado del flujo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {flow.name}
                      </span>
                      
                      {/* Switch Toggle Estilizado con Optimistic UI */}
                      <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={flow.is_active}
                          onChange={() => handleToggleWorkflow(flow.id, flow.is_active)}
                          style={{ display: 'none' }}
                        />
                        <div
                          style={{
                            width: '28px',
                            height: '16px',
                            background: flow.is_active ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)',
                            borderRadius: '10px',
                            position: 'relative',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              background: '#fff',
                              borderRadius: '50%',
                              position: 'absolute',
                              top: '2px',
                              left: flow.is_active ? '14px' : '2px',
                              transition: 'left 0.2s',
                            }}
                          />
                        </div>
                      </label>
                    </div>

                    {/* Meta gatillo */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--color-text-muted)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        Trigger: {flow.trigger_type === 'keyword' ? 'Palabras Clave' : 'Bienvenida'}
                      </span>

                      {flow.trigger_type === 'keyword' && flow.keywords.map((kw, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '9px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#c084fc',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                          }}
                        >
                          "{kw}"
                        </span>
                      ))}
                    </div>

                    {/* Resumen de los pasos */}
                    <div
                      style={{
                        marginTop: '4px',
                        paddingTop: '6px',
                        borderTop: '1px dashed rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {flow.steps.map((step) => (
                        <div
                          key={step.id}
                          style={{
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'flex-start',
                            fontSize: '10px',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                            Paso {step.step_order}:
                          </span>
                          <span style={{ flex: 1, wordBreak: 'break-word' }}>
                            {step.type === 'message'
                              ? `✉️ Enviar: "${step.message_content}"`
                              : step.type === 'delay'
                              ? `⏳ Esperar ${step.delay_seconds} segundos`
                              : `🏷️ Agregar etiqueta`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Logout ── */}
      <button
        id="wacrm-signout-btn"
        type="button"
        className="wacrm-btn"
        onClick={onSignOut}
        style={{
          width: '100%',
          marginTop: '8px',
          background: 'transparent',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          fontSize: '12px',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
