import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserProfile,
  RequestType,
  PriorityLevel,
  ChangeRequest,
  Attachment,
  Department,
  StorageConfig,
  TicketCategory,
  TicketIssueType,
  ApplicationAreaSelection,
  CategoryMaster,
  ServiceMaster,
  ApplicationAssetMaster,
  IssueTypeMaster,
  ApplicationModuleMaster,
  ApplicationSubFunctionMaster,
  ApplicationProcessMaster,
} from '../types';
import {
  MASTER_CATEGORIES,
  MASTER_SERVICES,
  MASTER_APPLICATIONS_ASSETS,
  MASTER_ISSUE_TYPES,
  MASTER_APPLICATION_MODULES,
  MASTER_APPLICATION_SUBFUNCTIONS,
  MASTER_APPLICATION_PROCESSES,
} from '../data/serviceCatalog';
import { calculateRiskScore } from '../utils/slaAndRisk';
import { getMalaysianTimestamp } from '../utils/timezone';
import { api } from '../services/api';
import {
  FileText,
  Paperclip,
  Save,
  Send,
  AlertCircle,
  AlertTriangle,
  X,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Mail,
  Layers,
  ChevronRight,
  Plus,
  Lock,
  ShieldCheck,
  Server,
  Cpu,
  Laptop,
  Network,
  Printer,
  Shield,
  HelpCircle,
  FilePlus,
  Tag,
  Check,
  Sparkles,
} from 'lucide-react';

interface ChangeRequestFormProps {
  currentUser: UserProfile;
  onSubmitRequest: (request: Partial<ChangeRequest>, isDraft: boolean) => Promise<boolean>;
  onCancel: () => void;
  initialData?: ChangeRequest | null;
  departments?: Department[];
  storageConfig?: StorageConfig;
  categories?: CategoryMaster[];
  services?: ServiceMaster[];
  applications?: ApplicationAssetMaster[];
  issueTypes?: IssueTypeMaster[];
  modules?: ApplicationModuleMaster[];
  subFunctions?: ApplicationSubFunctionMaster[];
  processes?: ApplicationProcessMaster[];
}

