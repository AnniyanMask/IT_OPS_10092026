import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Move,
  Type,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Sliders,
  Layers,
  Sparkles,
  Maximize2,
  Copy,
  Star,
  X,
  FilePlus,
  Check,
  Tag,
  ChevronDown
} from 'lucide-react';
import { LabelTemplate, LabelTemplateElement } from '../types';
import { api } from '../services/api';

interface LabelDesignerProps {
  currentUser?: { id: string; name: string; role: string };
  onClose?: () => void;
}

const FIELD_OPTIONS = [
  { key: 'APPROVED', label: 'APPROVED Badge / Header', defaultType: 'badge', defaultWidth: 90, defaultHeight: 8, fontSize: 13, bold: true },
  { key: 'request_number', label: 'Request Number (Req No)', defaultType: 'text', defaultWidth: 45, defaultHeight: 6, fontSize: 9, bold: true },
  { key: 'requester_name', label: 'Requestor Name', defaultType: 'text', defaultWidth: 90, defaultHeight: 6, fontSize: 9, bold: true },
  { key: 'asset_name', label: 'Asset / Device Name & S/N', defaultType: 'text', defaultWidth: 90, defaultHeight: 6, fontSize: 9, bold: true },
  { key: 'from_date', label: 'From Date', defaultType: 'text', defaultWidth: 44, defaultHeight: 5, fontSize: 8, bold: false },
  { key: 'to_date', label: 'To Date', defaultType: 'text', defaultWidth: 46, defaultHeight: 5, fontSize: 8, bold: false },
  { key: 'approver_name', label: 'Approved By (IT Approver)', defaultType: 'text', defaultWidth: 90, defaultHeight: 5, fontSize: 8, bold: true },
  { key: 'security_footer', label: 'Security Warning / Footer', defaultType: 'text', defaultWidth: 90, defaultHeight: 5, fontSize: 7, bold: false },
  { key: 'custom_text', label: 'Custom Text Note', defaultType: 'text', defaultWidth: 40, defaultHeight: 5, fontSize: 8, bold: false },
];

const SAMPLE_DATA: Record<string, string> = {
  APPROVED: 'BRING DEVICE OUT PASS',
  request_number: 'REQ: DEV-OUT-2026-00001',
  requester_name: 'Requestor: Michael Chang (Finance)',
  asset_name: 'Asset: Dell Latitude 5430 [SN: 8F7K2L3]',
  from_date: 'From: 2026-09-10',
  to_date: 'To: 2026-09-15',
  approver_name: 'Approved By: System Administrator (IT)',
  security_footer: 'TANAKA IT OPS • STICKER MUST REMAIN AFFIXED • RETURN ON DUE DATE',
  custom_text: 'VPN Active • Inspected',
};

