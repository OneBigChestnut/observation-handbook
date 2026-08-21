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
