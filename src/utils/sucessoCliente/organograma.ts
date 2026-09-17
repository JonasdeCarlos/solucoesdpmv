export type OrganogramaNode = {
  id: string;
  nome: string;
  nivel?: string;
  parent_id: string | null;
  [key: string]: unknown;
};

/**
 * Preserva a edição válida e corrige somente dados que impediriam nós de aparecer:
 * IDs repetidos, chefias inexistentes, auto-referências e ciclos hierárquicos.
 */
export function normalizeOrganograma(rawNodes: any[] = []): OrganogramaNode[] {
  const usedIds = new Set<string>();
  const firstIdByOriginal = new Map<string, string>();

  const nodes = rawNodes
    .filter((node) => String(node?.nome || '').trim())
    .map((node, index) => {
      const originalId = String(node?.id || `org_${index + 1}`);
      let id = originalId;
      let suffix = 2;
      while (usedIds.has(id)) id = `${originalId}_${suffix++}`;
      usedIds.add(id);
      if (!firstIdByOriginal.has(originalId)) firstIdByOriginal.set(originalId, id);
      return {
        ...node,
        id,
        nome: String(node.nome).trim(),
        parent_id: node?.parent_id ? String(node.parent_id) : null,
      } as OrganogramaNode;
    });

  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    const mappedParent = node.parent_id ? firstIdByOriginal.get(node.parent_id) || node.parent_id : null;
    node.parent_id = mappedParent && ids.has(mappedParent) && mappedParent !== node.id ? mappedParent : null;
  }

  // Rompe apenas o último vínculo que fecha um ciclo, mantendo os demais níveis.
  for (const node of nodes) {
    const visited = new Set<string>([node.id]);
    let current = node;
    while (current.parent_id) {
      if (visited.has(current.parent_id)) {
        current.parent_id = null;
        break;
      }
      visited.add(current.parent_id);
      const parent = nodes.find((candidate) => candidate.id === current.parent_id);
      if (!parent) {
        current.parent_id = null;
        break;
      }
      current = parent;
    }
  }

  return nodes;
}