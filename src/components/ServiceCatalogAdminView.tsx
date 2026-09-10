import React, { useState, useMemo, useEffect } from 'react';
import {
  CategoryMaster,
  ServiceMaster,
  ApplicationAssetMaster,
  IssueTypeMaster,
  ApplicationModuleMaster,
  ApplicationSubFunctionMaster,
  ApplicationProcessMaster,
  UserProfile,
  TicketCategory,
  PriorityLevel,
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
import { api } from '../services/api';
import {
  FolderTree,
  Server,
  Layers,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Laptop,
  Network,
  Printer,
  Shield,
  HelpCircle,
  FileCode,
  Sparkles,
  RotateCcw,
  Save,
  ArrowRight,
  ChevronRight,
  Database,
  Sliders,
} from 'lucide-react';

interface ServiceCatalogAdminViewProps {
  currentUser: UserProfile;
  categories?: CategoryMaster[];
  onUpdateCategories?: (cats: CategoryMaster[]) => void;
  services?: ServiceMaster[];
  onUpdateServices?: (srvs: ServiceMaster[]) => void;
  applications?: ApplicationAssetMaster[];
  onUpdateApplications?: (apps: ApplicationAssetMaster[]) => void;
  issueTypes?: IssueTypeMaster[];
  onUpdateIssueTypes?: (types: IssueTypeMaster[]) => void;
  modules?: ApplicationModuleMaster[];
  onUpdateModules?: (mods: ApplicationModuleMaster[]) => void;
  subFunctions?: ApplicationSubFunctionMaster[];
  onUpdateSubFunctions?: (sfs: ApplicationSubFunctionMaster[]) => void;
  processes?: ApplicationProcessMaster[];
  onUpdateProcesses?: (procs: ApplicationProcessMaster[]) => void;
  initialCatalogTab?: 'categories' | 'services' | 'applications' | 'issuetypes' | 'appareas' | 'matrix';
}

export const ServiceCatalogAdminView: React.FC<ServiceCatalogAdminViewProps> = ({
  currentUser,
  categories: propCategories,
  onUpdateCategories,
  services: propServices,
  onUpdateServices,
  applications: propApplications,
  onUpdateApplications,
  issueTypes: propIssueTypes,
  onUpdateIssueTypes,
  modules: propModules,
  onUpdateModules,
  subFunctions: propSubFunctions,
  onUpdateSubFunctions,
  processes: propProcesses,
  onUpdateProcesses,
  initialCatalogTab = 'categories',
}) => {
  // Master state initialized directly from props (database source of truth)
  const [categories, setCategories] = useState<CategoryMaster[]>(
    propCategories || MASTER_CATEGORIES
  );
  const [services, setServices] = useState<ServiceMaster[]>(
    propServices || MASTER_SERVICES
  );
  const [applications, setApplications] = useState<ApplicationAssetMaster[]>(
    propApplications || []
  );
  const [issueTypes, setIssueTypes] = useState<IssueTypeMaster[]>(
    propIssueTypes || []
  );
  const [modules, setModules] = useState<ApplicationModuleMaster[]>(
    propModules || []
  );
  const [subFunctions, setSubFunctions] = useState<ApplicationSubFunctionMaster[]>(
    propSubFunctions || []
  );
  const [processes, setProcesses] = useState<ApplicationProcessMaster[]>(
    propProcesses || []
  );

  const [activeCatalogTab, setActiveCatalogTab] = useState<
    'categories' | 'services' | 'applications' | 'issuetypes' | 'appareas' | 'matrix'
  >(initialCatalogTab);

  const [searchTerm, setSearchTerm] = useState('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [applicationSearchTerm, setApplicationSearchTerm] = useState('');
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  useEffect(() => {
    if (propCategories) setCategories(propCategories);
  }, [propCategories]);

  useEffect(() => {
    if (propServices) setServices(propServices);
  }, [propServices]);

  useEffect(() => {
    if (!selectedCatalogServiceId || !services.some((s) => s.id === selectedCatalogServiceId)) {
      setSelectedCatalogServiceId(services[0]?.id || '');
    }
  }, [services, selectedCatalogServiceId]);

  useEffect(() => {
    if (propApplications) setApplications(propApplications);
  }, [propApplications]);

  useEffect(() => {
    if (propIssueTypes) setIssueTypes(propIssueTypes);
  }, [propIssueTypes]);

  useEffect(() => {
    if (propModules) setModules(propModules);
  }, [propModules]);

  useEffect(() => {
    if (propSubFunctions) setSubFunctions(propSubFunctions);
  }, [propSubFunctions]);

  useEffect(() => {
    if (propProcesses) setProcesses(propProcesses);
  }, [propProcesses]);

  // --------------------------------------------------------------------------
  // Modals and Editing States
  // --------------------------------------------------------------------------
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catCodeInput, setCatCodeInput] = useState('');
  const [catDescInput, setCatDescInput] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [srvNameInput, setSrvNameInput] = useState('');
  const [srvCodeInput, setSrvCodeInput] = useState('');
  const [srvCatIdInput, setSrvCatIdInput] = useState(categories[0]?.id || 'cat-biz-apps');
  const [srvDescInput, setSrvDescInput] = useState('');
  const [showServiceModal, setShowServiceModal] = useState(false);

  const [editAppId, setEditAppId] = useState<string | null>(null);
  const [appNameInput, setAppNameInput] = useState('');
  const [appCodeInput, setAppCodeInput] = useState('');
  const [appSrvIdInput, setAppSrvIdInput] = useState(services[0]?.id || 'srv-biz-prod');
  const [appAssetTagInput, setAppAssetTagInput] = useState('');
  const [appHasAreaInput, setAppHasAreaInput] = useState(true);
  const [appDescInput, setAppDescInput] = useState('');
  const [showAppModal, setShowAppModal] = useState(false);

  const [editIssueTypeId, setEditIssueTypeId] = useState<string | null>(null);
  const [issueNameInput, setIssueNameInput] = useState('');
  const [issueCodeInput, setIssueCodeInput] = useState('');
  const [issueDescInput, setIssueDescInput] = useState('');
  const [issuePriorityInput, setIssuePriorityInput] = useState<PriorityLevel>('Medium');
  const [issueBadgeColorInput, setIssueBadgeColorInput] = useState('bg-rose-50 text-rose-700 border-rose-200');
  const [issueIsActiveInput, setIssueIsActiveInput] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Hierarchy entity modals
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editModuleId, setEditModuleId] = useState<string | null>(null);
  const [modNameInput, setModNameInput] = useState('');
  const [modCodeInput, setModCodeInput] = useState('');
  const [modDescInput, setModDescInput] = useState('');
  const [modAppIdInput, setModAppIdInput] = useState(applications[0]?.id || '');

  const [showSubFnModal, setShowSubFnModal] = useState(false);
  const [editSubFnId, setEditSubFnId] = useState<string | null>(null);
  const [subFnNameInput, setSubFnNameInput] = useState('');
  const [subFnCodeInput, setSubFnCodeInput] = useState('');
  const [subFnModIdInput, setSubFnModIdInput] = useState('');

  const [showProcessModal, setShowProcessModal] = useState(false);
  const [editProcessId, setEditProcessId] = useState<string | null>(null);
  const [procNameInput, setProcNameInput] = useState('');
  const [procCodeInput, setProcCodeInput] = useState('');
  const [procSubFnIdInput, setProcSubFnIdInput] = useState('');

  // Application Area 3-Tier Hierarchy Explorer
  const [selectedHierarchyAppId, setSelectedHierarchyAppId] = useState<string>(
    applications.find((a) => a.hasApplicationArea)?.id || applications[0]?.id || ''
  );
  const [selectedHierarchyModuleId, setSelectedHierarchyModuleId] = useState<string>(
    modules[0]?.id || ''
  );
  const [selectedHierarchySubFnId, setSelectedHierarchySubFnId] = useState<string>(
    subFunctions[0]?.id || ''
  );

  // Sync active selections when parent data updates
  useEffect(() => {
    if (applications.length > 0 && (!selectedHierarchyAppId || !applications.some((a) => a.id === selectedHierarchyAppId))) {
      const nextApp = applications.find((a) => a.hasApplicationArea) || applications[0];
      setSelectedHierarchyAppId(nextApp.id);
    }
  }, [applications, selectedHierarchyAppId]);

  useEffect(() => {
    if (selectedHierarchyAppId) {
      const appMods = modules.filter((m) => m.applicationId === selectedHierarchyAppId);
      if (appMods.length > 0) {
        if (!appMods.some((m) => m.id === selectedHierarchyModuleId)) {
          setSelectedHierarchyModuleId(appMods[0].id);
        }
      } else {
        setSelectedHierarchyModuleId('');
        setSelectedHierarchySubFnId('');
      }
    }
  }, [selectedHierarchyAppId, modules, selectedHierarchyModuleId]);

  useEffect(() => {
    if (selectedHierarchyModuleId) {
      const modSubs = subFunctions.filter((sf) => sf.moduleId === selectedHierarchyModuleId);
      if (modSubs.length > 0) {
        if (!modSubs.some((sf) => sf.id === selectedHierarchySubFnId)) {
          setSelectedHierarchySubFnId(modSubs[0].id);
        }
      } else {
        setSelectedHierarchySubFnId('');
      }
    }
  }, [selectedHierarchyModuleId, subFunctions, selectedHierarchySubFnId]);

  // Filtered Lists
  const filteredCategories = useMemo(() => {
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const cat = categories.find((c) => c.id === s.categoryId);
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cat && cat.name.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [services, categories, searchTerm]);

  const filteredApplications = useMemo(() => {
    return applications.filter((a) => {
      const srv = services.find((s) => s.id === a.serviceId);
      const cat = srv ? categories.find((c) => c.id === srv.categoryId) : null;
      return (
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.assetTag && a.assetTag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (srv && srv.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cat && cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  }, [applications, services, categories, searchTerm]);

  const catalogServiceList = useMemo(() => {
    const q = serviceSearchTerm.trim().toLowerCase();
    return services.filter((s) => {
      const cat = categories.find((c) => c.id === s.categoryId);
      return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || !!cat?.name.toLowerCase().includes(q);
    });
  }, [services, categories, serviceSearchTerm]);

  const selectedCatalogService = services.find((s) => s.id === selectedCatalogServiceId);
  const selectedCatalogServiceApps = useMemo(() => {
    const q = applicationSearchTerm.trim().toLowerCase();
    return applications.filter((a) => {
      if (selectedCatalogServiceId && a.serviceId !== selectedCatalogServiceId) return false;
      return !q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || !!a.assetTag?.toLowerCase().includes(q);
    });
  }, [applications, selectedCatalogServiceId, applicationSearchTerm]);

  const catalogApplicationServices = useMemo(() => {
    const q = serviceSearchTerm.trim().toLowerCase();
    return services.filter((s) => {
      const linked = applications.some((a) => a.serviceId === s.id);
      const cat = categories.find((c) => c.id === s.categoryId);
      return linked && (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || !!cat?.name.toLowerCase().includes(q));
    });
  }, [services, applications, categories, serviceSearchTerm]);

  const filteredIssueTypes = useMemo(() => {
    return issueTypes.filter(
      (it) =>
        it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.defaultPriority.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [issueTypes, searchTerm]);

  // --------------------------------------------------------------------------
  // Category Actions
  // --------------------------------------------------------------------------
  const handleSaveCategory = () => {
    if (!catNameInput.trim()) return;
    let updated: CategoryMaster[];
    if (editCategoryId) {
      updated = categories.map((c) =>
        c.id === editCategoryId
          ? {
              ...c,
              name: catNameInput.trim(),
              code: catCodeInput.trim().toUpperCase() || c.code,
              description: catDescInput.trim(),
            }
          : c
      );
      showToast(`Category "${catNameInput}" updated successfully.`);
    } else {
      const newCat: CategoryMaster = {
        id: `cat-${Date.now().toString().slice(-6)}`,
        name: catNameInput.trim(),
        code: catCodeInput.trim().toUpperCase() || `CAT_${Date.now().toString().slice(-4)}`,
        description: catDescInput.trim(),
        isActive: true,
        displayOrder: categories.length + 1,
      };
      updated = [...categories, newCat];
      showToast(`New category "${catNameInput}" created.`);
    }
    setCategories(updated);
    if (onUpdateCategories) onUpdateCategories(updated);
    setShowCategoryModal(false);
  };

  const handleDeleteCategory = async (id: string) => {
    const target = categories.find((c) => c.id === id);
    const linkedServices = services.filter((s) => s.categoryId === id);
    const message = linkedServices.length
      ? `Delete category "${target?.name || id}"? This will also delete ${linkedServices.length} linked service(s) and their applications/assets and technical hierarchy from PostgreSQL.`
      : `Delete category "${target?.name || id}"? This action cannot be undone.`;
    if (!window.confirm(message)) return;

    try {
      const result = await api.deleteCatalogItem('categories', id);
      if (!result.success) throw new Error(result.message || 'Category deletion failed.');

      const updatedCategories = categories.filter((c) => c.id !== id);
      const removedServiceIds = new Set(linkedServices.map((s) => s.id));
      const removedModuleIds = new Set(modules.filter((m) => removedServiceIds.has(applications.find((a) => a.id === m.applicationId)?.serviceId || '')).map((m) => m.id));
      const removedSubIds = new Set(subFunctions.filter((sf) => removedModuleIds.has(sf.moduleId)).map((sf) => sf.id));
      const updatedServices = services.filter((s) => s.categoryId !== id);
      const updatedApplications = applications.filter((a) => !removedServiceIds.has(a.serviceId));
      const updatedModules = modules.filter((m) => !removedModuleIds.has(m.id));
      const updatedSubFunctions = subFunctions.filter((sf) => !removedSubIds.has(sf.id));
      const updatedProcesses = processes.filter((pr) => !removedSubIds.has(pr.subFunctionId));

      setCategories(updatedCategories);
      setServices(updatedServices);
      setApplications(updatedApplications);
      setModules(updatedModules);
      setSubFunctions(updatedSubFunctions);
      setProcesses(updatedProcesses);
      onUpdateCategories?.(updatedCategories);
      onUpdateServices?.(updatedServices);
      onUpdateApplications?.(updatedApplications);
      onUpdateModules?.(updatedModules);
      onUpdateSubFunctions?.(updatedSubFunctions);
      onUpdateProcesses?.(updatedProcesses);
      showToast(`Category "${target?.name || id}" deleted from PostgreSQL.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Category could not be deleted.');
    }
  };

  const handleToggleCategoryActive = (id: string) => {
    const updated = categories.map((c) =>
      c.id === id ? { ...c, isActive: !c.isActive } : c
    );
    setCategories(updated);
    if (onUpdateCategories) onUpdateCategories(updated);
    showToast('Category status updated.');
  };

  // --------------------------------------------------------------------------
  // Service Actions
  // --------------------------------------------------------------------------
  const handleSaveService = () => {
    if (!srvNameInput.trim()) return;
    let updated: ServiceMaster[];
    if (editServiceId) {
      updated = services.map((s) =>
        s.id === editServiceId
          ? {
              ...s,
              name: srvNameInput.trim(),
              code: srvCodeInput.trim().toUpperCase() || s.code,
              categoryId: srvCatIdInput,
              description: srvDescInput.trim(),
            }
          : s
      );
      showToast(`Service "${srvNameInput}" updated successfully.`);
    } else {
      const selectedCategory = categories.find((c) => c.id === srvCatIdInput);
      const newSrv: ServiceMaster = {
        id: `srv-${Date.now().toString().slice(-6)}`,
        name: srvNameInput.trim(),
        code: srvCodeInput.trim().toUpperCase() || `SRV_${Date.now().toString().slice(-4)}`,
        categoryId: srvCatIdInput,
        categoryName: (selectedCategory?.name || 'Business Applications') as TicketCategory,
        isAssetBased: selectedCategory ? selectedCategory.name === 'Hardware' || selectedCategory.name === 'Printer & Scanning' : false,
        description: srvDescInput.trim(),
        isActive: true,
        displayOrder: services.length + 1,
      };
      updated = [...services, newSrv];
      showToast(`New service "${srvNameInput}" created.`);
    }
    setServices(updated);
    if (onUpdateServices) onUpdateServices(updated);
    setShowServiceModal(false);
  };

  const handleDeleteService = async (id: string) => {
    const target = services.find((s) => s.id === id);
    const linkedApplications = applications.filter((a) => a.serviceId === id);
    if (!window.confirm(`Delete service "${target?.name || id}"? This will also delete ${linkedApplications.length} linked application/asset(s) and their technical hierarchy from PostgreSQL.`)) return;

    try {
      const result = await api.deleteCatalogItem('services', id);
      if (!result.success) throw new Error(result.message || 'Service deletion failed.');

      const removedAppIds = new Set(linkedApplications.map((a) => a.id));
      const removedModuleIds = new Set(modules.filter((m) => removedAppIds.has(m.applicationId)).map((m) => m.id));
      const removedSubIds = new Set(subFunctions.filter((sf) => removedModuleIds.has(sf.moduleId)).map((sf) => sf.id));
      const updatedServices = services.filter((s) => s.id !== id);
      const updatedApplications = applications.filter((a) => !removedAppIds.has(a.id));
      const updatedModules = modules.filter((m) => !removedModuleIds.has(m.id));
      const updatedSubFunctions = subFunctions.filter((sf) => !removedSubIds.has(sf.id));
      const updatedProcesses = processes.filter((pr) => !removedSubIds.has(pr.subFunctionId));

      setServices(updatedServices);
      setApplications(updatedApplications);
      setModules(updatedModules);
      setSubFunctions(updatedSubFunctions);
      setProcesses(updatedProcesses);
      onUpdateServices?.(updatedServices);
      onUpdateApplications?.(updatedApplications);
      onUpdateModules?.(updatedModules);
      onUpdateSubFunctions?.(updatedSubFunctions);
      onUpdateProcesses?.(updatedProcesses);
      showToast(`Service "${target?.name || id}" deleted from PostgreSQL.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Service could not be deleted.');
    }
  };

  const handleToggleServiceActive = (id: string) => {
    const updated = services.map((s) =>
      s.id === id ? { ...s, isActive: !s.isActive } : s
    );
    setServices(updated);
    if (onUpdateServices) onUpdateServices(updated);
    showToast('Service status updated.');
  };

  // --------------------------------------------------------------------------
  // Application Actions
  // --------------------------------------------------------------------------
  const handleSaveApp = () => {
    if (!appNameInput.trim()) return;
    let updated: ApplicationAssetMaster[];
    const selectedService = services.find((s) => s.id === appSrvIdInput);
    if (editAppId) {
      updated = applications.map((a) =>
        a.id === editAppId
          ? {
              ...a,
              name: appNameInput.trim(),
              code: appCodeInput.trim().toUpperCase() || a.code,
              serviceId: appSrvIdInput,
              serviceName: selectedService ? selectedService.name : a.serviceName,
              categoryId: selectedService ? selectedService.categoryId : a.categoryId,
              assetTag: appAssetTagInput.trim() || undefined,
              hasApplicationArea: appHasAreaInput,
              description: appDescInput.trim(),
            }
          : a
      );
      showToast(`Application/Asset "${appNameInput}" updated.`);
    } else {
      const newApp: ApplicationAssetMaster = {
        id: `app-${Date.now().toString().slice(-6)}`,
        name: appNameInput.trim(),
        code: appCodeInput.trim().toUpperCase() || `APP_${Date.now().toString().slice(-4)}`,
        serviceId: appSrvIdInput,
        serviceName: selectedService ? selectedService.name : 'Unknown Service',
        categoryId: selectedService ? selectedService.categoryId : 'cat-biz-apps',
        type: 'Application',
        assetTag: appAssetTagInput.trim() || undefined,
        hasApplicationArea: appHasAreaInput,
        description: appDescInput.trim(),
        isActive: true,
      };
      updated = [...applications, newApp];
      showToast(`New Application/Asset "${appNameInput}" created.`);
    }
    setApplications(updated);
    if (onUpdateApplications) onUpdateApplications(updated);
    setShowAppModal(false);
  };

  const handleToggleAppActive = (id: string) => {
    const updated = applications.map((a) =>
      a.id === id ? { ...a, isActive: !a.isActive } : a
    );
    setApplications(updated);
    if (onUpdateApplications) onUpdateApplications(updated);
    showToast('Application status updated.');
  };

  const handleDeleteApplication = async (id: string) => {
    const target = applications.find((a) => a.id === id);
    const linkedModules = modules.filter((m) => m.applicationId === id);
    if (!window.confirm(`Delete Application/Asset "${target?.name || id}"? This will also delete ${linkedModules.length} linked module(s), sub-functions and processes from PostgreSQL.`)) return;

    try {
      const result = await api.deleteCatalogItem('applications', id);
      if (!result.success) throw new Error(result.message || 'Application deletion failed.');

      const removedModIds = new Set(linkedModules.map((m) => m.id));
      const removedSubIds = new Set(subFunctions.filter((sf) => removedModIds.has(sf.moduleId)).map((sf) => sf.id));
      const updatedApps = applications.filter((a) => a.id !== id);
      const updatedMods = modules.filter((m) => !removedModIds.has(m.id));
      const updatedSubs = subFunctions.filter((sf) => !removedModIds.has(sf.moduleId));
      const updatedProcs = processes.filter((p) => !removedSubIds.has(p.subFunctionId));

      setApplications(updatedApps);
      setModules(updatedMods);
      setSubFunctions(updatedSubs);
      setProcesses(updatedProcs);
      onUpdateApplications?.(updatedApps);
      onUpdateModules?.(updatedMods);
      onUpdateSubFunctions?.(updatedSubs);
      onUpdateProcesses?.(updatedProcs);
      if (selectedCatalogServiceId === target?.serviceId) setSelectedCatalogServiceId(target?.serviceId || '');
      showToast(`Application "${target?.name || id}" deleted from PostgreSQL.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Application could not be deleted.');
    }
  };

  // --------------------------------------------------------------------------
  // Issue Type Actions
  // --------------------------------------------------------------------------
  const handleSaveIssueType = () => {
    if (!issueNameInput.trim()) return;
    let updated: IssueTypeMaster[];
    if (editIssueTypeId) {
      updated = issueTypes.map((it) =>
        it.id === editIssueTypeId
          ? {
              ...it,
              name: issueNameInput.trim(),
              code: issueCodeInput.trim().toUpperCase() || it.code,
              description: issueDescInput.trim(),
              badgeColor: issueBadgeColorInput,
              defaultPriority: issuePriorityInput,
              isActive: issueIsActiveInput,
            }
          : it
      );
      showToast(`Issue Type "${issueNameInput}" updated.`);
    } else {
      const newIssueType: IssueTypeMaster = {
        id: `issue-${Date.now().toString().slice(-6)}`,
        name: issueNameInput.trim(),
        code: issueCodeInput.trim().toUpperCase() || `ISSUE_${Date.now().toString().slice(-4)}`,
        description: issueDescInput.trim(),
        badgeColor: issueBadgeColorInput,
        defaultPriority: issuePriorityInput,
        isActive: issueIsActiveInput,
        displayOrder: issueTypes.length + 1,
      };
      updated = [...issueTypes, newIssueType];
      showToast(`New Issue Type "${issueNameInput}" created.`);
    }
    setIssueTypes(updated);
    if (onUpdateIssueTypes) onUpdateIssueTypes(updated);
    setShowIssueModal(false);
  };

  const handleToggleIssueTypeActive = (id: string) => {
    const updated = issueTypes.map((it) =>
      it.id === id ? { ...it, isActive: !it.isActive } : it
    );
    setIssueTypes(updated);
    if (onUpdateIssueTypes) onUpdateIssueTypes(updated);
    showToast('Issue Type status updated.');
  };

  const handleDeleteIssueType = (id: string) => {
    const target = issueTypes.find((it) => it.id === id);
    if (window.confirm(`Are you sure you want to remove Issue Type "${target?.name || id}"?`)) {
      const updated = issueTypes.filter((it) => it.id !== id);
      setIssueTypes(updated);
      if (onUpdateIssueTypes) onUpdateIssueTypes(updated);
      showToast(`Issue Type "${target?.name || id}" removed.`);
    }
  };

  // --------------------------------------------------------------------------
  // Module Actions
  // --------------------------------------------------------------------------
  const handleOpenAddModule = () => {
    setEditModuleId(null);
    setModNameInput('');
    setModCodeInput('');
    setModDescInput('');
    setModAppIdInput(selectedHierarchyAppId || applications[0]?.id || '');
    setShowModuleModal(true);
  };

  const handleSaveModule = () => {
    if (!modNameInput.trim()) return;
    const cleanName = modNameInput.trim();
    let updated: ApplicationModuleMaster[];
    if (editModuleId) {
      updated = modules.map((m) =>
        m.id === editModuleId
          ? {
              ...m,
              name: cleanName,
              code: modCodeInput.trim() || m.code,
              description: modDescInput.trim(),
              applicationId: modAppIdInput,
            }
          : m
      );
      showToast(`Module "${cleanName}" updated.`);
    } else {
      const newMod: ApplicationModuleMaster = {
        id: `mod-${Date.now().toString().slice(-6)}`,
        applicationId: modAppIdInput,
        name: cleanName,
        code: modCodeInput.trim() || cleanName,
        description: modDescInput.trim() || `Module ${cleanName}`,
        isActive: true,
      };
      updated = [...modules, newMod];
      setSelectedHierarchyModuleId(newMod.id);
      showToast(`Module "${cleanName}" created.`);
    }
    setModules(updated);
    if (onUpdateModules) onUpdateModules(updated);
    setShowModuleModal(false);
  };

  const handleDeleteModule = (id: string) => {
    const target = modules.find((m) => m.id === id);
    if (window.confirm(`Are you sure you want to delete Module "${target?.name || id}" and all its sub-functions and processes?`)) {
      const updatedMods = modules.filter((m) => m.id !== id);
      const updatedSubs = subFunctions.filter((sf) => sf.moduleId !== id);
      const removedSubIds = new Set(subFunctions.filter((sf) => sf.moduleId === id).map((sf) => sf.id));
      const updatedProcs = processes.filter((p) => !removedSubIds.has(p.subFunctionId));

      setModules(updatedMods);
      setSubFunctions(updatedSubs);
      setProcesses(updatedProcs);

      if (onUpdateModules) onUpdateModules(updatedMods);
      if (onUpdateSubFunctions) onUpdateSubFunctions(updatedSubs);
      if (onUpdateProcesses) onUpdateProcesses(updatedProcs);

      if (selectedHierarchyModuleId === id) {
        setSelectedHierarchyModuleId(updatedMods[0]?.id || '');
      }
      api.deleteCatalogItem('modules', id).then((result) => { if (!result.success) showToast(result.message || 'Module deletion failed.'); });
      showToast(`Module "${target?.name || id}" deleted.`);
    }
  };

  // --------------------------------------------------------------------------
  // Sub-Function Actions
  // --------------------------------------------------------------------------
  const handleOpenAddSubFunction = () => {
    if (!selectedHierarchyModuleId) {
      showToast('Please select a Target Module first.');
      return;
    }
    setEditSubFnId(null);
    setSubFnNameInput('');
    setSubFnCodeInput('');
    setSubFnModIdInput(selectedHierarchyModuleId);
    setShowSubFnModal(true);
  };

  const handleSaveSubFunction = () => {
    if (!subFnNameInput.trim()) return;
    const cleanName = subFnNameInput.trim();
    let updated: ApplicationSubFunctionMaster[];
    if (editSubFnId) {
      updated = subFunctions.map((sf) =>
        sf.id === editSubFnId
          ? {
              ...sf,
              name: cleanName,
              code: subFnCodeInput.trim() || sf.code,
              moduleId: subFnModIdInput || selectedHierarchyModuleId,
            }
          : sf
      );
      showToast(`Sub-Function "${cleanName}" updated.`);
    } else {
      const newSub: ApplicationSubFunctionMaster = {
        id: `sf-${Date.now().toString().slice(-6)}`,
        moduleId: subFnModIdInput || selectedHierarchyModuleId,
        name: cleanName,
        code: subFnCodeInput.trim() || cleanName,
        isActive: true,
      };
      updated = [...subFunctions, newSub];
      setSelectedHierarchySubFnId(newSub.id);
      showToast(`Sub-Function "${cleanName}" created.`);
    }
    setSubFunctions(updated);
    if (onUpdateSubFunctions) onUpdateSubFunctions(updated);
    setShowSubFnModal(false);
  };

  const handleDeleteSubFunction = (id: string) => {
    const target = subFunctions.find((sf) => sf.id === id);
    if (window.confirm(`Are you sure you want to delete Sub-Function "${target?.name || id}" and all its processes?`)) {
      const updatedSubs = subFunctions.filter((sf) => sf.id !== id);
      const updatedProcs = processes.filter((p) => p.subFunctionId !== id);

      setSubFunctions(updatedSubs);
      setProcesses(updatedProcs);

      if (onUpdateSubFunctions) onUpdateSubFunctions(updatedSubs);
      if (onUpdateProcesses) onUpdateProcesses(updatedProcs);

      if (selectedHierarchySubFnId === id) {
        setSelectedHierarchySubFnId(updatedSubs.find((sf) => sf.moduleId === selectedHierarchyModuleId)?.id || '');
      }
      api.deleteCatalogItem('subfunctions', id).then((result) => { if (!result.success) showToast(result.message || 'Sub-function deletion failed.'); });
      showToast(`Sub-Function "${target?.name || id}" deleted.`);
    }
  };

  // --------------------------------------------------------------------------
  // Process Actions
  // --------------------------------------------------------------------------
  const handleOpenAddProcess = () => {
    if (!selectedHierarchySubFnId) {
      showToast('Please select a Sub-Function first.');
      return;
    }
    setEditProcessId(null);
    setProcNameInput('');
    setProcCodeInput('');
    setProcSubFnIdInput(selectedHierarchySubFnId);
    setShowProcessModal(true);
  };

  const handleSaveProcess = () => {
    if (!procNameInput.trim()) return;
    const cleanName = procNameInput.trim();
    let updated: ApplicationProcessMaster[];
    if (editProcessId) {
      updated = processes.map((p) =>
        p.id === editProcessId
          ? {
              ...p,
              name: cleanName,
              code: procCodeInput.trim() || p.code,
              subFunctionId: procSubFnIdInput || selectedHierarchySubFnId,
            }
          : p
      );
      showToast(`Process "${cleanName}" updated.`);
    } else {
      const newProc: ApplicationProcessMaster = {
        id: `p-${Date.now().toString().slice(-6)}`,
        subFunctionId: procSubFnIdInput || selectedHierarchySubFnId,
        name: cleanName,
        code: procCodeInput.trim() || cleanName,
        isActive: true,
      };
      updated = [...processes, newProc];
      showToast(`Process "${cleanName}" created.`);
    }
    setProcesses(updated);
    if (onUpdateProcesses) onUpdateProcesses(updated);
    setShowProcessModal(false);
  };

  const handleDeleteProcess = (id: string) => {
    const target = processes.find((p) => p.id === id);
    if (window.confirm(`Are you sure you want to delete Process "${target?.name || id}"?`)) {
      const updated = processes.filter((p) => p.id !== id);
      setProcesses(updated);
      if (onUpdateProcesses) onUpdateProcesses(updated);
      api.deleteCatalogItem('processes', id).then((result) => { if (!result.success) showToast(result.message || 'Process deletion failed.'); });
      showToast(`Process "${target?.name || id}" deleted.`);
    }
  };

  // --------------------------------------------------------------------------
  // Reset All to Default Master Data
  // --------------------------------------------------------------------------
  const handleResetToDefaults = () => {
    if (window.confirm('Reset all IT Service Catalog master data to enterprise default standards?')) {
      setCategories(MASTER_CATEGORIES);
      setServices(MASTER_SERVICES);
      setApplications(MASTER_APPLICATIONS_ASSETS);
      setIssueTypes(MASTER_ISSUE_TYPES);
      setModules(MASTER_APPLICATION_MODULES);
      setSubFunctions(MASTER_APPLICATION_SUBFUNCTIONS);
      setProcesses(MASTER_APPLICATION_PROCESSES);

      if (onUpdateCategories) onUpdateCategories(MASTER_CATEGORIES);
      if (onUpdateServices) onUpdateServices(MASTER_SERVICES);
      if (onUpdateApplications) onUpdateApplications(MASTER_APPLICATIONS_ASSETS);
      if (onUpdateIssueTypes) onUpdateIssueTypes(MASTER_ISSUE_TYPES);
      if (onUpdateModules) onUpdateModules(MASTER_APPLICATION_MODULES);
      if (onUpdateSubFunctions) onUpdateSubFunctions(MASTER_APPLICATION_SUBFUNCTIONS);
      if (onUpdateProcesses) onUpdateProcesses(MASTER_APPLICATION_PROCESSES);

      showToast('Master Catalog reset to defaults.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center space-x-2 text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <FolderTree className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                IT Service Catalog & Classification Administration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized master data tables for Category ➔ Service ➔ Application/Asset ➔ Issue Type & Application Areas
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <button
          onClick={() => setActiveCatalogTab('categories')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
            activeCatalogTab === 'categories'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>1. Categories ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('services')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
            activeCatalogTab === 'services'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>2. Services ({services.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('applications')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
            activeCatalogTab === 'applications'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>3. Applications & Assets ({applications.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('issuetypes')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
            activeCatalogTab === 'issuetypes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>4. Issue Types ({issueTypes.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('appareas')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
            activeCatalogTab === 'appareas'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>5. Application Areas (Modules/Functions)</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('matrix')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
            activeCatalogTab === 'matrix'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Hierarchy Tree Map</span>
        </button>
      </div>

      {/* Global Search Bar */}
      {activeCatalogTab !== 'matrix' && activeCatalogTab !== 'appareas' && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeCatalogTab}...`}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 shadow-2xs"
            />
          </div>

          <div>
            {activeCatalogTab === 'categories' && (
              <button
                onClick={() => {
                  setEditCategoryId(null);
                  setCatNameInput('');
                  setCatCodeInput('');
                  setCatDescInput('');
                  setShowCategoryModal(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            )}

            {activeCatalogTab === 'services' && (
              <button
                onClick={() => {
                  setEditServiceId(null);
                  setSrvNameInput('');
                  setSrvCodeInput('');
                  setSrvCatIdInput(categories[0]?.id || '');
                  setSrvDescInput('');
                  setShowServiceModal(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Service</span>
              </button>
            )}

            {activeCatalogTab === 'applications' && (
              <button
                onClick={() => {
                  setEditAppId(null);
                  setAppNameInput('');
                  setAppCodeInput('');
                  setAppSrvIdInput(services[0]?.id || '');
                  setAppAssetTagInput('');
                  setAppHasAreaInput(true);
                  setAppDescInput('');
                  setShowAppModal(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Application / Asset</span>
              </button>
            )}

            {activeCatalogTab === 'issuetypes' && (
              <button
                onClick={() => {
                  setEditIssueTypeId(null);
                  setIssueNameInput('');
                  setIssueCodeInput('');
                  setIssueDescInput('');
                  setIssuePriorityInput('Medium');
                  setIssueBadgeColorInput('bg-rose-50 text-rose-700 border-rose-200');
                  setIssueIsActiveInput(true);
                  setShowIssueModal(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Issue Type</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: CATEGORIES TABLE */}
      {/* ==================================================================== */}
      {activeCatalogTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Linked Services</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCategories.map((cat) => {
                  const linkedSrvCount = services.filter((s) => s.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{cat.code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{cat.name}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-md">{cat.description}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-200 text-[11px]">
                          {linkedSrvCount} Services
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleCategoryActive(cat.id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                            cat.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {cat.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditCategoryId(cat.id);
                            setCatNameInput(cat.name);
                            setCatCodeInput(cat.code);
                            setCatDescInput(cat.description);
                            setShowCategoryModal(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-semibold">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-semibold">Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: SERVICES - MASTER / DETAIL */}
      {/* ==================================================================== */}
      {activeCatalogTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="p-1 bg-blue-100 text-blue-700 rounded font-mono text-[10px]">1</span>
                <span>Services ({services.length})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditServiceId(null); setSrvNameInput(''); setSrvCodeInput('');
                  setSrvCatIdInput(categories[0]?.id || ''); setSrvDescInput(''); setShowServiceModal(true);
                }}
                className="inline-flex items-center space-x-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 cursor-pointer"
              >
                <Plus className="w-3 h-3" /><span>Add Service</span>
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={serviceSearchTerm} onChange={(e) => setServiceSearchTerm(e.target.value)} placeholder="Search services..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="space-y-1 max-h-[34rem] overflow-y-auto pr-1">
              {catalogServiceList.map((srv) => {
                const cat = categories.find((c) => c.id === srv.categoryId);
                const appCount = applications.filter((a) => a.serviceId === srv.id).length;
                return (
                  <div key={srv.id} onClick={() => setSelectedCatalogServiceId(srv.id)} className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group ${selectedCatalogServiceId === srv.id ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold shadow-2xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="block font-bold truncate">{srv.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{cat?.name || srv.categoryId} · {srv.code} · {appCount} item{appCount === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEditServiceId(srv.id); setSrvNameInput(srv.name); setSrvCodeInput(srv.code); setSrvCatIdInput(srv.categoryId); setSrvDescInput(srv.description || ''); setShowServiceModal(true); }} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit service"><Edit2 className="w-3 h-3" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteService(srv.id); }} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Delete service"><Trash2 className="w-3 h-3" /></button>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                );
              })}
              {catalogServiceList.length === 0 && <div className="p-5 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">No services match your search.</div>}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            {selectedCatalogService ? (() => {
              const cat = categories.find((c) => c.id === selectedCatalogService.categoryId);
              const linkedApps = applications.filter((a) => a.serviceId === selectedCatalogService.id);
              return (
                <div className="space-y-5">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Selected Service</div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedCatalogService.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded">{selectedCatalogService.code}</span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded">{cat?.name || selectedCatalogService.categoryId}</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${selectedCatalogService.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{selectedCatalogService.isActive ? 'Active' : 'Disabled'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => { setEditServiceId(selectedCatalogService.id); setSrvNameInput(selectedCatalogService.name); setSrvCodeInput(selectedCatalogService.code); setSrvCatIdInput(selectedCatalogService.categoryId); setSrvDescInput(selectedCatalogService.description || ''); setShowServiceModal(true); }} className="px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Edit</button>
                      <button type="button" onClick={() => handleDeleteService(selectedCatalogService.id)} className="px-2.5 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-[10px] text-slate-400 font-bold">APPLICATIONS / ASSETS</div><div className="text-xl font-bold text-slate-900 mt-1">{linkedApps.length}</div></div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-[10px] text-slate-400 font-bold">ASSET BASED</div><div className="text-sm font-bold text-slate-900 mt-2">{selectedCatalogService.isAssetBased ? 'Yes' : 'No'}</div></div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-[10px] text-slate-400 font-bold">RESPONSE SLA</div><div className="text-sm font-bold text-slate-900 mt-2">{(selectedCatalogService as any).slaResponseHours ?? '—'} hrs</div></div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-[10px] text-slate-400 font-bold">RESOLUTION SLA</div><div className="text-sm font-bold text-slate-900 mt-2">{(selectedCatalogService as any).slaResolutionHours ?? '—'} hrs</div></div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 mb-2">Description</div>
                    <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">{selectedCatalogService.description || 'No description provided.'}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2"><div className="text-xs font-bold text-slate-900">Linked Applications / Assets ({linkedApps.length})</div><span className="text-[10px] text-slate-400">Managed in Applications & Assets</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {linkedApps.map((app) => <div key={app.id} className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs flex items-center justify-between"><div className="min-w-0"><span className="font-bold text-slate-800 block truncate">{app.name}</span><span className="text-[10px] text-slate-400 font-mono">{app.assetTag || app.code}</span></div><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${app.isActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>{app.isActive ? 'Active' : 'Disabled'}</span></div>)}
                      {linkedApps.length === 0 && <div className="col-span-full p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">No applications/assets are linked to this service.</div>}
                    </div>
                  </div>
                </div>
              );
            })() : <div className="h-full min-h-80 flex items-center justify-center text-xs text-slate-400">Select a service from the list.</div>}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: APPLICATIONS & ASSETS - MASTER / DETAIL */}
      {/* ==================================================================== */}
      {activeCatalogTab === 'applications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5"><span className="p-1 bg-blue-100 text-blue-700 rounded font-mono text-[10px]">1</span><span>Services ({services.length})</span></span>
              <button type="button" onClick={() => { setEditAppId(null); setAppNameInput(''); setAppCodeInput(''); setAppSrvIdInput(selectedCatalogServiceId || services[0]?.id || ''); setAppAssetTagInput(''); setAppHasAreaInput(true); setAppDescInput(''); setShowAppModal(true); }} className="inline-flex items-center space-x-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200"><Plus className="w-3 h-3" /><span>Add Application</span></button>
            </div>
            <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={serviceSearchTerm} onChange={(e) => setServiceSearchTerm(e.target.value)} placeholder="Search services..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100" /></div>
            <div className="space-y-1 max-h-[34rem] overflow-y-auto pr-1">
              {catalogApplicationServices.map((srv) => { const cat = categories.find((c) => c.id === srv.categoryId); const count = applications.filter((a) => a.serviceId === srv.id).length; return <div key={srv.id} onClick={() => setSelectedCatalogServiceId(srv.id)} className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${selectedCatalogServiceId === srv.id ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}><div className="min-w-0 pr-2"><span className="font-bold block truncate">{srv.name}</span><span className="text-[10px] text-slate-400 block truncate">{cat?.name || srv.categoryId} · {srv.code}</span></div><span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 shrink-0">{count}</span></div>; })}
              {catalogApplicationServices.length === 0 && <div className="p-5 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">No services with applications/assets found.</div>}
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2"><div><div className="text-xs font-bold text-slate-900 flex items-center gap-1.5"><span className="p-1 bg-indigo-100 text-indigo-700 rounded font-mono text-[10px]">2</span>Applications / Assets ({selectedCatalogService ? applications.filter((a) => a.serviceId === selectedCatalogService.id).length : applications.length})</div><div className="text-[10px] text-slate-400 mt-1">{selectedCatalogService ? `Showing items under ${selectedCatalogService.name}` : 'Select a service to filter the list'}</div></div><div className="relative w-56"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={applicationSearchTerm} onChange={(e) => setApplicationSearchTerm(e.target.value)} placeholder="Search applications..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-100" /></div></div>
            <div className="space-y-1.5 max-h-[34rem] overflow-y-auto pr-1">
              {selectedCatalogServiceApps.map((app) => <div key={app.id} className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between group"><div className="min-w-0 pr-3"><span className="font-bold text-slate-900 block truncate">{app.name}</span><span className="text-[10px] text-slate-400 block truncate">{app.code}{app.assetTag ? ` · ${app.assetTag}` : ''}</span></div><div className="flex items-center gap-1 shrink-0"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${app.hasApplicationArea ? 'text-indigo-700 bg-indigo-50' : 'text-slate-500 bg-slate-100'}`}>{app.hasApplicationArea ? 'Modules Enabled' : 'Direct Ticket'}</span><button type="button" onClick={() => { setEditAppId(app.id); setAppNameInput(app.name); setAppCodeInput(app.code); setAppSrvIdInput(app.serviceId); setAppAssetTagInput(app.assetTag || ''); setAppHasAreaInput(!!app.hasApplicationArea); setAppDescInput(app.description || ''); setShowAppModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit application"><Edit2 className="w-3 h-3" /></button><button type="button" onClick={() => handleDeleteApplication(app.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Delete application"><Trash2 className="w-3 h-3" /></button></div></div>)}
              {selectedCatalogServiceApps.length === 0 && <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">No applications/assets match the selected service and search.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: ISSUE TYPES TABLE */}
      {/* ==================================================================== */}
      {activeCatalogTab === 'issuetypes' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Issue Type</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Default Priority</th>
                  <th className="py-3 px-4">Badge Styling</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredIssueTypes.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{it.name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">{it.code}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-md">{it.description}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          it.defaultPriority === 'Critical'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : it.defaultPriority === 'High'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : it.defaultPriority === 'Medium'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {it.defaultPriority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${it.badgeColor}`}>
                        {it.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleIssueTypeActive(it.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer transition-colors ${
                          it.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {it.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setEditIssueTypeId(it.id);
                            setIssueNameInput(it.name);
                            setIssueCodeInput(it.code);
                            setIssueDescInput(it.description);
                            setIssuePriorityInput(it.defaultPriority);
                            setIssueBadgeColorInput(it.badgeColor);
                            setIssueIsActiveInput(it.isActive);
                            setShowIssueModal(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Issue Type"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteIssueType(it.id)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Issue Type"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: APPLICATION AREAS (MODULES ➔ SUB-FUNCTIONS ➔ PROCESSES) */}
      {/* ==================================================================== */}
      {activeCatalogTab === 'appareas' && (
        <div className="space-y-6">
          <div className="bg-indigo-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-300" />
                <h3 className="text-base font-bold">Application Area Technical Matrix Configurator</h3>
              </div>
              <p className="text-xs text-indigo-200 mt-1">
                Configure data-driven 3-tier mapping (Module ➔ Sub-Function ➔ Process) for any Application Asset.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 bg-indigo-950/60 p-1.5 rounded-xl border border-indigo-700/50">
                <span className="text-xs text-indigo-300 font-bold pl-2">Target Application:</span>
                <select
                  value={selectedHierarchyAppId}
                  onChange={(e) => {
                    const newAppId = e.target.value;
                    setSelectedHierarchyAppId(newAppId);
                    const appMods = modules.filter((m) => m.applicationId === newAppId);
                    if (appMods.length > 0) {
                      setSelectedHierarchyModuleId(appMods[0].id);
                      const modSubs = subFunctions.filter((sf) => sf.moduleId === appMods[0].id);
                      setSelectedHierarchySubFnId(modSubs[0]?.id || '');
                    } else {
                      setSelectedHierarchyModuleId('');
                      setSelectedHierarchySubFnId('');
                    }
                  }}
                  className="bg-indigo-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.code})
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs bg-indigo-800/80 px-3 py-1.5 rounded-xl border border-indigo-700 text-indigo-200">
                {modules.length} Modules • {subFunctions.length} Sub-Functions • {processes.length} Processes
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Modules */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="p-1 bg-blue-100 text-blue-700 rounded font-mono text-[10px]">1</span>
                  <span>
                    Modules ({modules.filter((m) => selectedHierarchyAppId === 'all' ? true : m.applicationId === selectedHierarchyAppId).length})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleOpenAddModule}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Module</span>
                </button>
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                {modules
                  .filter((m) => selectedHierarchyAppId === 'all' ? true : m.applicationId === selectedHierarchyAppId)
                  .map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedHierarchyModuleId(m.id);
                        const modSubs = subFunctions.filter((sf) => sf.moduleId === m.id);
                        if (modSubs.length > 0) {
                          setSelectedHierarchySubFnId(modSubs[0].id);
                        } else {
                          setSelectedHierarchySubFnId('');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group ${
                        selectedHierarchyModuleId === m.id
                          ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="block font-bold truncate">{m.name}</span>
                        {m.description && <span className="text-[10px] text-slate-400 block truncate">{m.description}</span>}
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(m.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete module"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  ))}

                {modules.filter((m) => selectedHierarchyAppId === 'all' ? true : m.applicationId === selectedHierarchyAppId).length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    No modules defined for this application yet. Click "+ Add Module" to create one.
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Sub-Functions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="p-1 bg-indigo-100 text-indigo-700 rounded font-mono text-[10px]">2</span>
                  <span>Sub-Functions</span>
                </span>
                <button
                  type="button"
                  disabled={!selectedHierarchyModuleId}
                  onClick={handleOpenAddSubFunction}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 px-2 py-1 rounded-lg border border-indigo-200 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Sub-Function</span>
                </button>
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                {subFunctions
                  .filter((sf) => sf.moduleId === selectedHierarchyModuleId)
                  .map((sf) => (
                    <div
                      key={sf.id}
                      onClick={() => setSelectedHierarchySubFnId(sf.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group ${
                        selectedHierarchySubFnId === sf.id
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate pr-2">{sf.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubFunction(sf.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete sub-function"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  ))}

                {subFunctions.filter((sf) => sf.moduleId === selectedHierarchyModuleId).length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    {selectedHierarchyModuleId ? 'No sub-functions defined. Click "+ Add Sub-Function".' : 'Select a Target Module above.'}
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Processes / Functions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="p-1 bg-emerald-100 text-emerald-700 rounded font-mono text-[10px]">3</span>
                  <span>Processes / Functions</span>
                </span>
                <button
                  type="button"
                  disabled={!selectedHierarchySubFnId}
                  onClick={handleOpenAddProcess}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 px-2 py-1 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Process</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {processes
                  .filter((p) => p.subFunctionId === selectedHierarchySubFnId)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-between shadow-2xs group hover:bg-white"
                    >
                      <span className="truncate pr-2">{p.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteProcess(p.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete process"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </div>
                    </div>
                  ))}

                {processes.filter((p) => p.subFunctionId === selectedHierarchySubFnId).length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    {selectedHierarchySubFnId ? 'No processes defined. Click "+ Add Process".' : 'Select a Sub-Function on the left.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: HIERARCHY TREE MAP */}
      {/* ==================================================================== */}
      {activeCatalogTab === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Relational IT Helpdesk Classification Tree
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Visual overview of all active Categories, dependent Services, and associated Application Assets.
            </p>
          </div>

          <div className="space-y-6">
            {categories.map((cat) => {
              const catServices = services.filter((s) => s.categoryId === cat.id && s.isActive);
              return (
                <div
                  key={cat.id}
                  className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4.5 space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-blue-600 text-white rounded-lg font-bold text-[10px]">
                      {cat.code}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{cat.name}</span>
                    <span className="text-[11px] text-slate-400">({cat.description})</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-4 border-l-2 border-blue-300 ml-3">
                    {catServices.map((srv) => {
                      const srvApps = applications.filter(
                        (a) => a.serviceId === srv.id && a.isActive
                      );
                      return (
                        <div
                          key={srv.id}
                          className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-blue-900">{srv.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{srv.code}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                            {srvApps.map((app) => (
                              <span
                                key={app.id}
                                className={`text-[10px] px-2 py-0.5 rounded border ${
                                  app.hasApplicationArea
                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                                }`}
                              >
                                {app.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT CATEGORY */}
      {/* ==================================================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editCategoryId ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  placeholder="e.g. Business Applications"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category Code</label>
                <input
                  type="text"
                  value={catCodeInput}
                  onChange={(e) => setCatCodeInput(e.target.value)}
                  placeholder="e.g. CAT_BIZ_APPS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={catDescInput}
                  onChange={(e) => setCatDescInput(e.target.value)}
                  placeholder="Brief description of this classification category..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT SERVICE */}
      {/* ==================================================================== */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editServiceId ? 'Edit Service' : 'Create New Service'}
              </h3>
              <button
                onClick={() => setShowServiceModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Parent Category *</label>
                <select
                  value={srvCatIdInput}
                  onChange={(e) => setSrvCatIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={srvNameInput}
                  onChange={(e) => setSrvNameInput(e.target.value)}
                  placeholder="e.g. Production System or Laptop"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Code</label>
                <input
                  type="text"
                  value={srvCodeInput}
                  onChange={(e) => setSrvCodeInput(e.target.value)}
                  placeholder="e.g. SRV_PROD_SYS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={srvDescInput}
                  onChange={(e) => setSrvDescInput(e.target.value)}
                  placeholder="Brief description of this service tier..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowServiceModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveService}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Save Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT APPLICATION OR ASSET */}
      {/* ==================================================================== */}
      {showAppModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editAppId ? 'Edit Application / Asset' : 'Create New Application / Asset'}
              </h3>
              <button
                onClick={() => setShowAppModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Parent Service *</label>
                <select
                  value={appSrvIdInput}
                  onChange={(e) => setAppSrvIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  {services.map((s) => {
                    const c = categories.find((cat) => cat.id === s.categoryId);
                    return (
                      <option key={s.id} value={s.id}>
                        [{c?.name || 'Category'}] → {s.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Application / Asset Name *
                </label>
                <input
                  type="text"
                  value={appNameInput}
                  onChange={(e) => setAppNameInput(e.target.value)}
                  placeholder="e.g. PCS.NET or Dell Latitude 5440"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={appCodeInput}
                    onChange={(e) => setAppCodeInput(e.target.value)}
                    placeholder="e.g. APP_PCS_NET"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Asset Tag</label>
                  <input
                    type="text"
                    value={appAssetTagInput}
                    onChange={(e) => setAppAssetTagInput(e.target.value)}
                    placeholder="e.g. HW-LAPTOP-01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="chkHasArea"
                  checked={appHasAreaInput}
                  onChange={(e) => setAppHasAreaInput(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="chkHasArea" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Enable Application Area (Modules / Sub-Functions)
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={appDescInput}
                  onChange={(e) => setAppDescInput(e.target.value)}
                  placeholder="Brief description or technical stack..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAppModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApp}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Save Application / Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT ISSUE TYPE */}
      {/* ==================================================================== */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editIssueTypeId ? 'Edit Issue Type' : 'Add New Issue Type'}
              </h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Issue Type Name *
                </label>
                <input
                  type="text"
                  value={issueNameInput}
                  onChange={(e) => setIssueNameInput(e.target.value)}
                  placeholder="e.g. Incident, Service Request, Hardware Fault..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={issueCodeInput}
                    onChange={(e) => setIssueCodeInput(e.target.value)}
                    placeholder="e.g. INCIDENT"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Default Priority
                  </label>
                  <select
                    value={issuePriorityInput}
                    onChange={(e) => setIssuePriorityInput(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Badge Color Preset
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'Rose / Red', class: 'bg-rose-50 text-rose-700 border-rose-200' },
                    { label: 'Blue', class: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { label: 'Emerald', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { label: 'Amber', class: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { label: 'Purple', class: 'bg-purple-50 text-purple-700 border-purple-200' },
                    { label: 'Indigo', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                    { label: 'Cyan', class: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                    { label: 'Slate', class: 'bg-slate-100 text-slate-700 border-slate-200' },
                  ].map((preset) => (
                    <button
                      key={preset.class}
                      type="button"
                      onClick={() => setIssueBadgeColorInput(preset.class)}
                      className={`p-1.5 rounded-lg border text-[11px] font-bold truncate transition-all cursor-pointer ${
                        preset.class
                      } ${
                        issueBadgeColorInput === preset.class
                          ? 'ring-2 ring-blue-500 shadow-xs'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Preview:</span>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${issueBadgeColorInput}`}>
                    {issueNameInput || 'Preview Issue Type'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={issueDescInput}
                  onChange={(e) => setIssueDescInput(e.target.value)}
                  placeholder="Brief description of this issue classification..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="chkIssueActive"
                  checked={issueIsActiveInput}
                  onChange={(e) => setIssueIsActiveInput(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="chkIssueActive" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Active in Ticket Classification Dropdowns
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIssueType}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Save Issue Type
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT MODULE */}
      {/* ==================================================================== */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editModuleId ? 'Edit Target Module' : 'Add New Target Module'}
              </h3>
              <button
                onClick={() => setShowModuleModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Application *</label>
                <select
                  value={modAppIdInput}
                  onChange={(e) => setModAppIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Module Name *</label>
                <input
                  type="text"
                  value={modNameInput}
                  onChange={(e) => setModNameInput(e.target.value)}
                  placeholder="e.g. 107_PCS.NET, Order Management, Core Banking..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={modCodeInput}
                  onChange={(e) => setModCodeInput(e.target.value)}
                  placeholder="e.g. MOD-01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={modDescInput}
                  onChange={(e) => setModDescInput(e.target.value)}
                  placeholder="Module details..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowModuleModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModule}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Save Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT SUB-FUNCTION */}
      {/* ==================================================================== */}
      {showSubFnModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editSubFnId ? 'Edit Sub-Function' : 'Add New Sub-Function'}
              </h3>
              <button
                onClick={() => setShowSubFnModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Parent Module *</label>
                <select
                  value={subFnModIdInput}
                  onChange={(e) => setSubFnModIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Function Name *</label>
                <input
                  type="text"
                  value={subFnNameInput}
                  onChange={(e) => setSubFnNameInput(e.target.value)}
                  placeholder="e.g. CD2 Wire, Inventory Control, Invoicing..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={subFnCodeInput}
                  onChange={(e) => setSubFnCodeInput(e.target.value)}
                  placeholder="e.g. SF-01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowSubFnModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubFunction}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 cursor-pointer shadow-xs"
              >
                Save Sub-Function
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT PROCESS */}
      {/* ==================================================================== */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editProcessId ? 'Edit Process / Function' : 'Add New Process / Function'}
              </h3>
              <button
                onClick={() => setShowProcessModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Parent Sub-Function *</label>
                <select
                  value={procSubFnIdInput}
                  onChange={(e) => setProcSubFnIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {subFunctions.map((sf) => (
                    <option key={sf.id} value={sf.id}>
                      {sf.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Process / Function Name *</label>
                <input
                  type="text"
                  value={procNameInput}
                  onChange={(e) => setProcNameInput(e.target.value)}
                  placeholder="e.g. Wire Cutting, Quality Inspection, Batch Posting..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={procCodeInput}
                  onChange={(e) => setProcCodeInput(e.target.value)}
                  placeholder="e.g. PROC-01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowProcessModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProcess}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                Save Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
