export const CARD_PHOTO_LIMIT = 4;

export type ObservationCard = {
  childId: string;
  photos: string[];
  text: string;
};

export function createObservationCard(input: ObservationCard): ObservationCard {
  if (input.photos.length > CARD_PHOTO_LIMIT) {
    throw new Error(`a card can contain at most ${CARD_PHOTO_LIMIT} photos`);
  }
  return { ...input, photos: [...input.photos] };
}

export function validateHandbookCardChildren(childId: string, cardChildIds: string[]): void {
  if (cardChildIds.some(cardChildId => cardChildId !== childId)) {
    throw new Error("child scope violation");
  }
}

export function retireTemplateVersion(input: { usageCount: number }): { state: "retired" } {
  if (input.usageCount < 1) {
    throw new Error("only used template versions are retired");
  }
  return { state: "retired" };
}

export type FamilyRole = "family_admin" | "family_reader";
export type FamilyMember = { accountId: string; role: FamilyRole };

export function assignFamilyRole(members: FamilyMember[], accountId: string, role: FamilyRole): FamilyMember[] {
  const next = members.filter(member => member.accountId !== accountId);
  if (role === "family_admin" && next.some(member => member.role === "family_admin")) {
    throw new Error("a family has exactly one family administrator");
  }
  return [...next, { accountId, role }];
}

export function assertChildResourceAccess(input: { selectedChildId: string; resourceChildId: string }): void {
  if (input.selectedChildId !== input.resourceChildId) {
    throw new Error("child scope violation");
  }
}
