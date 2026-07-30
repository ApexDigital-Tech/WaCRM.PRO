// ============================================================
// PipelineSelector — Selector interactivo de etapas Kanban (Sprint 4)
// Muestra las etapas cargadas dinámicamente y permite cambiar el deal.
// ============================================================

import React from 'react';
import type { PipelineStage } from '@wa-crm/types';

interface PipelineSelectorProps {
  stages: PipelineStage[];
  currentStageId: string | null;
  onSelectStage: (stageId: string) => void;
  isUpdating?: boolean;
}

export function PipelineSelector({
  stages,
  currentStageId,
  onSelectStage,
  isUpdating = false,
}: PipelineSelectorProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="wacrm-placeholder" style={{ padding: '8px', fontSize: '11px' }}>
        <span>Cargando etapas del pipeline...</span>
      </div>
    );
  }

  return (
    <div className="wacrm-pipeline-selector" style={{ opacity: isUpdating ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(stages.length, 5)}, 1fr)`,
          gap: '4px',
          marginBottom: '8px',
        }}
      >
        {stages.map((stage) => {
          const isActive = currentStageId === stage.id;
          const stageColor = stage.color || '#3b82f6';

          return (
            <button
              key={stage.id}
              type="button"
              disabled={isUpdating}
              onClick={() => onSelectStage(stage.id)}
              title={`Mover negocio a etapa: ${stage.name}`}
              style={{
                background: isActive ? `${stageColor}25` : 'rgba(255, 255, 255, 0.03)',
                border: isActive ? `1.5px solid ${stageColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                color: isActive ? '#ffffff' : '#a1a1aa',
                borderRadius: '6px',
                padding: '6px 4px',
                fontSize: '10px',
                fontWeight: isActive ? 600 : 400,
                cursor: isUpdating ? 'wait' : 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 0 8px ${stageColor}40` : 'none',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: stageColor,
                  margin: '0 auto 3px auto',
                  boxShadow: isActive ? `0 0 6px ${stageColor}` : 'none',
                }}
              />
              {stage.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
