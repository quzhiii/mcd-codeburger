export * from './types.ts';
export { QUESTIONS, QUESTION_COUNT, COVERED_DIMENSIONS } from './questions.ts';
export { PERSONAS, PERSONA_BY_ID } from './personas.ts';
export {
  DIMENSION_WEIGHTS,
  scoreAnswers,
  resolvePersona,
  buildAnswerKey,
  evaluate,
} from './scoring.ts';
