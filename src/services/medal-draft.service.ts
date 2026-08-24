export interface MedalDraft {
  name: string;
  requirements: string;
  jurisprudence: string | null;
  emoji: string | null;
  color: string | null;

  /**
   * Cargos que serão efetivamente concedidos
   * ao usuário no servidor de entrega (EB).
   */
  deliveryRoleIds: string[];

  /**
   * Cargos autorizados a aprovar ou negar
   * esta medalha.
   */
  approvalRoleIds: string[];

  /**
   * Cargos autorizados a aceitar/assumir
   * a entrega desta medalha.
   */
  deliveryPermissionRoleIds: string[];

  /**
   * Categoria da medalha.
   */
  categoryId: string | null;
}

const drafts = new Map<string, MedalDraft>();

export function saveMedalDraft(
  userId: string,
  draft: MedalDraft
): void {
  drafts.set(userId, draft);
}

export function getMedalDraft(
  userId: string
): MedalDraft | undefined {
  return drafts.get(userId);
}

export function deleteMedalDraft(
  userId: string
): void {
  drafts.delete(userId);
}