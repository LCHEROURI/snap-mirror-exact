// Anonymous product events for onboarding/activation. No analytics platform is connected,
// so this is a no-op seam. Never pass journal text, AI replies, names or any personal content.
export type ProductEvent =
  | "onboarding_started"
  | "onboarding_personalized"
  | "onboarding_mode_selected"
  | "first_reflection_started"
  | "first_message_sent"
  | "first_reflection_completed";

export function trackEvent(_event: ProductEvent, _props?: { mode?: "write" | "talk" }) {
  // Intentionally empty until an analytics provider is chosen.
}
