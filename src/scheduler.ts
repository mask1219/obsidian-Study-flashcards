import type { Flashcard, NoteFlashcardsSettings, ReviewRating } from "./types";

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function addMinutes(base: Date, minutes: number): string {
  const next = new Date(base);
  next.setMinutes(next.getMinutes() + minutes);
  return next.toISOString();
}

function getLearningStepMinutes(settings: NoteFlashcardsSettings, step: number): number {
  const steps = settings.learningStepsMinutes.filter((value) => value > 0);
  if (steps.length === 0) {
    return 1;
  }
  return steps[Math.min(step, steps.length - 1)];
}

function graduateToReview(card: Flashcard, now: Date, intervalDays: number, easeFactor: number): Flashcard {
  return {
    ...card,
    cardState: "review",
    learningStep: 0,
    dueAt: addDays(now, intervalDays),
    intervalDays,
    easeFactor: Math.max(1.3, Number(easeFactor.toFixed(2))),
    repetition: Math.max(1, card.repetition + 1),
    reviewCount: card.reviewCount + 1,
    lastReviewedAt: now.toISOString()
  };
}

export function applyScheduledReview(card: Flashcard, rating: ReviewRating, settings: NoteFlashcardsSettings): Flashcard {
  const now = new Date();

  if (card.cardState === "new" || card.cardState === "learning") {
    const currentStep = card.cardState === "new" ? 0 : card.learningStep;

    if (rating === "again") {
      return {
        ...card,
        cardState: "learning",
        learningStep: 0,
        dueAt: addMinutes(now, getLearningStepMinutes(settings, 0)),
        reviewCount: card.reviewCount + 1,
        lastReviewedAt: now.toISOString()
      };
    }

    if (rating === "hard") {
      const hardStep = Math.max(0, currentStep);
      const minutes = Math.ceil(getLearningStepMinutes(settings, hardStep) * 1.5);
      return {
        ...card,
        cardState: "learning",
        learningStep: hardStep,
        dueAt: addMinutes(now, minutes),
        reviewCount: card.reviewCount + 1,
        lastReviewedAt: now.toISOString()
      };
    }

    if (rating === "good") {
      const nextStep = currentStep + 1;
      if (nextStep >= settings.learningStepsMinutes.length) {
        return graduateToReview(card, now, settings.graduatingIntervalDays, card.easeFactor);
      }

      return {
        ...card,
        cardState: "learning",
        learningStep: nextStep,
        dueAt: addMinutes(now, getLearningStepMinutes(settings, nextStep)),
        reviewCount: card.reviewCount + 1,
        lastReviewedAt: now.toISOString()
      };
    }

    return graduateToReview(card, now, settings.easyIntervalDays, card.easeFactor + 0.15);
  }

  let repetition = card.repetition;
  let intervalDays = card.intervalDays;
  let easeFactor = card.easeFactor;
  let lapseCount = card.lapseCount;

  if (rating === "again") {
    lapseCount += 1;
    return {
      ...card,
      cardState: "learning",
      learningStep: 0,
      dueAt: addMinutes(now, getLearningStepMinutes(settings, 0)),
      intervalDays: 0,
      repetition: 0,
      lapseCount,
      easeFactor: Math.max(1.3, Number((easeFactor - 0.2).toFixed(2))),
      reviewCount: card.reviewCount + 1,
      lastReviewedAt: now.toISOString()
    };
  }

  if (rating === "hard") {
    repetition += 1;
    intervalDays = Math.max(2, Math.ceil(Math.max(1, intervalDays) * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === "good") {
    repetition += 1;
    intervalDays = repetition <= 2 ? Math.max(settings.graduatingIntervalDays, 1 + repetition) : Math.max(3, Math.ceil(Math.max(1, intervalDays) * easeFactor));
  } else {
    repetition += 1;
    intervalDays = Math.max(settings.easyIntervalDays, Math.ceil(Math.max(1, intervalDays) * (easeFactor + 0.3)));
    easeFactor += 0.15;
  }

  return {
    ...card,
    cardState: "review",
    learningStep: 0,
    dueAt: addDays(now, intervalDays),
    intervalDays,
    easeFactor: Math.max(1.3, Number(easeFactor.toFixed(2))),
    repetition,
    lapseCount,
    reviewCount: card.reviewCount + 1,
    lastReviewedAt: now.toISOString()
  };
}
