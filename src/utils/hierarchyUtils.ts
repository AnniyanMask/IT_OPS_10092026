import {
  ApplicationModuleMaster,
  ApplicationSubFunctionMaster,
  ApplicationProcessMaster,
} from '../types';
import { ModuleHierarchyMap } from '../data/db';

/**
 * Converts a nested ModuleHierarchyMap (e.g. { "107_PCS.NET": { "CD2 Wire": ["Process A"] } })
 * into relational master entity arrays for PostgreSQL database persistence.
 */
export function moduleHierarchyMapToEntities(
  map: ModuleHierarchyMap,
  existingModules: ApplicationModuleMaster[] = [],
  existingSubFunctions: ApplicationSubFunctionMaster[] = [],
  existingProcesses: ApplicationProcessMaster[] = [],
  defaultAppId = 'app-pcs-net'
): {
  modules: ApplicationModuleMaster[];
  subFunctions: ApplicationSubFunctionMaster[];
  processes: ApplicationProcessMaster[];
} {
  const modules: ApplicationModuleMaster[] = [];
  const subFunctions: ApplicationSubFunctionMaster[] = [];
  const processes: ApplicationProcessMaster[] = [];

  Object.entries(map).forEach(([modName, subMap]) => {
    if (!modName || !modName.trim()) return;
    const cleanModName = modName.trim();
    let modObj = existingModules.find((m) => m.name === cleanModName || m.code === cleanModName);
    const modId = modObj ? modObj.id : `mod-${cleanModName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    if (!modObj) {
      modObj = {
        id: modId,
        applicationId: defaultAppId,
        name: cleanModName,
        code: cleanModName,
        description: `Target Module ${cleanModName}`,
        isActive: true,
      };
    }
    modules.push(modObj);

    if (subMap && typeof subMap === 'object') {
      Object.entries(subMap).forEach(([subFnName, procList]) => {
        if (!subFnName || !subFnName.trim()) return;
        const cleanSubName = subFnName.trim();
        let subObj = existingSubFunctions.find(
          (sf) => sf.moduleId === modId && (sf.name === cleanSubName || sf.code === cleanSubName)
        );
        const subId = subObj ? subObj.id : `sf-${modId}-${cleanSubName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        
        if (!subObj) {
          subObj = {
            id: subId,
            moduleId: modId,
            name: cleanSubName,
            code: cleanSubName,
            isActive: true,
          };
        }
        subFunctions.push(subObj);

        if (Array.isArray(procList)) {
          procList.forEach((procName) => {
            if (!procName || !procName.trim()) return;
            const cleanProcName = procName.trim();
            let procObj = existingProcesses.find(
              (p) => p.subFunctionId === subId && (p.name === cleanProcName || p.code === cleanProcName)
            );
            const procId = procObj ? procObj.id : `p-${subId}-${cleanProcName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            
            if (!procObj) {
              procObj = {
                id: procId,
                subFunctionId: subId,
                name: cleanProcName,
                code: cleanProcName,
                isActive: true,
              };
            }
            processes.push(procObj);
          });
        }
      });
    }
  });

  return { modules, subFunctions, processes };
}

/**
 * Reconstructs a ModuleHierarchyMap from relational master entity arrays
 * loaded from PostgreSQL.
 */
export function entitiesToModuleHierarchyMap(
  modulesList: ApplicationModuleMaster[],
  subFunctionsList: ApplicationSubFunctionMaster[],
  processesList: ApplicationProcessMaster[]
): ModuleHierarchyMap {
  const map: ModuleHierarchyMap = {};
  modulesList.forEach((m) => {
    map[m.name] = {};
    const subs = subFunctionsList.filter((sf) => sf.moduleId === m.id && sf.isActive);
    subs.forEach((sf) => {
      const procs = processesList
        .filter((p) => p.subFunctionId === sf.id && p.isActive)
        .map((p) => p.name);
      map[m.name][sf.name] = procs;
    });
  });
  return map;
}