export const ChangeRequestForm: React.FC<ChangeRequestFormProps> = ({
  currentUser,
  onSubmitRequest,
  onCancel,
  initialData,
  departments,
  storageConfig,
  categories: propCategories,
  services: propServices,
  applications: propApplications,
  issueTypes: propIssueTypes,
  modules: propModules,
  subFunctions: propSubFunctions,
  processes: propProcesses,
}) => {
  const allCategories = propCategories && propCategories.length > 0 ? propCategories : MASTER_CATEGORIES;
  const allServices = propServices && propServices.length > 0 ? propServices : MASTER_SERVICES;
  const allApplications = propApplications && propApplications.length > 0 ? propApplications : MASTER_APPLICATIONS_ASSETS;
  const allIssueTypes = propIssueTypes && propIssueTypes.length > 0 ? propIssueTypes : MASTER_ISSUE_TYPES;
  const allModules = propModules && propModules.length > 0 ? propModules : MASTER_APPLICATION_MODULES;
  const allSubFunctions = propSubFunctions && propSubFunctions.length > 0 ? propSubFunctions : MASTER_APPLICATION_SUBFUNCTIONS;
  const allProcesses = propProcesses && propProcesses.length > 0 ? propProcesses : MASTER_APPLICATION_PROCESSES;

  // Target Department HOD info
  const targetDept = (departments || []).find((d) => d.id === currentUser.departmentId);
  const hodName = targetDept?.hodName || 'Loh Pui Ling (Ms. Astrid)';
  const hodEmail = targetDept?.hodEmail || 'ASTRID@tanaka.com.my';

  // --------------------------------------------------------------------------
  // 1. SECTION 1 — CLASSIFICATION STATE
  // --------------------------------------------------------------------------
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    if (initialData?.categoryId) return initialData.categoryId;
    if (initialData?.category) {
      const match = allCategories.find((c) => c.name === initialData.category);
      if (match) return match.id;
    }
    return allCategories[0]?.id || 'cat-biz-apps'; // Default: Business Applications
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const submissionIdRef = useRef<string | null>(initialData?.submissionId || null);

  const currentCategory = useMemo(() => {
    return (
      allCategories.find((c) => c.id === selectedCategoryId) ||
      allCategories[0] ||
      MASTER_CATEGORIES[0] ||
      { id: 'cat-biz-apps', name: 'Business Applications', code: 'BIZ_APPS', isActive: true }
    );
  }, [allCategories, selectedCategoryId]);

  // Available Services for Selected Category
  const availableServices = useMemo(() => {
    const srvs = allServices.filter((s) => s.categoryId === selectedCategoryId && s.isActive);
    return srvs.length > 0 ? srvs : allServices.slice(0, 1);
  }, [allServices, selectedCategoryId]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    if (initialData?.serviceId) return initialData.serviceId;
    if (initialData?.subcategory) {
      const match = allServices.find((s) => s.name === initialData.subcategory);
      if (match) return match.id;
    }
    return availableServices[0]?.id || 'srv-biz-prod'; // Default: Production System
  });

  // Ensure selected service belongs to selected category
  useEffect(() => {
    if (availableServices.length > 0 && !availableServices.some((s) => s.id === selectedServiceId)) {
      setSelectedServiceId(availableServices[0].id);
    }
  }, [availableServices, selectedServiceId]);

  const currentService = useMemo(() => {
    return (
      availableServices.find((s) => s.id === selectedServiceId) ||
      availableServices[0] ||
      allServices[0] ||
      MASTER_SERVICES[0] ||
      { id: 'srv-biz-prod', name: 'Production System', code: 'PROD_SYS', categoryId: currentCategory?.id || 'cat-biz-apps', isActive: true }
    );
  }, [availableServices, selectedServiceId, allServices, currentCategory]);

  // Available Applications / IT Assets for Selected Service
  const availableApplicationsAssets = useMemo(() => {
    if (!currentService) return [];
    const apps = allApplications.filter(
      (a) => a.serviceId === currentService.id && a.isActive
    );
    return apps.length > 0 ? apps : allApplications.slice(0, 1);
  }, [allApplications, currentService]);

  const [selectedAppAssetId, setSelectedAppAssetId] = useState<string>(() => {
    if (initialData?.applicationAssetId) return initialData.applicationAssetId;
    if (initialData?.applicationName) {
      const match = allApplications.find(
        (a) => a.name === initialData.applicationName || a.code === initialData.applicationName
      );
      if (match) return match.id;
    }
    return availableApplicationsAssets[0]?.id || 'app-pcs-net'; // Default: PCS.NET
  });

  useEffect(() => {
    if (availableApplicationsAssets.length > 0 && !availableApplicationsAssets.some((a) => a.id === selectedAppAssetId)) {
      setSelectedAppAssetId(availableApplicationsAssets[0].id);
    }
  }, [availableApplicationsAssets, selectedAppAssetId]);

  const currentAppAsset = useMemo(() => {
    return (
      availableApplicationsAssets.find((a) => a.id === selectedAppAssetId) ||
      availableApplicationsAssets[0] ||
      allApplications[0] ||
      MASTER_APPLICATIONS_ASSETS[0] ||
      { id: 'app-pcs-net', name: 'PCS.NET', code: 'PCS_NET', serviceId: currentService?.id || 'srv-biz-prod', assetTag: 'SRV-PCS-01', hasApplicationArea: true, isActive: true }
    );
  }, [availableApplicationsAssets, selectedAppAssetId, allApplications, currentService]);

  // Issue Type Selection
  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState<string>(() => {
    if (initialData?.issueTypeId) return initialData.issueTypeId;
    if (initialData?.issueType) {
      const match = allIssueTypes.find((i) => i.name === initialData.issueType);
      if (match) return match.id;
    }
    return allIssueTypes[0]?.id || 'issue-incident';
  });

  const currentIssueType = useMemo(() => {
    return (
      allIssueTypes.find((i) => i.id === selectedIssueTypeId) ||
      allIssueTypes[0] ||
      MASTER_ISSUE_TYPES[0] ||
      { id: 'issue-incident', name: 'Incident / Bug', code: 'INCIDENT', isActive: true }
    );
  }, [allIssueTypes, selectedIssueTypeId]);

  // --------------------------------------------------------------------------
  // 2. SECTION 2 — APPLICATION AREA (CONDITIONAL & OPTIONAL)
  // --------------------------------------------------------------------------
  const isApplicationAreaAvailable = useMemo(() => {
    if (!currentAppAsset) return false;
    return (
      Boolean(currentAppAsset.hasApplicationArea) ||
      allModules.some((m) => m.applicationId === currentAppAsset.id && m.isActive)
    );
  }, [currentAppAsset, allModules]);

  // Modules available for current application (relational parent-child filtering by applicationId)
  const availableAppModules = useMemo(() => {
    if (!isApplicationAreaAvailable || !currentAppAsset) return [];
    return allModules.filter(
      (m) => m.applicationId === currentAppAsset.id && m.isActive
    );
  }, [isApplicationAreaAvailable, currentAppAsset, allModules]);

  // Temporary selectors for adding an Application Area
  const [activeModuleId, setActiveModuleId] = useState<string>('');
  const [activeSubFunctionId, setActiveSubFunctionId] = useState<string>('');
  const [activeProcessId, setActiveProcessId] = useState<string>('');

  // When available modules change, auto-select first module
  useEffect(() => {
    if (availableAppModules.length > 0) {
      if (!availableAppModules.some((m) => m.id === activeModuleId)) {
        setActiveModuleId(availableAppModules[0].id);
      }
    } else {
      setActiveModuleId('');
    }
    setActiveSubFunctionId('');
    setActiveProcessId('');
  }, [availableAppModules, activeModuleId]);

  // Available Sub-Functions for Active Module
  const availableSubFunctions = useMemo(() => {
    if (!activeModuleId) return [];
    return allSubFunctions.filter(
      (sf) => sf.moduleId === activeModuleId && sf.isActive
    );
  }, [activeModuleId, allSubFunctions]);

  // Available Processes for Active Sub-Function
  const availableProcesses = useMemo(() => {
    if (!activeSubFunctionId) return [];
    return allProcesses.filter(
      (p) => p.subFunctionId === activeSubFunctionId && p.isActive
    );
  }, [activeSubFunctionId, allProcesses]);

  // Tagged Application Areas on the Ticket (Defensively parses arrays & strings)
  const [applicationAreas, setApplicationAreas] = useState<ApplicationAreaSelection[]>(() => {
    if (initialData?.applicationAreas && Array.isArray(initialData.applicationAreas) && initialData.applicationAreas.length > 0) {
      return initialData.applicationAreas;
    }
    if (typeof initialData?.applicationAreas === 'string') {
      try {
        const parsed = JSON.parse(initialData.applicationAreas);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    // Backward compatibility with affectedModules
    if (initialData?.affectedModules && Array.isArray(initialData.affectedModules) && initialData.affectedModules.length > 0) {
      return initialData.affectedModules
        .filter((mod) => typeof mod === 'string' && (mod.includes('_') || mod.includes('.')))
        .map((modName, idx) => ({
          id: `area-migrated-${idx}`,
          moduleId: `mod-migrated-${idx}`,
          moduleCode: modName,
          moduleName: modName,
        }));
    }
    if (typeof initialData?.affectedModules === 'string') {
      try {
        const parsed = JSON.parse(initialData.affectedModules);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((mod) => typeof mod === 'string' && (mod.includes('_') || mod.includes('.')))
            .map((modName, idx) => ({
              id: `area-migrated-${idx}`,
              moduleId: `mod-migrated-${idx}`,
              moduleCode: modName,
              moduleName: modName,
            }));
        }
      } catch { /* ignore */ }
    }
    return [];
  });

  const handleAddApplicationArea = () => {
    if (!activeModuleId) return;
    const modObj = availableAppModules.find((m) => m.id === activeModuleId);
    if (!modObj) return;

    const subObj = availableSubFunctions.find((sf) => sf.id === activeSubFunctionId);
    const procObj = availableProcesses.find((p) => p.id === activeProcessId);

    const newArea: ApplicationAreaSelection = {
      id: `area-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      moduleId: modObj.id,
      moduleCode: modObj.code,
      moduleName: modObj.name,
      subFunctionId: subObj?.id,
      subFunctionName: subObj?.name,
      processId: procObj?.id,
      processName: procObj?.name,
    };

    // Prevent duplicate entries
    const isDuplicate = applicationAreas.some(
      (a) =>
        a.moduleId === newArea.moduleId &&
        a.subFunctionId === newArea.subFunctionId &&
        a.processId === newArea.processId
    );

    if (!isDuplicate) {
      setApplicationAreas([...applicationAreas, newArea]);
    }

    // Reset process selection for quick next addition
    setActiveProcessId('');
  };

  const handleRemoveApplicationArea = (id: string) => {
    setApplicationAreas(applicationAreas.filter((a) => a.id !== id));
  };

  // --------------------------------------------------------------------------
  // 3. SECTION 3 — REQUEST DETAILS STATE
  // --------------------------------------------------------------------------
  const [title, setTitle] = useState(initialData?.title || '');
  const [priority, setPriority] = useState<PriorityLevel>(initialData?.priority || 'Medium');
  const [requestedCompletionDate, setRequestedCompletionDate] = useState(() => {
    if (initialData?.requestedCompletionDate) {
      return String(initialData.requestedCompletionDate).split('T')[0];
    }
    return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  });
  const [currentBehavior, setCurrentBehavior] = useState(
    initialData?.currentBehaviorDescription || ''
  );
  const [requestedChange, setRequestedChange] = useState(
    initialData?.requestedChangeDescription || ''
  );
  const [businessJustification, setBusinessJustification] = useState(
    initialData?.businessJustification || ''
  );
  const [clarificationReply, setClarificationReply] = useState(
    initialData?.clarificationReply || ''
  );
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    if (Array.isArray(initialData?.attachments)) return initialData.attachments;
    if (typeof initialData?.attachments === 'string') {
      try {
        const parsed = JSON.parse(initialData.attachments);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* ignore */ }
    }
    return [];
  });
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --------------------------------------------------------------------------
  // Bring Device Out Specialized State
  // --------------------------------------------------------------------------
  const isDeviceOutCategory = useMemo(() => {
    return (
      currentCategory?.name === 'Bring Device Out' ||
      currentCategory?.code === 'DEV_OUT' ||
      selectedCategoryId === 'cat-dev-out'
    );
  }, [currentCategory, selectedCategoryId]);

  const [deviceFromDate, setDeviceFromDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [deviceToDate, setDeviceToDate] = useState<string>(() => {
    return new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
  });
  const [deviceVpnRequired, setDeviceVpnRequired] = useState<boolean>(false);
  const [deviceAssetModel, setDeviceAssetModel] = useState<string>('');
  const [deviceSerialNumber, setDeviceSerialNumber] = useState<string>('');
  const [deviceBusinessPurpose, setDeviceBusinessPurpose] = useState<string>('');

  // Approval required indicator: Laptop strictly requires approval
  const isApprovalRequired = useMemo(() => {
    if (isDeviceOutCategory) {
      return currentService?.name?.toLowerCase() === 'laptop' || true;
    }
    return false;
  }, [isDeviceOutCategory, currentService]);

  // Compute live Risk Score
  const calculatedRisk = calculateRiskScore({
    affectedModulesCount: applicationAreas.length || 1,
    priority,
    downtimeRequired: false,
    schemaChangeRequired: false,
    requestType: (currentIssueType?.name as RequestType) || 'Incident',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileUploadError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const maxMb = storageConfig?.maxFileSizeMb || 25;
    const fileSizeMb = file.size / (1024 * 1024);
    if (fileSizeMb > maxMb) {
      setFileUploadError(`File size (${fileSizeMb.toFixed(1)} MB) exceeds maximum allowed limit of ${maxMb} MB.`);
      return;
    }

    const result = await api.uploadAttachment(file, currentUser, initialData?.id);
    if (!result.success || !result.attachment) {
      setFileUploadError(result.message || 'File upload failed. The file was not saved.');
      return;
    }
    setAttachments(prev => [...prev, result.attachment!]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (isDeviceOutCategory) {
      if (new Date(deviceToDate) < new Date(deviceFromDate)) {
        errs.deviceToDate = 'To Date cannot be earlier than From Date.';
      }
      if (!deviceAssetModel.trim() && !currentAppAsset?.name) {
        errs.deviceAssetModel = 'Asset / Device model is required.';
      }
      if (!deviceBusinessPurpose.trim() && !businessJustification.trim()) {
        errs.deviceBusinessPurpose = 'Business Purpose is required.';
      }
    } else {
      if (!title.trim()) errs.title = 'Title / Summary is required.';
      if (!currentBehavior.trim())
        errs.currentBehavior = 'Description of current behavior is required.';
      if (!requestedCompletionDate)
        errs.requestedCompletionDate = 'Requested completion date is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!isDraft && !validate()) {
      return;
    }
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    if (!submissionIdRef.current) {
      submissionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    // Build affected modules array for search compatibility
    const affectedModulesList: string[] = [];
    if (applicationAreas.length > 0) {
      applicationAreas.forEach((area) => {
        let tag = area.moduleCode || area.moduleName;
        if (area.subFunctionName && area.processName) {
          tag = `${area.moduleCode || area.moduleName} > ${area.subFunctionName} > ${area.processName}`;
        } else if (area.subFunctionName) {
          tag = `${area.moduleCode || area.moduleName} > ${area.subFunctionName}`;
        }
        affectedModulesList.push(tag);
      });
    } else {
      affectedModulesList.push(`${currentCategory.name} > ${currentService.name} > ${currentAppAsset.name}`);
    }

    const finalTitle = isDeviceOutCategory
      ? (title.trim() || `Bring Device Out: ${currentService.name} - ${deviceAssetModel.trim() || currentAppAsset.name}`)
      : title;

    const finalBehavior = isDeviceOutCategory
      ? (currentBehavior.trim() || `Asset: ${deviceAssetModel.trim() || currentAppAsset.name}\nSerial Number: ${deviceSerialNumber.trim() || 'N/A'}\nDuration: ${deviceFromDate} to ${deviceToDate}\nVPN: ${deviceVpnRequired ? 'Required' : 'Not Required'}\nApproval: Required by IT Staff`)
      : currentBehavior;

    const finalJustification = isDeviceOutCategory
      ? (businessJustification.trim() || deviceBusinessPurpose.trim() || 'Authorized company equipment removal.')
      : businessJustification || 'Standard IT operational request.';

    // Synchronize to dedicated Bring Device Out storage table
    if (isDeviceOutCategory) {
      try {
        await api.createDeviceOutRequest({
          requesterId: currentUser.id,
          requesterName: currentUser.fullName,
          departmentId: currentUser.departmentId,
          departmentName: currentUser.departmentName,
          serviceName: currentService.name,
          assetName: deviceAssetModel.trim() || currentAppAsset.name || currentService.name,
          serialNumber: deviceSerialNumber.trim() || undefined,
          fromDate: deviceFromDate,
          toDate: deviceToDate,
          vpnRequired: deviceVpnRequired,
          businessPurpose: deviceBusinessPurpose.trim() || finalJustification,
        });
      } catch (err) {
        console.warn('[Device Out Direct Sync Notice]', err);
      }
    }

    const payload: Partial<ChangeRequest> = {
      id: initialData?.id,
      submissionId: submissionIdRef.current || undefined,
      title: finalTitle,
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      requesterEmail: currentUser.email,
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,

      // Unified Relational Classification fields
      categoryId: currentCategory.id,
      categoryName: currentCategory.name,
      category: currentCategory.name,
      serviceId: currentService.id,
      serviceName: currentService.name,
      subcategory: currentService.name,
      applicationAssetId: currentAppAsset.id,
      applicationAssetName: currentAppAsset.name,
      applicationName: currentAppAsset.name,
      assetTag: currentAppAsset.assetTag,
      issueTypeId: currentIssueType.id,
      issueTypeName: currentIssueType.name,
      issueType: currentIssueType.name,
      requestType: (currentIssueType.name as RequestType) || 'Incident',

      // Application Areas
      applicationAreas,
      affectedModules: affectedModulesList,

      // Details
      priority: isDeviceOutCategory ? 'Medium' : priority,
      currentBehaviorDescription: finalBehavior,
      requestedChangeDescription: requestedChange || finalBehavior,
      businessJustification: finalJustification,
      clarificationReply: clarificationReply.trim() || undefined,
      attachments,
      requestedCompletionDate: isDeviceOutCategory ? deviceToDate : requestedCompletionDate,
      riskAssessment: calculatedRisk,
    };

    try {
      const saved = await onSubmitRequest(payload, isDraft);
      if (!saved) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    } catch {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const isAlreadyHodApproved = !!(
    initialData?.hodApprovedAt ||
    initialData?.hodApprovedBy ||
    initialData?.returnedByRole === 'IT Admin' ||
    initialData?.returnedByRole === 'Software Developer' ||
    initialData?.itClarificationRequested
  );

  const isReturnedForClarification = !!(
    initialData?.status === 'Returned to Requester' || initialData?.itClarificationRequested
  );

  const latestReturnHistory = useMemo(() => {
    if (!initialData || !Array.isArray(initialData.approvalHistory)) return null;
    return (
      initialData.approvalHistory.find(
        (h) =>
          h &&
          (h.toStatus === 'Returned to Requester' ||
            h.decision === 'SendBack' ||
            (typeof h.comments === 'string' && h.comments.includes('notes:')) ||
            (typeof h.comments === 'string' && h.comments.toLowerCase().includes('clarification')))
      ) || null
    );
  }, [initialData]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1">
            {initialData
              ? isReturnedForClarification
                ? isAlreadyHodApproved
                  ? `Provide Technical Clarification (${initialData.id})`
                  : `Provide Clarification (${initialData.id})`
                : `Edit Ticket / Change Request (${initialData.id})`
              : 'Create New IT Ticket / Change Request'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isReturnedForClarification && isAlreadyHodApproved
              ? initialData?.assignedDeveloperName
                ? `Update requested details. HOD approval is already on file (${initialData.hodApprovedBy || 'Approved'}); submitting your updates will return directly to assigned developer ${initialData.assignedDeveloperName} (without requiring HOD approval again).`
                : 'Update requested details. HOD approval is already on file; submitting your updates will return directly to IT Admin (without requiring HOD approval again).'
              : isReturnedForClarification
              ? 'Update the requested details or attachments. Upon submission, this request will be submitted for Department HOD approval.'
              : `Fill in the classification and details below. Non-critical requests route to Department HOD (${currentUser.departmentName}) for approval.`}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Clarification Request Notice Banner */}
        {isReturnedForClarification && (
          <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-5 text-xs space-y-3 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-amber-950 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  {latestReturnHistory?.actorName
                    ? `Technical Clarification Requested by ${latestReturnHistory.actorName} (${latestReturnHistory.actorRole || initialData?.returnedByRole || 'IT Staff'})`
                    : `Clarification Requested by ${initialData?.returnedByRole || 'IT Staff'}`}
                </span>
              </div>
              {latestReturnHistory?.actionDate && (
                <span className="text-[11px] text-amber-700 font-mono">
                  Requested on {latestReturnHistory.actionDate}
                </span>
              )}
            </div>

            {latestReturnHistory?.comments && (
              <div className="bg-white/95 p-3.5 rounded-xl border border-amber-200 text-amber-950">
                <strong className="text-amber-950 block mb-1 text-[11px] uppercase tracking-wider">
                  Questions / Clarifications Required:
                </strong>
                <p className="leading-relaxed whitespace-pre-wrap font-medium text-xs">
                  {latestReturnHistory.comments}
                </p>
              </div>
            )}

            {/* Direct Reply Note Field */}
            <div className="bg-white/95 p-3.5 rounded-xl border border-amber-200/90 space-y-1.5">
              <label className="block text-xs font-bold text-amber-950">
                Your Clarification Reply / Answer to IT / HOD
              </label>
              <textarea
                rows={2}
                value={clarificationReply}
                onChange={(e) => setClarificationReply(e.target.value)}
                placeholder="Explain the additional technical details, clarifications, or answer the questions above..."
                className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs text-slate-900 bg-amber-50/20 focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
              />
              <p className="text-[10.5px] text-amber-800">
               
              </p>
            </div>

            <p className="text-[11px] text-amber-800 leading-normal">
              💡 <strong>Action:</strong> Review and update any descriptions, affected areas, or attach files below. Once you click "Submit", your response will{' '}
              {isAlreadyHodApproved
                ? initialData?.assignedDeveloperName
                  ? `route directly back to assigned developer ${initialData.assignedDeveloperName} as "In Progress" (bypassing HOD re-approval).`
                  : 'route directly back to IT Admin (bypassing HOD re-approval).'
                : 'route back to Department HOD for approval.'}
            </p>
          </div>
        )}

        {/* ================================================================== */}
        {/* SECTION 1 — CLASSIFICATION */}
        {/* ================================================================== */}
        <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs">1</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">SECTION 1 — CLASSIFICATION</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Category * */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-2xs cursor-pointer"
              >
                {allCategories.filter((c) => c.isActive).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Service * */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Service <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-2xs cursor-pointer"
              >
                {availableServices.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Application / Asset * */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Application / Asset <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedAppAssetId}
                onChange={(e) => setSelectedAppAssetId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-2xs cursor-pointer"
              >
                {availableApplicationsAssets.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Issue Type * */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Issue Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedIssueTypeId}
                onChange={(e) => setSelectedIssueTypeId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-2xs cursor-pointer"
              >
                {allIssueTypes.filter((i) => i.isActive).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* SECTION 2 — BRING DEVICE OUT SPECIFICATIONS */}
        {/* ================================================================== */}
        {isDeviceOutCategory && (
          <div className="bg-amber-50/40 border border-amber-200/90 rounded-2xl p-5 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-amber-600 text-white rounded-lg font-bold text-xs">
                  2
                </span>
                <div className="flex items-center space-x-1.5">
                  <Laptop className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    SECTION 2 — BRING DEVICE OUT SPECIFICATIONS
                  </h3>
                </div>
              </div>
              <div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  Approval Required: {isApprovalRequired ? 'Mandatory (IT Staff)' : 'Standard'}
                </span>
              </div>
            </div>

            {/* Error Banner */}
            {errors.deviceToDate && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errors.deviceToDate}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Asset / Device Model */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Asset / Device Model <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={`e.g. Dell Latitude 5430 (${currentService.name})`}
                  value={deviceAssetModel}
                  onChange={(e) => setDeviceAssetModel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
                />
                {errors.deviceAssetModel && (
                  <p className="text-[11px] text-rose-600 font-semibold">{errors.deviceAssetModel}</p>
                )}
              </div>

              {/* Serial Number / Asset Tag */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Serial Number / Asset Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-8F7K2L3, TANAKA-AST-0091"
                  value={deviceSerialNumber}
                  onChange={(e) => setDeviceSerialNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
                />
              </div>

              {/* From Date */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  From Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={deviceFromDate}
                  onChange={(e) => setDeviceFromDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
                />
              </div>

              {/* To Date */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  To Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  min={deviceFromDate}
                  value={deviceToDate}
                  onChange={(e) => setDeviceToDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
                />
                {new Date(deviceToDate) < new Date(deviceFromDate) && (
                  <p className="text-[11px] text-rose-600 font-bold">
                    To Date cannot be earlier than From Date.
                  </p>
                )}
              </div>
            </div>

            {/* VPN Required Toggle */}
            <div className="bg-white p-3.5 rounded-xl border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-900 block">
                  VPN Required:
                </label>
                <p className="text-[11px] text-slate-500">
                  Does the user require VPN configuration/access while outside company premises?
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="vpnRadio"
                    checked={deviceVpnRequired === true}
                    onChange={() => setDeviceVpnRequired(true)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Required</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="vpnRadio"
                    checked={deviceVpnRequired === false}
                    onChange={() => setDeviceVpnRequired(false)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-semibold text-slate-600">Not Required</span>
                </label>
              </div>
            </div>

            {/* Business Purpose */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Business Purpose <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="State the official business purpose for taking this equipment out (e.g. on-site vendor audit, off-site customer presentation, official remote work duty)."
                value={deviceBusinessPurpose}
                onChange={(e) => setDeviceBusinessPurpose(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
              />
              {errors.deviceBusinessPurpose && (
                <p className="text-[11px] text-rose-600 font-semibold">{errors.deviceBusinessPurpose}</p>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* SECTION 2 — APPLICATION AREA (CONDITIONAL & OPTIONAL) */}
        {/* Only shown when Application has configured modules/functions */}
        {/* ================================================================== */}
        {!isDeviceOutCategory && isApplicationAreaAvailable && (
          <div className="bg-blue-50/40 border border-blue-200/90 rounded-2xl p-5 space-y-4 transition-all">
            <div className="flex items-center justify-between border-b border-blue-200/80 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs">2</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">SECTION 2 — APPLICATION AREA</h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Module */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  Module
                </label>
                <select
                  value={activeModuleId}
                  onChange={(e) => {
                    setActiveModuleId(e.target.value);
                    setActiveSubFunctionId('');
                    setActiveProcessId('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs cursor-pointer"
                >
                  <option value="">-- Select Module --</option>
                  {availableAppModules.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Function */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  Sub-Function
                </label>
                <select
                  value={activeSubFunctionId}
                  disabled={!activeModuleId}
                  onChange={(e) => {
                    setActiveSubFunctionId(e.target.value);
                    setActiveProcessId('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs cursor-pointer"
                >
                  <option value="">
                    {activeModuleId ? '-- Select Sub-Function --' : '-- Select Module First --'}
                  </option>
                  {availableSubFunctions.map((sf) => (
                    <option key={sf.id} value={sf.id}>
                      {sf.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Process / Function */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  Process / Function
                </label>
                <select
                  value={activeProcessId}
                  disabled={!activeSubFunctionId}
                  onChange={(e) => setActiveProcessId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs cursor-pointer"
                >
                  <option value="">
                    {activeSubFunctionId
                      ? '-- Select Process / Function --'
                      : '-- Select Sub-Function First --'}
                  </option>
                  {availableProcesses.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Application Area Button */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleAddApplicationArea}
                disabled={!activeModuleId}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Application Area</span>
              </button>
            </div>

            {/* Tagged Application Areas List */}
            {applicationAreas.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-blue-200/80">
                <span className="text-xs font-bold text-slate-700 block">
                  Attached Application Areas ({applicationAreas.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {applicationAreas.map((area) => (
                    <div
                      key={area.id}
                      className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-indigo-950 border border-indigo-200 shadow-2xs"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{area.moduleCode || area.moduleName}</span>
                      {area.subFunctionName && (
                        <>
                          <span className="text-slate-300">/</span>
                          <span className="text-indigo-700 font-semibold">{area.subFunctionName}</span>
                        </>
                      )}
                      {area.processName && (
                        <>
                          <span className="text-slate-300">/</span>
                          <span className="text-emerald-700 font-semibold">{area.processName}</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveApplicationArea(area.id)}
                        className="p-1 hover:bg-rose-100 hover:text-rose-700 text-slate-400 rounded-lg transition-colors ml-1 cursor-pointer"
                        title="Remove area"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* SECTION 2 or 3 — REQUEST DETAILS */}
        {/* Not required when Bring Device Out is selected */}
        {/* ================================================================== */}
        {!isDeviceOutCategory && (
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs">
                  {isApplicationAreaAvailable ? '3' : '2'}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    SECTION {isApplicationAreaAvailable ? '3' : '2'} — REQUEST DETAILS
                  </h3>
                </div>
              </div>
            </div>

            {/* Title / Summary * */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Title / Summary <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., CD2 Wire Receive Case ID Generation Error or Laptop Screen Flickering on Dock"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 transition-all ${
                  errors.title
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              {errors.title && <p className="text-[11px] text-rose-500 mt-1">{errors.title}</p>}
            </div>

            {/* Priority & Requested Completion Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Priority <span className="text-rose-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer shadow-2xs"
                >
                  <option value="Critical">Critical (24h SLA) — Outage, regulatory block, severe security risk</option>
                  <option value="High">High (3 Days) — Core workflow obstruction with no workaround</option>
                  <option value="Medium">Medium (7 Days) — Standard process optimization or feature enhancement</option>
                  <option value="Low">Low (14 Days) — Minor UI adjustments, cosmetic corrections, or non-urgent</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isSubmitting ? 'Submitting...' : priority === 'Critical' && '⚡ 24h SLA: System-wide outage, regulatory block, severe security risk.'}
                  {priority === 'High' && '📌 3 Days SLA: Core departmental workflow obstruction with no workaround.'}
                  {priority === 'Medium' && '📋 7 Days SLA: Standard process optimization or feature enhancement.'}
                  {priority === 'Low' && '💡 14 Days SLA: Minor UI adjustments, cosmetic corrections, or non-urgent queries.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Requested Completion Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={requestedCompletionDate}
                  onChange={(e) => setRequestedCompletionDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
                />
                {errors.requestedCompletionDate && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.requestedCompletionDate}</p>
                )}
              </div>
            </div>

            {/* Description of Current Behavior * */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Description of Current Behavior <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={currentBehavior}
                onChange={(e) => setCurrentBehavior(e.target.value)}
                placeholder="Describe what is happening right now, error messages, symptoms, or current workflow..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 transition-all ${
                  errors.currentBehavior ? 'border-rose-400' : 'border-slate-300 focus:ring-blue-100'
                }`}
              />
              {errors.currentBehavior && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.currentBehavior}</p>
              )}
            </div>

            {/* Description of Requested Change / Target Behavior */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Description of Requested Change / Target Behavior
              </label>
              <textarea
                rows={3}
                value={requestedChange}
                onChange={(e) => setRequestedChange(e.target.value)}
                placeholder="Describe the desired outcome, expected behavior, or modification needed..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Business Justification & ROI */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Business Justification & ROI
              </label>
              <textarea
                rows={2}
                value={businessJustification}
                onChange={(e) => setBusinessJustification(e.target.value)}
                placeholder="Explain the operational impact, cost savings, compliance requirement, or urgency..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  Attachments (Screenshots, Error Logs, Sample CSVs, Forms)
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Max {storageConfig?.maxFileSizeMb || 25} MB / file 
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  <span>Attach File</span>
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
                <span className="text-[11px] text-slate-400">
                  Supports PDF, PNG, JPG, CSV, XLSX, DOCX, TXT, ZIP
                </span>
              </div>

              {fileUploadError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fileUploadError}</span>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center space-x-2.5 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs shadow-2xs"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      <div>
                        <span className="font-bold text-slate-900 block">{att.fileName}</span>
                        <span className="text-[10px] text-slate-400">{att.fileSizeKb} KB • Encrypted</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors ml-1 cursor-pointer"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t border-slate-200 pt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center space-x-2 transition-colors border border-slate-300 cursor-pointer"
            >
              <Save className="w-4 h-4 text-slate-600" />
              <span>{isSubmitting ? 'Saving...' : 'Save as Draft'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isDeviceOutCategory
                  ? 'Submit Bring Device Out Request'
                  : priority === 'Critical'
                  ? 'Submit Critical Request (Bypass HOD)'
                  : isReturnedForClarification && isAlreadyHodApproved
                  ? (initialData?.assignedDeveloperName && typeof initialData.assignedDeveloperName === 'string' && initialData.assignedDeveloperName.trim())
                    ? `Resubmit Directly to ${initialData.assignedDeveloperName.trim().split(' ')[0]} (Dev)`
                    : 'Resubmit Directly to IT Admin'
                  : isReturnedForClarification
                  ? 'Submit for HOD Approval'
                  : 'Submit for HOD Approval'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