const STARTER_PRESETS = [
  {
    id: 'std-100x50',
    name: 'SATO Standard Pass (100mm × 50mm)',
    description: 'Official Tanaka security clearance layout with all 8 gate pass fields.',
    widthMm: 100,
    heightMm: 50,
    orientation: 'Landscape' as const,
    elements: (templateId: string): LabelTemplateElement[] => [
      { id: `el-${Date.now()}-1`, templateId, elementType: 'badge', fieldKey: 'APPROVED', xMm: 4, yMm: 3, widthMm: 92, heightMm: 7, fontSize: 13, fontWeight: 'bold', visible: true, alignment: 'center', rotation: 0 },
      { id: `el-${Date.now()}-2`, templateId, elementType: 'text', fieldKey: 'request_number', xMm: 4, yMm: 12, widthMm: 45, heightMm: 6, fontSize: 9, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-3`, templateId, elementType: 'text', fieldKey: 'requester_name', xMm: 4, yMm: 18, widthMm: 92, heightMm: 6, fontSize: 9, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-4`, templateId, elementType: 'text', fieldKey: 'asset_name', xMm: 4, yMm: 24, widthMm: 92, heightMm: 6, fontSize: 9, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-5`, templateId, elementType: 'text', fieldKey: 'from_date', xMm: 4, yMm: 30, widthMm: 44, heightMm: 5, fontSize: 8, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-6`, templateId, elementType: 'text', fieldKey: 'to_date', xMm: 50, yMm: 30, widthMm: 46, heightMm: 5, fontSize: 8, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-7`, templateId, elementType: 'text', fieldKey: 'approver_name', xMm: 4, yMm: 36, widthMm: 92, heightMm: 5, fontSize: 8, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-8`, templateId, elementType: 'text', fieldKey: 'security_footer', xMm: 4, yMm: 42, widthMm: 92, heightMm: 5, fontSize: 7, fontWeight: 'normal', visible: true, alignment: 'center', rotation: 0 },
    ]
  },
  {
    id: 'compact-80x40',
    name: 'Compact Device Tag (80mm × 40mm)',
    description: 'Medium format optimized for lightweight laptops, tablets, and chassis.',
    widthMm: 80,
    heightMm: 40,
    orientation: 'Landscape' as const,
    elements: (templateId: string): LabelTemplateElement[] => [
      { id: `el-${Date.now()}-1`, templateId, elementType: 'badge', fieldKey: 'APPROVED', xMm: 3, yMm: 2, widthMm: 74, heightMm: 6, fontSize: 11, fontWeight: 'bold', visible: true, alignment: 'center', rotation: 0 },
      { id: `el-${Date.now()}-2`, templateId, elementType: 'text', fieldKey: 'request_number', xMm: 3, yMm: 10, widthMm: 36, heightMm: 5, fontSize: 8, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-3`, templateId, elementType: 'text', fieldKey: 'requester_name', xMm: 3, yMm: 16, widthMm: 74, heightMm: 5, fontSize: 8, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-4`, templateId, elementType: 'text', fieldKey: 'asset_name', xMm: 3, yMm: 22, widthMm: 74, heightMm: 5, fontSize: 8, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-5`, templateId, elementType: 'text', fieldKey: 'from_date', xMm: 3, yMm: 28, widthMm: 35, heightMm: 4.5, fontSize: 7.5, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-6`, templateId, elementType: 'text', fieldKey: 'to_date', xMm: 40, yMm: 28, widthMm: 37, heightMm: 4.5, fontSize: 7.5, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-7`, templateId, elementType: 'text', fieldKey: 'approver_name', xMm: 3, yMm: 33, widthMm: 74, heightMm: 4.5, fontSize: 7.5, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
    ]
  },
  {
    id: 'dongle-50x30',
    name: 'Small USB / Dongle Tag (50mm × 30mm)',
    description: 'Compact sticker tag tailored for thumbdrives, tokens, and storage keys.',
    widthMm: 50,
    heightMm: 30,
    orientation: 'Landscape' as const,
    elements: (templateId: string): LabelTemplateElement[] => [
      { id: `el-${Date.now()}-1`, templateId, elementType: 'badge', fieldKey: 'APPROVED', xMm: 2, yMm: 2, widthMm: 46, heightMm: 5, fontSize: 9, fontWeight: 'bold', visible: true, alignment: 'center', rotation: 0 },
      { id: `el-${Date.now()}-2`, templateId, elementType: 'text', fieldKey: 'request_number', xMm: 2, yMm: 8, widthMm: 46, heightMm: 4.5, fontSize: 7.5, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-3`, templateId, elementType: 'text', fieldKey: 'asset_name', xMm: 2, yMm: 13, widthMm: 46, heightMm: 4.5, fontSize: 7.5, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-4`, templateId, elementType: 'text', fieldKey: 'from_date', xMm: 2, yMm: 18, widthMm: 22, heightMm: 4, fontSize: 7, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-5`, templateId, elementType: 'text', fieldKey: 'to_date', xMm: 25, yMm: 18, widthMm: 23, heightMm: 4, fontSize: 7, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-6`, templateId, elementType: 'text', fieldKey: 'approver_name', xMm: 2, yMm: 23, widthMm: 46, heightMm: 4, fontSize: 7, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
    ]
  },
  {
    id: 'large-100x75',
    name: 'Large Equipment Tag (100mm × 75mm)',
    description: 'Extended format for servers, Pelican flight cases, and multiple components.',
    widthMm: 100,
    heightMm: 75,
    orientation: 'Landscape' as const,
    elements: (templateId: string): LabelTemplateElement[] => [
      { id: `el-${Date.now()}-1`, templateId, elementType: 'badge', fieldKey: 'APPROVED', xMm: 5, yMm: 4, widthMm: 90, heightMm: 9, fontSize: 15, fontWeight: 'bold', visible: true, alignment: 'center', rotation: 0 },
      { id: `el-${Date.now()}-2`, templateId, elementType: 'text', fieldKey: 'request_number', xMm: 5, yMm: 16, widthMm: 45, heightMm: 7, fontSize: 10, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-3`, templateId, elementType: 'text', fieldKey: 'requester_name', xMm: 5, yMm: 25, widthMm: 90, heightMm: 7, fontSize: 10, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-4`, templateId, elementType: 'text', fieldKey: 'asset_name', xMm: 5, yMm: 34, widthMm: 90, heightMm: 7, fontSize: 10, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-5`, templateId, elementType: 'text', fieldKey: 'from_date', xMm: 5, yMm: 43, widthMm: 44, heightMm: 6, fontSize: 9, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-6`, templateId, elementType: 'text', fieldKey: 'to_date', xMm: 51, yMm: 43, widthMm: 44, heightMm: 6, fontSize: 9, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-7`, templateId, elementType: 'text', fieldKey: 'approver_name', xMm: 5, yMm: 51, widthMm: 90, heightMm: 6, fontSize: 9, fontWeight: 'bold', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-8`, templateId, elementType: 'text', fieldKey: 'custom_text', xMm: 5, yMm: 59, widthMm: 90, heightMm: 6, fontSize: 8.5, fontWeight: 'normal', visible: true, alignment: 'left', rotation: 0 },
      { id: `el-${Date.now()}-9`, templateId, elementType: 'text', fieldKey: 'security_footer', xMm: 5, yMm: 67, widthMm: 90, heightMm: 5, fontSize: 8, fontWeight: 'normal', visible: true, alignment: 'center', rotation: 0 },
    ]
  },
  {
    id: 'blank',
    name: 'Blank Custom Label',
    description: 'Empty canvas to build custom dimensions and field elements from scratch.',
    widthMm: 100,
    heightMm: 50,
    orientation: 'Landscape' as const,
    elements: (templateId: string): LabelTemplateElement[] => [
      { id: `el-${Date.now()}-1`, templateId, elementType: 'badge', fieldKey: 'APPROVED', xMm: 4, yMm: 3, widthMm: 92, heightMm: 7, fontSize: 13, fontWeight: 'bold', visible: true, alignment: 'center', rotation: 0 },
    ]
  }
];

export const LabelDesigner: React.FC<LabelDesignerProps> = ({ currentUser, onClose }) => {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal: Create New Label
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelPresetId, setNewLabelPresetId] = useState('std-100x50');
  const [newLabelWidth, setNewLabelWidth] = useState(100);
  const [newLabelHeight, setNewLabelHeight] = useState(50);
  const [newLabelOrientation, setNewLabelOrientation] = useState<'Landscape' | 'Portrait'>('Landscape');
  const [newLabelIsActive, setNewLabelIsActive] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Modal: Delete Template Confirmation
  const [templateToDelete, setTemplateToDelete] = useState<LabelTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Zoom scale: pixels per millimeter
  const scale = 5.2; // 1mm = 5.2px for crisp on-screen editing

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async (selectId?: string) => {
    setIsLoading(true);
    try {
      const res = await api.getLabelTemplates();
      if (res.success && res.data && res.data.length > 0) {
        setTemplates(res.data);
        const target = selectId
          ? res.data.find(t => t.id === selectId) || res.data[0]
          : res.data.find(t => t.isActive) || res.data[0];
        setSelectedTemplate(target);
        if (target.elements && target.elements.length > 0) {
          setSelectedElementId(target.elements[0].id);
        } else {
          setSelectedElementId(null);
        }
      }
    } catch (err) {
      setErrorMessage('Failed to load label templates from server.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedElement = selectedTemplate?.elements?.find((el) => el.id === selectedElementId) || null;

  const handleSelectTemplate = (template: LabelTemplate) => {
    setSelectedTemplate(template);
    if (template.elements && template.elements.length > 0) {
      setSelectedElementId(template.elements[0].id);
    } else {
      setSelectedElementId(null);
    }
  };

  const handleUpdateTemplateDim = (field: 'widthMm' | 'heightMm' | 'orientation' | 'name' | 'isActive', value: any) => {
    if (!selectedTemplate) return;
    setSelectedTemplate({
      ...selectedTemplate,
      [field]: value,
    });
  };

  const handleUpdateElement = (id: string, updates: Partial<LabelTemplateElement>) => {
    if (!selectedTemplate || !selectedTemplate.elements) return;
    const newElements = selectedTemplate.elements.map((el) => {
      if (el.id === id) {
        return { ...el, ...updates };
      }
      return el;
    });
    setSelectedTemplate({
      ...selectedTemplate,
      elements: newElements,
    });
  };

  const handleAddElement = () => {
    if (!selectedTemplate) return;
    const newId = `el-${Date.now()}`;
    const newEl: LabelTemplateElement = {
      id: newId,
      templateId: selectedTemplate.id,
      elementType: 'text',
      fieldKey: 'custom_text',
      xMm: 5,
      yMm: 5,
      widthMm: 40,
      heightMm: 6,
      fontSize: 8,
      fontWeight: 'normal',
      visible: true,
      alignment: 'left',
      rotation: 0,
    };
    setSelectedTemplate({
      ...selectedTemplate,
      elements: [...(selectedTemplate.elements || []), newEl],
    });
    setSelectedElementId(newId);
  };

  const handleDeleteElement = (id: string) => {
    if (!selectedTemplate || !selectedTemplate.elements) return;
    setSelectedTemplate({
      ...selectedTemplate,
      elements: selectedTemplate.elements.filter((el) => el.id !== id),
    });
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  // Mouse drag handling
  const handleMouseDownOnElement = (e: React.MouseEvent, el: LabelTemplateElement) => {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setIsDragging(true);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: el.xMm,
      initialY: el.yMm,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !selectedElementId || !selectedTemplate) return;
    const deltaX = (e.clientX - dragStart.mouseX) / scale;
    const deltaY = (e.clientY - dragStart.mouseY) / scale;

    const newX = Math.max(0, Math.min(selectedTemplate.widthMm - (selectedElement?.widthMm || 10), Math.round((dragStart.initialX + deltaX) * 2) / 2));
    const newY = Math.max(0, Math.min(selectedTemplate.heightMm - (selectedElement?.heightMm || 5), Math.round((dragStart.initialY + deltaY) * 2) / 2));

    handleUpdateElement(selectedElementId, { xMm: newX, yMm: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Save current template changes
  const handleSave = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);
    try {
      const res = await api.saveLabelTemplate({
        ...selectedTemplate,
        updatedBy: currentUser?.name || 'Administrator',
      });
      if (res.success && res.data) {
        setSaveSuccess(`Label template '${selectedTemplate.name}' saved and synced with SATO CL4NX engine.`);
        // Update local template in list
        setTemplates(prev => prev.map(t => (t.id === selectedTemplate.id ? res.data! : t)));
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to save template');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error saving template');
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate current template
  const handleDuplicateTemplate = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const newId = `tpl-${Date.now()}`;
      const duplicateName = `${selectedTemplate.name} (Copy)`;
      const newElements = (selectedTemplate.elements || []).map((el, idx) => ({
        ...el,
        id: `el-${Date.now()}-${idx + 1}`,
        templateId: newId,
      }));

      const newTemplatePayload: Partial<LabelTemplate> = {
        id: newId,
        name: duplicateName,
        widthMm: selectedTemplate.widthMm,
        heightMm: selectedTemplate.heightMm,
        orientation: selectedTemplate.orientation,
        isActive: false,
        elements: newElements,
        createdBy: currentUser?.name || 'Administrator',
        updatedBy: currentUser?.name || 'Administrator',
      };

      const res = await api.saveLabelTemplate(newTemplatePayload);
      if (res.success && res.data) {
        setTemplates(prev => [...prev, res.data!]);
        setSelectedTemplate(res.data);
        if (res.data.elements && res.data.elements.length > 0) {
          setSelectedElementId(res.data.elements[0].id);
        }
        setSaveSuccess(`Duplicated into '${duplicateName}' successfully.`);
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to duplicate template');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error duplicating template');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle or set this template as Active Default
  const handleToggleActiveDefault = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = {
        ...selectedTemplate,
        isActive: !selectedTemplate.isActive,
        updatedBy: currentUser?.name || 'Administrator',
      };
      const res = await api.saveLabelTemplate(updated);
      if (res.success && res.data) {
        setSelectedTemplate(res.data);
        setTemplates(prev =>
          prev.map(t => {
            if (t.id === res.data!.id) return res.data!;
            // If we turned this active, make others inactive
            if (res.data!.isActive) return { ...t, isActive: false };
            return t;
          })
        );
        setSaveSuccess(
          res.data.isActive
            ? `'${res.data.name}' is now the active default sticker for Device Out printing.`
            : `'${res.data.name}' is no longer active default.`
        );
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to update active state');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error updating active default');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Create New Label from modal
  const handleCreateNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);

    const trimmedName = newLabelName.trim();
    if (!trimmedName) {
      setCreateModalError('Please enter a template name.');
      return;
    }

    setIsSaving(true);
    try {
      const newId = `tpl-${Date.now()}`;
      const preset = STARTER_PRESETS.find(p => p.id === newLabelPresetId) || STARTER_PRESETS[0];

      const elements = preset.elements(newId);

      const payload: Partial<LabelTemplate> = {
        id: newId,
        name: trimmedName,
        widthMm: Number(newLabelWidth),
        heightMm: Number(newLabelHeight),
        orientation: newLabelOrientation,
        isActive: newLabelIsActive,
        elements,
        createdBy: currentUser?.name || 'Administrator',
        updatedBy: currentUser?.name || 'Administrator',
      };

      const res = await api.saveLabelTemplate(payload);
      if (res.success && res.data) {
        // If set as active, mark others as inactive
        const updatedList = newLabelIsActive
          ? templates.map(t => ({ ...t, isActive: false }))
          : [...templates];

        setTemplates([...updatedList, res.data]);
        setSelectedTemplate(res.data);
        if (res.data.elements && res.data.elements.length > 0) {
          setSelectedElementId(res.data.elements[0].id);
        } else {
          setSelectedElementId(null);
        }

        setShowCreateModal(false);
        setNewLabelName('');
        setSaveSuccess(`New label template '${res.data.name}' created and loaded in designer.`);
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setCreateModalError(res.error || 'Failed to create label template.');
      }
    } catch (err) {
      setCreateModalError(err instanceof Error ? err.message : 'Failed to create label template.');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm and delete template
  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await api.deleteLabelTemplate(templateToDelete.id);
      if (res.success) {
        const remaining = templates.filter(t => t.id !== templateToDelete.id);
        setTemplates(remaining);
        if (selectedTemplate?.id === templateToDelete.id) {
          const nextSelected = remaining[0] || null;
          setSelectedTemplate(nextSelected);
          setSelectedElementId(nextSelected?.elements?.[0]?.id || null);
        }
        setTemplateToDelete(null);
        setSaveSuccess(`Template '${templateToDelete.name}' deleted.`);
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to delete template');
        setTemplateToDelete(null);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error deleting template');
      setTemplateToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick preset apply to current template
  const applyPresetToCurrent = (presetType: 'sato-100x50' | 'sato-80x40' | 'sato-50x30') => {
    if (!selectedTemplate) return;
    if (presetType === 'sato-100x50') {
      setSelectedTemplate({
        ...selectedTemplate,
        widthMm: 100,
        heightMm: 50,
        orientation: 'Landscape',
      });
    } else if (presetType === 'sato-80x40') {
      setSelectedTemplate({
        ...selectedTemplate,
        widthMm: 80,
        heightMm: 40,
        orientation: 'Landscape',
      });
    } else if (presetType === 'sato-50x30') {
      setSelectedTemplate({
        ...selectedTemplate,
        widthMm: 50,
        heightMm: 30,
        orientation: 'Landscape',
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[750px]">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              SATO CL4NX Label Template Designer
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Thermal Transfer (203/305 DPI)
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Create and configure sticker dimensions (mm), draggable fields, and layout for Bring Device Out passes.
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {saveSuccess}
            </div>
          )}
          {errorMessage && (
            <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-md border border-rose-200 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              {errorMessage}
            </div>
          )}

          {/* "+ Create New Label" Primary Button */}
          <button
            type="button"
            onClick={() => {
              setNewLabelName('');
              setNewLabelPresetId('std-100x50');
              setNewLabelWidth(100);
              setNewLabelHeight(50);
              setNewLabelOrientation('Landscape');
              setNewLabelIsActive(false);
              setCreateModalError(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <FilePlus className="w-4 h-4" />
            <span>Create New Label</span>
          </button>

          {/* Duplicate Current Label */}
          {selectedTemplate && (
            <button
              type="button"
              onClick={handleDuplicateTemplate}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Duplicate current label into a new template"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Duplicate</span>
            </button>
          )}

          {/* Save Current Template */}
          {selectedTemplate && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          )}
        </div>
      </div>

      {/* Templates Selector Ribbon */}
      <div className="px-6 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            Templates ({templates.length}):
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            {templates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate max-w-[200px]">{tpl.name}</span>
                  <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-500'}`}>
                    {tpl.widthMm}×{tpl.heightMm}mm
                  </span>
                  {tpl.isActive && (
                    <span
                      title="Active default template"
                      className={`text-[10px] font-bold px-1 rounded flex items-center gap-0.5 ${
                        isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      ★ Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedTemplate && (
          <div className="flex items-center gap-2">
            {/* Set as Active Default */}
            <button
              type="button"
              onClick={handleToggleActiveDefault}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                selectedTemplate.isActive
                  ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
              title={selectedTemplate.isActive ? 'Currently set as default printing template' : 'Set as default printing template'}
            >
              <Star className={`w-3.5 h-3.5 ${selectedTemplate.isActive ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
              <span>{selectedTemplate.isActive ? 'Active Default' : 'Set as Default'}</span>
            </button>

            {/* Delete Template (Only if > 1 templates exist) */}
            <button
              type="button"
              onClick={() => setTemplateToDelete(selectedTemplate)}
              disabled={templates.length <= 1}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-transparent hover:border-rose-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
              title={templates.length <= 1 ? 'Cannot delete the only template' : 'Delete this template'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1">
        {/* Left Side: Template Settings & Presets (3 cols) */}
        <div className="lg:col-span-3 border-r border-slate-200 p-5 bg-slate-50/50 flex flex-col gap-5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Template Name</label>
            <input
              type="text"
              value={selectedTemplate?.name || ''}
              onChange={(e) => handleUpdateTemplateDim('name', e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Quick Size Stock Presets</label>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetToCurrent('sato-100x50')}
                className={`text-left px-3 py-2 text-xs rounded-md border transition-all ${
                  selectedTemplate?.widthMm === 100 && selectedTemplate?.heightMm === 50
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="font-bold">Standard Device Out (100mm × 50mm)</div>
                <div className="text-[11px] text-slate-500">Official security gate pass stock</div>
              </button>
              <button
                type="button"
                onClick={() => applyPresetToCurrent('sato-80x40')}
                className={`text-left px-3 py-2 text-xs rounded-md border transition-all ${
                  selectedTemplate?.widthMm === 80 && selectedTemplate?.heightMm === 40
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="font-bold">Compact Label (80mm × 40mm)</div>
                <div className="text-[11px] text-slate-500">Small laptop and asset tag surface</div>
              </button>
              <button
                type="button"
                onClick={() => applyPresetToCurrent('sato-50x30')}
                className={`text-left px-3 py-2 text-xs rounded-md border transition-all ${
                  selectedTemplate?.widthMm === 50 && selectedTemplate?.heightMm === 30
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="font-bold">Thumbdrive / Dongle Tag (50mm × 30mm)</div>
                <div className="text-[11px] text-slate-500">Compact USB storage devices</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Width (mm)</label>
              <input
                type="number"
                min={30}
                max={200}
                value={selectedTemplate?.widthMm || 100}
                onChange={(e) => handleUpdateTemplateDim('widthMm', Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Height (mm)</label>
              <input
                type="number"
                min={20}
                max={200}
                value={selectedTemplate?.heightMm || 50}
                onChange={(e) => handleUpdateTemplateDim('heightMm', Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Orientation</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateTemplateDim('orientation', 'Landscape')}
                className={`py-1.5 px-3 text-xs rounded-md border text-center font-medium ${
                  selectedTemplate?.orientation === 'Landscape'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Landscape
              </button>
              <button
                type="button"
                onClick={() => handleUpdateTemplateDim('orientation', 'Portrait')}
                className={`py-1.5 px-3 text-xs rounded-md border text-center font-medium ${
                  selectedTemplate?.orientation === 'Portrait'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Portrait
              </button>
            </div>
          </div>

          {/* Elements list on this template */}
          <div className="flex-1 flex flex-col mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Label Elements</span>
              <button
                onClick={handleAddElement}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
            </div>
            <div className="space-y-1.5 overflow-y-auto max-h-56 pr-1">
              {selectedTemplate?.elements?.map((el) => {
                const opt = FIELD_OPTIONS.find((f) => f.key === el.fieldKey);
                const isSelected = el.id === selectedElementId;
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`px-3 py-2 rounded-md border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-2 h-2 rounded-full ${el.visible ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="truncate">{opt ? opt.label : el.fieldKey}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateElement(el.id, { visible: !el.visible });
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={el.visible ? 'Hide on print' : 'Show on print'}
                      >
                        {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteElement(el.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Delete element"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Visual Drag & Drop Canvas (6 cols) */}
        <div
          className="lg:col-span-6 p-6 bg-slate-100/80 flex flex-col items-center justify-center select-none overflow-hidden relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Canvas info badge */}
          <div className="absolute top-3 left-4 flex items-center gap-2 text-xs text-slate-500 bg-white/90 backdrop-blur px-3 py-1 rounded-full border border-slate-200 shadow-sm">
            <Move className="w-3.5 h-3.5 text-indigo-500" />
            <span>Interactive mm Canvas (Click & Drag elements to position)</span>
            <span className="text-slate-300">|</span>
            <span>Size: {selectedTemplate?.widthMm}mm × {selectedTemplate?.heightMm}mm</span>
          </div>

          {/* SATO CL4NX Physical Sticker Mockup */}
          {selectedTemplate && (
            <div
              ref={canvasRef}
              className="bg-white border-2 border-slate-900 rounded-sm shadow-xl relative transition-all"
              style={{
                width: `${selectedTemplate.widthMm * scale}px`,
                height: `${selectedTemplate.heightMm * scale}px`,
              }}
            >
              {/* Millimeter grid ruler watermark */}
              <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
                  backgroundSize: `${10 * scale}px ${10 * scale}px`,
                }}
              />

              {/* Elements on canvas */}
              {selectedTemplate.elements?.map((el) => {
                if (!el.visible) return null;
                const isSelected = el.id === selectedElementId;
                const sampleText = SAMPLE_DATA[el.fieldKey] || el.fieldKey;

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleMouseDownOnElement(e, el)}
                    className={`absolute cursor-move transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 ring-offset-1 z-20 shadow-md'
                        : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-slate-400 z-10'
                    }`}
                    style={{
                      left: `${el.xMm * scale}px`,
                      top: `${el.yMm * scale}px`,
                      width: `${el.widthMm * scale}px`,
                      height: `${el.heightMm * scale}px`,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                    }}
                  >
                    {el.elementType === 'badge' ? (
                      <div
                        className="w-full h-full bg-black text-white flex items-center justify-center font-bold tracking-wider rounded-[2px]"
                        style={{ fontSize: `${el.fontSize * 1.1}px` }}
                      >
                        {sampleText}
                      </div>
                    ) : (
                      <div
                        className="w-full h-full flex items-center px-1 overflow-hidden leading-tight text-black"
                        style={{
                          fontSize: `${el.fontSize * 1.05}px`,
                          fontWeight: el.fontWeight === 'bold' ? 700 : el.fontWeight === 'medium' ? 600 : 400,
                          justifyContent:
                            el.alignment === 'center'
                              ? 'center'
                              : el.alignment === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                          textAlign: el.alignment,
                        }}
                      >
                        <span className="truncate">{sampleText}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* SATO CL4NX Printer notice */}
          <div className="mt-5 text-center text-xs text-slate-500 max-w-sm">
            Ready for Windows Print Driver targeting <strong>SATO CL4NX</strong> thermal printer.
            Sticker dimensions mapped 1:1 to physical label stock.
          </div>
        </div>

        {/* Right Side: Selected Element Properties Inspector (3 cols) */}
        <div className="lg:col-span-3 border-l border-slate-200 p-5 bg-slate-50/50 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Element Properties
            </h3>
          </div>

          {selectedElement ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Field Type / Source</label>
                <select
                  value={selectedElement.fieldKey}
                  onChange={(e) => {
                    const opt = FIELD_OPTIONS.find((f) => f.key === e.target.value);
                    handleUpdateElement(selectedElement.id, {
                      fieldKey: e.target.value,
                      elementType: (opt?.defaultType as any) || 'text',
                      fontSize: opt?.fontSize || 9,
                      fontWeight: opt?.bold ? 'bold' : 'normal',
                      widthMm: opt?.defaultWidth || selectedElement.widthMm,
                      heightMm: opt?.defaultHeight || selectedElement.heightMm,
                    });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Coordinates */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Position & Geometry</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">X Position (mm)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={selectedTemplate?.widthMm || 100}
                      value={selectedElement.xMm}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { xMm: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Y Position (mm)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={selectedTemplate?.heightMm || 50}
                      value={selectedElement.yMm}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { yMm: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Width (mm)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={5}
                      max={selectedTemplate?.widthMm || 100}
                      value={selectedElement.widthMm}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { widthMm: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Height (mm)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={3}
                      max={selectedTemplate?.heightMm || 50}
                      value={selectedElement.heightMm}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { heightMm: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Typography & Formatting</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Font Size (pt)</label>
                    <input
                      type="number"
                      min={6}
                      max={28}
                      value={selectedElement.fontSize}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Font Weight</label>
                    <select
                      value={selectedElement.fontWeight}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { fontWeight: e.target.value as any })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                    >
                      <option value="normal">Normal</option>
                      <option value="medium">Medium</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Text Alignment</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => handleUpdateElement(selectedElement.id, { alignment: align })}
                        className={`py-1 text-[11px] rounded capitalize border ${
                          selectedElement.alignment === align
                            ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="text-[11px] text-slate-600 font-medium">Render on Sticker</label>
                  <input
                    type="checkbox"
                    checked={selectedElement.visible}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { visible: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteElement(selectedElement.id)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove This Element
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Select an element from the canvas or elements list to inspect its properties.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Create New Label Template */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <FilePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Create New SATO Label Template
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure stock dimensions and starter layout for gate pass stickers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTemplate} className="p-6 overflow-y-auto space-y-4 text-xs">
              {createModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createModalError}</span>
                </div>
              )}

              {/* Template Name */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="e.g. SATO CL4NX Standard Pass (100mm x 50mm) or USB Dongle Pass"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-900"
                  required
                />
              </div>

              {/* Starter Preset Selection */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Starter Layout & Stock Preset
                </label>
                <div className="space-y-2">
                  {STARTER_PRESETS.map((preset) => (
                    <label
                      key={preset.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        newLabelPresetId === preset.id
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preset"
                        checked={newLabelPresetId === preset.id}
                        onChange={() => {
                          setNewLabelPresetId(preset.id);
                          setNewLabelWidth(preset.widthMm);
                          setNewLabelHeight(preset.heightMm);
                          setNewLabelOrientation(preset.orientation);
                          if (!newLabelName.trim()) {
                            setNewLabelName(preset.name);
                          }
                        }}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{preset.name}</span>
                          <span className="text-[10px] font-mono font-semibold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                            {preset.widthMm}mm × {preset.heightMm}mm
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{preset.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dimensions in mm */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Width (mm)</label>
                  <input
                    type="number"
                    min={30}
                    max={200}
                    value={newLabelWidth}
                    onChange={(e) => setNewLabelWidth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Height (mm)</label>
                  <input
                    type="number"
                    min={20}
                    max={200}
                    value={newLabelHeight}
                    onChange={(e) => setNewLabelHeight(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Orientation</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewLabelOrientation('Landscape')}
                    className={`py-2 px-3 text-xs rounded-lg border text-center font-semibold cursor-pointer ${
                      newLabelOrientation === 'Landscape'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Landscape
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLabelOrientation('Portrait')}
                    className={`py-2 px-3 text-xs rounded-lg border text-center font-semibold cursor-pointer ${
                      newLabelOrientation === 'Portrait'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Portrait
                  </button>
                </div>
              </div>

              {/* Set as Active Default */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="make-active-checkbox"
                  checked={newLabelIsActive}
                  onChange={(e) => setNewLabelIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="make-active-checkbox" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Set as default active label for Device Out gate pass sticker printing
                </label>
              </div>

              {/* Buttons */}
              <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newLabelName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Creating...' : 'Create Label Template'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Template Confirmation */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Label Template</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete the template{' '}
              <strong className="text-slate-900 font-bold">{templateToDelete.name}</strong> (
              {templateToDelete.widthMm}mm × {templateToDelete.heightMm}mm)?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
